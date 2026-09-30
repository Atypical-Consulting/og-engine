import { Hono } from 'hono';
import Stripe from 'stripe';
import {
  createApiKey,
  createUser,
  findApiKeyByEmail,
  findUserByEmail,
  findUserByStripeSubscription,
  type Plan,
  resetUsage,
  updatePlan,
  updateStripeInfo,
} from '../db';
import { sendDowngradeEmail, sendUpgradeEmail, sendWelcomeEmail } from '../email/send';

export const webhooksRoute = new Hono();

// Run a best-effort side-effect (e.g. sending an email) off the webhook's
// critical path. Stripe only needs a 2xx and gives up / retries if we're slow,
// so a slow or failing provider must never delay or fail the response. Billing
// state is always persisted synchronously before we defer. Errors are logged,
// never thrown.
function defer(promise: Promise<unknown>, context: string): void {
  promise.catch((err) => {
    console.error(`[webhooks] deferred side-effect failed (${context}):`, err);
  });
}

// A webhook branch that returns 200 without provisioning anything is invisible:
// Stripe treats the 2xx as success and never retries, so a mis-set price id or a
// missing email silently costs a paying customer their entitlement. Log every
// such drop with the event id so it is findable after the fact.
function dropped(event: Stripe.Event, reason: string, detail: Record<string, unknown> = {}): void {
  console.error(
    `[webhooks] dropped ${event.type} (${event.id}): ${reason}`,
    Object.keys(detail).length > 0 ? detail : '',
  );
}

// Plans in ascending order of entitlement, so we can tell an upgrade from a
// downgrade. `customer.subscription.updated` fires for both.
const PLAN_RANK: Record<Plan, number> = { free: 0, starter: 1, pro: 2, scale: 3 };

function getPlanFromPriceId(priceId: string): Plan | null {
  const mapping: Record<string, Plan> = {
    [process.env.STRIPE_PRICE_STARTER ?? '']: 'starter',
    [process.env.STRIPE_PRICE_PRO ?? '']: 'pro',
    [process.env.STRIPE_PRICE_SCALE ?? '']: 'scale',
  };
  return mapping[priceId] ?? null;
}

webhooksRoute.post('/webhooks/stripe', async (c) => {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeSecretKey || !webhookSecret) {
    return c.json({ error: 'server_error', message: 'Stripe is not configured.' }, 500);
  }

  const signature = c.req.header('stripe-signature');
  if (!signature) {
    return c.json({ error: 'invalid_request', message: 'Missing stripe-signature header.' }, 400);
  }

  const body = await c.req.text();
  const stripe = new Stripe(stripeSecretKey);

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (_err) {
    return c.json({ error: 'invalid_request', message: 'Invalid webhook signature.' }, 400);
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const email = session.customer_email ?? session.customer_details?.email ?? null;
      const customerId = session.customer as string;
      const subscriptionId = session.subscription as string;

      if (!email || !subscriptionId) {
        dropped(event, 'session has no email or no subscription', {
          sessionId: session.id,
          hasEmail: !!email,
          hasSubscription: !!subscriptionId,
        });
        break;
      }

      let sub: Stripe.Subscription;
      try {
        sub = await stripe.subscriptions.retrieve(subscriptionId);
      } catch (err) {
        // Money has already changed hands here. Log who we failed to provision,
        // then rethrow so Stripe sees a non-2xx and retries the delivery.
        console.error(
          `[webhooks] provisioning failed for ${email} (${event.id}): could not retrieve ${subscriptionId}`,
          err,
        );
        throw err;
      }

      const priceId = sub.items.data[0]?.price?.id;
      const plan = priceId ? getPlanFromPriceId(priceId) : null;
      if (!plan) {
        dropped(event, 'price id is not mapped to a plan — check STRIPE_PRICE_* env vars', {
          email,
          priceId,
          subscriptionId,
        });
        break;
      }

      let user = findUserByEmail(email);
      let apiKey = findApiKeyByEmail(email);
      if (user) {
        updatePlan(user.id, plan);
        updateStripeInfo(user.id, customerId, subscriptionId);
      } else {
        user = createUser(email, plan);
        updateStripeInfo(user.id, customerId, subscriptionId);
      }

      if (!apiKey) {
        apiKey = createApiKey(user.id);
      }

      defer(sendWelcomeEmail(email, apiKey.key, plan), 'sendWelcomeEmail');
      break;
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription;
      const subId = sub.id;
      const priceId = sub.items?.data?.[0]?.price?.id;

      if (!subId || !priceId) {
        dropped(event, 'subscription has no id or no price', { subId, priceId });
        break;
      }

      const plan = getPlanFromPriceId(priceId);
      if (!plan) {
        dropped(event, 'price id is not mapped to a plan — check STRIPE_PRICE_* env vars', { subId, priceId });
        break;
      }

      const user = findUserByStripeSubscription(subId);
      if (!user) {
        dropped(event, 'no local user linked to this subscription', { subId, plan });
        break;
      }

      const previousPlan = user.plan;
      updatePlan(user.id, plan);

      // Only congratulate an actual upgrade. A mid-period downgrade (Pro →
      // Starter) also arrives as customer.subscription.updated, and telling
      // that customer "Plan upgraded!" is simply false. There is no
      // downgrade-confirmation copy yet, so log the change and send nothing
      // rather than send the wrong thing.
      if (PLAN_RANK[plan] > PLAN_RANK[previousPlan]) {
        defer(sendUpgradeEmail(user.email, plan), 'sendUpgradeEmail');
      } else if (PLAN_RANK[plan] < PLAN_RANK[previousPlan]) {
        console.info(
          `[webhooks] ${event.type} (${event.id}): downgraded ${user.id} ${previousPlan} -> ${plan}; no email sent (no downgrade copy)`,
        );
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      const subId = sub.id;
      if (!subId) {
        dropped(event, 'subscription has no id');
        break;
      }

      const user = findUserByStripeSubscription(subId);
      if (!user) {
        dropped(event, 'no local user linked to this subscription', { subId });
        break;
      }

      updatePlan(user.id, 'free');
      defer(sendDowngradeEmail(user.email), 'sendDowngradeEmail');
      break;
    }

    case 'invoice.paid': {
      const invoice = event.data.object as Stripe.Invoice;
      const subId = (invoice.parent?.subscription_details?.subscription as string) ?? null;
      if (!subId) {
        dropped(event, 'invoice is not tied to a subscription', { invoiceId: invoice.id });
        break;
      }

      const user = findUserByStripeSubscription(subId);
      if (!user) {
        dropped(event, 'no local user linked to this subscription', { subId });
        break;
      }

      resetUsage(user.id);
      break;
    }
  }

  return c.text('ok');
});
