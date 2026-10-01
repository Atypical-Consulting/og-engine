import { type Context, Hono } from 'hono';
import Stripe from 'stripe';
import { getPlanFromPriceId } from '../billing/prices';
import {
  createApiKey,
  createUser,
  findApiKeyByEmail,
  findUserByEmail,
  findUserByStripeSubscription,
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

/**
 * Answers a webhook we could not act on with a non-2xx.
 *
 * Stripe treats any 2xx as "delivered" and never retries, so the old
 * `break` + `c.text('ok')` turned a charged card with no account into an event
 * nobody would ever see again. A 500 instead gets retried with backoff and
 * shows up as a failed delivery in the Stripe dashboard — an alerting channel
 * we already pay for.
 *
 * This is only safe because every handler below is idempotent: the checkout
 * path upserts by email (`findUserByEmail` → `updatePlan`/`createUser`,
 * `updateStripeInfo`, `findApiKeyByEmail` → `createApiKey`) and the
 * subscription path is a plain `updatePlan` keyed on the subscription id.
 * Replaying either converges on the same row, so a retry can only help.
 */
function unprocessable(c: Context, message: string) {
  return c.json({ error: 'server_error', message }, 500);
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

      // A Checkout Session without an email or a subscription is not something
      // a retry can fix (a one-off payment, say), so this stays a 2xx — but it
      // must never be silent again: it means a card was charged against a
      // session shape we do not provision for.
      if (!email || !subscriptionId) {
        console.error(
          `[webhooks] ${event.type} (${event.id}) is missing fields we provision from — ` +
            `email=${email ? 'present' : 'absent'} subscription=${subscriptionId ? 'present' : 'absent'}. ` +
            `No account was created.`,
        );
        break;
      }

      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      const priceId = sub.items.data[0]?.price?.id;
      const plan = priceId ? getPlanFromPriceId(priceId) : null;
      if (!plan) {
        console.error(
          `[webhooks] ${event.type} (${event.id}) carried price id "${priceId ?? '<none>'}", which maps to no plan — ` +
            `the customer has been charged and cannot be provisioned. ` +
            `Check STRIPE_PRICE_STARTER / STRIPE_PRICE_PRO / STRIPE_PRICE_SCALE against Stripe ` +
            `(GET /admin/stripe-price-check).`,
        );
        return unprocessable(c, 'Price id is not mapped to a plan.');
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

      if (!subId || !priceId) break;

      // Same mapping, same failure, different blast radius: this guard also
      // covers upgrades and downgrades, so a drifted price id silently freezes
      // an existing paying subscriber on their old entitlement.
      const plan = getPlanFromPriceId(priceId);
      if (!plan) {
        console.error(
          `[webhooks] ${event.type} (${event.id}) carried price id "${priceId}" for subscription ${subId}, ` +
            `which maps to no plan — the subscriber's entitlement was NOT changed. ` +
            `Check STRIPE_PRICE_STARTER / STRIPE_PRICE_PRO / STRIPE_PRICE_SCALE against Stripe ` +
            `(GET /admin/stripe-price-check).`,
        );
        return unprocessable(c, 'Price id is not mapped to a plan.');
      }

      const user = findUserByStripeSubscription(subId);
      if (!user) {
        console.error(
          `[webhooks] ${event.type} (${event.id}): no user matches subscription ${subId} — ` +
            `plan change to "${plan}" was dropped.`,
        );
        break;
      }

      updatePlan(user.id, plan);
      defer(sendUpgradeEmail(user.email, plan), 'sendUpgradeEmail');
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
