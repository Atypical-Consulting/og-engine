/**
 * Email is the only join key between a Stripe Payment Link purchase and an
 * og-engine account. These tests are load-bearing on the money path: if any of
 * them fail, a customer can pay and have the entitlement land on a second,
 * orphan row while the account they actually log into stays on `free`.
 *
 * Every entry point that can write an email lives here together, because the
 * invariant is a property of the join key, not of one route: a single
 * un-normalized boundary is enough to split the identity again.
 */

import { Hono } from 'hono';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { closeDb, createApiKey, createUser, findApiKeyByEmail, findUserByEmail, getDb } from '../../src/db';

vi.mock('stripe', () => {
  return {
    // biome-ignore lint/complexity/useArrowFunction: function keyword required for `new Stripe()` constructor mock
    default: vi.fn().mockImplementation(function () {
      return {
        webhooks: {
          constructEventAsync: vi.fn().mockImplementation(async (body: string) => JSON.parse(body)),
        },
        subscriptions: {
          retrieve: vi.fn().mockResolvedValue({
            items: { data: [{ price: { id: 'price_pro_monthly' } }] },
          }),
        },
      };
    }),
  };
});

vi.mock('../../src/email/send', () => ({
  sendWelcomeEmail: vi.fn().mockResolvedValue(undefined),
  sendUpgradeEmail: vi.fn().mockResolvedValue(undefined),
  sendDowngradeEmail: vi.fn().mockResolvedValue(undefined),
  sendMagicLinkEmail: vi.fn().mockResolvedValue(undefined),
}));

beforeEach(() => {
  closeDb();
  process.env.DATABASE_URL = 'file::memory:';
  process.env.STRIPE_SECRET_KEY = 'sk_test_123';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_123';
  process.env.STRIPE_PRICE_PRO = 'price_pro_monthly';
  process.env.STRIPE_PRICE_STARTER = 'price_starter_monthly';
  process.env.STRIPE_PRICE_SCALE = 'price_scale_monthly';
});

afterAll(() => {
  closeDb();
  delete process.env.DATABASE_URL;
  delete process.env.STRIPE_SECRET_KEY;
  delete process.env.STRIPE_WEBHOOK_SECRET;
  delete process.env.STRIPE_PRICE_PRO;
  delete process.env.STRIPE_PRICE_STARTER;
  delete process.env.STRIPE_PRICE_SCALE;
});

async function importWebhooksRoute() {
  const mod = await import('../../src/api/webhooks');
  const app = new Hono();
  app.route('/', mod.webhooksRoute);
  return app;
}

async function importRegisterRoute() {
  const mod = await import('../../src/api/register');
  const app = new Hono();
  app.route('/', mod.registerRoute);
  return app;
}

function postWebhook(app: Hono, event: object) {
  return app.request('/webhooks/stripe', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'stripe-signature': 'test_sig',
    },
    body: JSON.stringify(event),
  });
}

function countUsers(): number {
  return (getDb().prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number }).n;
}

function countApiKeys(): number {
  return (getDb().prepare('SELECT COUNT(*) AS n FROM api_keys').get() as { n: number }).n;
}

describe('checkout.session.completed — email is the join key', () => {
  it('upgrades the account the developer signed up with when checkout email differs in case', async () => {
    // The developer signs up lowercase and holds a key against that account.
    const signedUp = createUser('dev@example.com', 'free');
    const signupKey = createApiKey(signedUp.id);

    // At checkout they retype their email with different capitalisation.
    const app = await importWebhooksRoute();
    const res = await postWebhook(app, {
      type: 'checkout.session.completed',
      data: {
        object: {
          customer_email: 'Dev@Example.com',
          customer: 'cus_PAID',
          subscription: 'sub_PAID',
        },
      },
    });

    expect(res.status).toBe(200);

    // Exactly one account — no orphan row holding the plan they paid for.
    expect(countUsers()).toBe(1);

    // The entitlement landed on the row they log into.
    const user = findUserByEmail('dev@example.com');
    expect(user).not.toBeNull();
    expect(user!.id).toBe(signedUp.id);
    expect(user!.plan).toBe('pro');
    expect(user!.stripe_subscription_id).toBe('sub_PAID');
    expect(user!.stripe_customer_id).toBe('cus_PAID');

    // And the key they are already shipping with is the upgraded one.
    expect(countApiKeys()).toBe(1);
    expect(findApiKeyByEmail('dev@example.com')!.key).toBe(signupKey.key);
  });

  it('is not split by whitespace around the checkout email', async () => {
    const signedUp = createUser('spacey@example.com', 'free');
    createApiKey(signedUp.id);

    const app = await importWebhooksRoute();
    const res = await postWebhook(app, {
      type: 'checkout.session.completed',
      data: {
        object: {
          customer_details: { email: '  Spacey@Example.com  ' },
          customer: 'cus_SPACE',
          subscription: 'sub_SPACE',
        },
      },
    });

    expect(res.status).toBe(200);
    expect(countUsers()).toBe(1);
    expect(findUserByEmail('spacey@example.com')!.plan).toBe('pro');
  });

  it('stores a normalized email when checkout creates the account', async () => {
    const app = await importWebhooksRoute();
    const res = await postWebhook(app, {
      type: 'checkout.session.completed',
      data: {
        object: {
          customer_email: 'Fresh.Paid@Example.COM',
          customer: 'cus_FRESH',
          subscription: 'sub_FRESH',
        },
      },
    });

    expect(res.status).toBe(200);
    expect(countUsers()).toBe(1);

    const stored = getDb().prepare('SELECT email FROM users').get() as { email: string };
    expect(stored.email).toBe('fresh.paid@example.com');

    // A later login at the canonical casing must find that same row.
    expect(findUserByEmail('fresh.paid@example.com')).not.toBeNull();
  });
});

describe('the other writers of the join key', () => {
  it('POST /auth/register returns the existing key for a differently-cased email', async () => {
    const existing = createUser('reg@example.com', 'free');
    const existingKey = createApiKey(existing.id);

    const app = await importRegisterRoute();
    const res = await app.request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'REG@Example.com' }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { apiKey: string };
    expect(body.apiKey).toBe(existingKey.key);
    expect(countUsers()).toBe(1);
    expect(countApiKeys()).toBe(1);

    // A pasted address with stray whitespace signs in, rather than 400-ing on
    // Zod's .email() before normalisation ever gets a chance to run.
    const padded = await app.request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: '  reg@example.com  ' }),
    });
    expect(padded.status).toBe(200);
    expect(((await padded.json()) as { apiKey: string }).apiKey).toBe(existingKey.key);
    expect(countUsers()).toBe(1);
  });

  it('a magic-link login at a different casing resolves to the same account', async () => {
    const existing = createUser('login@example.com', 'pro');

    const { createMagicLinkToken } = await import('../../src/auth/magic-link');
    const { verifyMagicLink } = await import('../../src/auth/session');

    const { token } = createMagicLinkToken('Login@Example.com');
    const { user } = verifyMagicLink(token);

    expect(user.id).toBe(existing.id);
    expect(user.plan).toBe('pro');
    expect(countUsers()).toBe(1);
  });
});
