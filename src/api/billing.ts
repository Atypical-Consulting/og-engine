import { Hono } from 'hono';
import Stripe from 'stripe';
import type { UserRecord } from '../db';

export const billingRoute = new Hono();

billingRoute.get('/billing/portal', async (c) => {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    return c.json({ error: 'server_error', message: 'Stripe is not configured.' }, 500);
  }

  const user = c.get('user' as never) as UserRecord | undefined;

  if (!user?.stripe_customer_id) {
    return c.json(
      {
        error: 'no_billing_account',
        message: 'No billing account. Subscribe to a paid plan first.',
        docs: 'https://og-engine.com/pricing',
      },
      400,
    );
  }

  const stripe = new Stripe(stripeSecretKey);
  const session = await stripe.billingPortal.sessions.create({
    customer: user.stripe_customer_id,
    return_url: 'https://og-engine.com/pricing',
  });

  return c.json({ url: session.url });
});
