import { Hono } from 'hono';
import Stripe from 'stripe';
import {
  createApiKey,
  findApiKeyByEmail,
  findApiKeyByStripeSubscription,
  type Plan,
  resetUsage,
  updatePlan,
  updateStripeInfo,
} from '../db';
import { sendDowngradeEmail, sendUpgradeEmail, sendWelcomeEmail } from '../email/send';

export const webhooksRoute = new Hono();

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
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (_err) {
    return c.json({ error: 'invalid_request', message: 'Invalid webhook signature.' }, 400);
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const email = session.customer_email;
      const customerId = session.customer as string;
      const subscriptionId = session.subscription as string;

      if (!email || !subscriptionId) break;

      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      const priceId = sub.items.data[0]?.price?.id;
      const plan = priceId ? getPlanFromPriceId(priceId) : null;
      if (!plan) break;

      let record = findApiKeyByEmail(email);
      if (record) {
        updatePlan(record.id, plan);
        updateStripeInfo(record.id, customerId, subscriptionId);
      } else {
        record = createApiKey(email, plan);
        updateStripeInfo(record.id, customerId, subscriptionId);
      }

      await sendWelcomeEmail(email, record.key, plan);
      break;
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription;
      const subId = sub.id;
      const priceId = sub.items?.data?.[0]?.price?.id;

      if (!subId || !priceId) break;

      const plan = getPlanFromPriceId(priceId);
      if (!plan) break;

      const record = findApiKeyByStripeSubscription(subId);
      if (record) {
        updatePlan(record.id, plan);
        await sendUpgradeEmail(record.email, plan);
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      const subId = sub.id;
      if (!subId) break;

      const record = findApiKeyByStripeSubscription(subId);
      if (record) {
        updatePlan(record.id, 'free');
        await sendDowngradeEmail(record.email);
      }
      break;
    }

    case 'invoice.paid': {
      const invoice = event.data.object as Stripe.Invoice;
      const subId = (invoice.parent?.subscription_details?.subscription as string) ?? null;
      if (!subId) break;

      const record = findApiKeyByStripeSubscription(subId);
      if (record) {
        resetUsage(record.id);
      }
      break;
    }
  }

  return c.text('ok');
});
