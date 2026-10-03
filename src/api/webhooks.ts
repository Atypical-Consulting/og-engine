import { Hono } from 'hono';
import Stripe from 'stripe';
import {
  applySubscriptionTransition,
  claimStripeEvent,
  createApiKey,
  createUser,
  findApiKeyByEmail,
  findUserByEmail,
  findUserByStripeSubscription,
  type Plan,
  releaseStripeEvent,
  resetUsage,
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

// A transition we refused to apply because a newer event already landed. Like a
// silent 200, this is invisible to Stripe, so name the event that was ignored.
function stale(event: Stripe.Event, detail: Record<string, unknown>): void {
  console.warn(`[webhooks] ignored stale ${event.type} (${event.id}): a newer event was already applied`, detail);
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

  // Idempotency at the boundary. Stripe retries deliveries, so the same event id
  // can arrive more than once; provisioning must be safe to run twice. Claim the
  // id first — a second delivery is a no-op that still answers 200, because a
  // non-2xx would only make Stripe retry the duplicate again.
  const eventCreated = typeof event.created === 'number' ? event.created : 0;
  if (event.id) {
    if (!claimStripeEvent(event.id, event.type, eventCreated)) {
      console.warn(`[webhooks] duplicate delivery ignored: ${event.type} (${event.id})`);
      return c.text('ok');
    }
  } else {
    // Every real Stripe event carries an id; without one we cannot deduplicate.
    console.error(`[webhooks] event has no id — processed without replay protection (${event.type})`);
  }

  try {
    await handleEvent(stripe, event, eventCreated);
  } catch (err) {
    // Processing failed, so this event was not applied. Release the claim or the
    // Stripe retry would be swallowed as a duplicate and the customer would
    // never be provisioned.
    if (event.id) releaseStripeEvent(event.id);
    throw err;
  }

  return c.text('ok');
});

async function handleEvent(stripe: Stripe, event: Stripe.Event, eventCreated: number): Promise<void> {
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
      if (!user) {
        user = createUser(email, plan);
      }
      updateStripeInfo(user.id, customerId, subscriptionId);
      if (!applySubscriptionTransition(user.id, { plan, status: sub.status ?? 'active', eventCreated })) {
        stale(event, { email, plan, subscriptionId });
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
        if (applySubscriptionTransition(user.id, { plan, status: sub.status ?? 'active', eventCreated })) {
          defer(sendUpgradeEmail(user.email, plan), 'sendUpgradeEmail');
        } else {
          stale(event, { subId, plan });
        }
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      const subId = sub.id;
      if (!subId) break;

      const user = findUserByStripeSubscription(subId);
      if (user) {
        if (applySubscriptionTransition(user.id, { plan: 'free', status: 'canceled', eventCreated })) {
          defer(sendDowngradeEmail(user.email), 'sendDowngradeEmail');
        } else {
          stale(event, { subId });
        }
      }
      break;
    }

    case 'invoice.paid': {
      const invoice = event.data.object as Stripe.Invoice;
      const subId = (invoice.parent?.subscription_details?.subscription as string) ?? null;
      if (!subId) break;

      const user = findUserByStripeSubscription(subId);
      if (user) {
        // One reset per invoice, enforced by the event ledger above: replaying
        // the same invoice.paid would otherwise hand out a second quota period
        // after the customer had already spent the first one.
        resetUsage(user.id);
      }
      break;
    }
  }
}
