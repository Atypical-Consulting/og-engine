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

      if (!email || !subscriptionId) break;

      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      const priceId = sub.items.data[0]?.price?.id;
      const plan = priceId ? getPlanFromPriceId(priceId) : null;
      if (!plan) break;

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

      if (!subId || !priceId) break;

      const plan = getPlanFromPriceId(priceId);
      if (!plan) break;

      const user = findUserByStripeSubscription(subId);
      if (user) {
        updatePlan(user.id, plan);
        defer(sendUpgradeEmail(user.email, plan), 'sendUpgradeEmail');
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      const subId = sub.id;
      if (!subId) break;

      const user = findUserByStripeSubscription(subId);
      if (user) {
        updatePlan(user.id, 'free');
        defer(sendDowngradeEmail(user.email), 'sendDowngradeEmail');
      }
      break;
    }

    case 'invoice.paid': {
      const invoice = event.data.object as Stripe.Invoice;
      const subId = (invoice.parent?.subscription_details?.subscription as string) ?? null;
      if (!subId) break;

      const user = findUserByStripeSubscription(subId);
      if (user) {
        resetUsage(user.id);
      }
      break;
    }
  }

  return c.text('ok');
});
