import { Hono } from 'hono';
import Stripe from 'stripe';
import {
  createApiKey,
  createUser,
  findApiKeyByEmail,
  findUserByEmail,
  findUserById,
  findUserByStripeSubscription,
  listApiKeysByUserId,
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
      const stripeEmail = session.customer_email ?? session.customer_details?.email ?? null;
      const customerId = session.customer as string;
      const subscriptionId = session.subscription as string;

      // The identity we carried into checkout ourselves beats the email the
      // buyer typed into Stripe's form. Someone who signed up as dev@acme.com
      // and pays with the company card on billing@acme.com must be upgraded in
      // place: joining on email alone provisions them a second account on the
      // paid plan and leaves the key in their production rate-limited on free,
      // with every signal we observe still reporting success. An unknown id
      // (stale link, deleted account) falls through to the email join, which is
      // also the path an anonymous purchase from the pricing page takes.
      // See src/utils/checkout-link.ts for the outbound half.
      const referencedUser = session.client_reference_id ? findUserById(session.client_reference_id) : null;

      if (!subscriptionId) break;
      if (!referencedUser && !stripeEmail) break;

      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      const priceId = sub.items.data[0]?.price?.id;
      const plan = priceId ? getPlanFromPriceId(priceId) : null;
      if (!plan) break;

      let user = referencedUser;
      if (!user && stripeEmail) {
        user = findUserByEmail(stripeEmail) ?? createUser(stripeEmail, plan);
      }
      if (!user) break;

      // Both of these are sets, so a re-delivered event converges instead of
      // doubling anything up.
      updatePlan(user.id, plan);
      updateStripeInfo(user.id, customerId, subscriptionId);

      // Look the key up against the resolved account, not against the email
      // Stripe reports — that email may belong to the payer rather than the
      // account. The email fallback catches a legacy key minted before keys
      // carried a user_id.
      let apiKey = listApiKeysByUserId(user.id)[0] ?? findApiKeyByEmail(user.email);
      if (!apiKey) {
        apiKey = createApiKey(user.id);
      }

      // Always the account address: this email carries a live API key, so it
      // must not go to a billing address that never signed up.
      defer(sendWelcomeEmail(user.email, apiKey.key, plan), 'sendWelcomeEmail');
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
