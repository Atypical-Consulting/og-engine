import { Hono } from 'hono';
import {
  createApiKey,
  findApiKeyByEmail,
  findApiKeyByStripeSubscription,
  type Plan,
  resetUsage,
  updatePlan,
  updateStripeInfo,
} from '../db';

export const webhooksRoute = new Hono();

// Map Stripe price IDs to plans — configure via env vars
function getPlanFromPriceId(priceId: string): Plan | null {
  const mapping: Record<string, Plan> = {
    [process.env.STRIPE_PRICE_STARTER ?? 'price_starter_monthly']: 'starter',
    [process.env.STRIPE_PRICE_PRO ?? 'price_pro_monthly']: 'pro',
    [process.env.STRIPE_PRICE_SCALE ?? 'price_scale_monthly']: 'scale',
  };
  return mapping[priceId] ?? null;
}

webhooksRoute.post('/webhooks/stripe', async (c) => {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeSecretKey || !webhookSecret) {
    return c.json(
      {
        error: 'server_error',
        message: 'Stripe is not configured.',
      },
      500,
    );
  }

  const signature = c.req.header('stripe-signature');
  if (!signature) {
    return c.json({ error: 'invalid_request', message: 'Missing stripe-signature header.' }, 400);
  }

  const body = await c.req.text();

  // Verify webhook signature using Stripe's scheme
  // For production: use stripe.webhooks.constructEvent(body, signature, webhookSecret)
  // For now: parse and handle — Stripe SDK verification should be added when stripe dep is installed
  let event: { type: string; data: { object: Record<string, unknown> } };
  try {
    event = JSON.parse(body);
  } catch {
    return c.json({ error: 'invalid_request', message: 'Invalid JSON body.' }, 400);
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const email = session.customer_email as string;
      const customerId = session.customer as string;
      const subscriptionId = session.subscription as string;

      if (!email || !subscriptionId) break;

      // Determine plan — in production, retrieve subscription from Stripe to get price ID
      // For now, accept plan from metadata or default to starter
      const plan = ((session.metadata as Record<string, string>)?.plan as Plan) ?? 'starter';

      // Check if user already has a key
      let record = findApiKeyByEmail(email);
      if (record) {
        // Upgrade existing key
        updatePlan(record.id, plan);
        updateStripeInfo(record.id, customerId, subscriptionId);
      } else {
        // Create new key with paid plan
        record = createApiKey(email, plan);
        updateStripeInfo(record.id, customerId, subscriptionId);
      }

      // TODO: Send API key email via Resend
      break;
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object;
      const subId = sub.id as string;
      const items = sub.items as { data: { price: { id: string } }[] };
      const priceId = items?.data?.[0]?.price?.id;

      if (!subId || !priceId) break;

      const plan = getPlanFromPriceId(priceId);
      if (!plan) break;

      const record = findApiKeyByStripeSubscription(subId);
      if (record) {
        updatePlan(record.id, plan);
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object;
      const subId = sub.id as string;
      if (!subId) break;

      const record = findApiKeyByStripeSubscription(subId);
      if (record) {
        updatePlan(record.id, 'free');
      }
      break;
    }

    case 'invoice.paid': {
      // Monthly billing cycle reset
      const invoice = event.data.object;
      const subId = invoice.subscription as string;
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
