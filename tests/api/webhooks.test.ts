import { Hono } from 'hono';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { closeDb, createApiKey, findApiKeyByEmail, updateStripeInfo } from '../../src/db';

// Mock stripe
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

// Mock email
vi.mock('../../src/email/send', () => ({
  sendWelcomeEmail: vi.fn().mockResolvedValue(undefined),
  sendUpgradeEmail: vi.fn().mockResolvedValue(undefined),
  sendDowngradeEmail: vi.fn().mockResolvedValue(undefined),
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

describe('POST /webhooks/stripe', () => {
  it('returns 400 without stripe-signature header', async () => {
    const app = await importWebhooksRoute();
    const res = await app.request('/webhooks/stripe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'test' }),
    });
    expect(res.status).toBe(400);
  });

  it('handles checkout.session.completed for new user', async () => {
    const app = await importWebhooksRoute();
    const res = await postWebhook(app, {
      type: 'checkout.session.completed',
      data: {
        object: {
          customer_email: 'newpaid@example.com',
          customer: 'cus_123',
          subscription: 'sub_123',
        },
      },
    });
    expect(res.status).toBe(200);
    const record = findApiKeyByEmail('newpaid@example.com');
    expect(record).not.toBeNull();
    expect(record!.plan).toBe('pro');
    expect(record!.stripe_customer_id).toBe('cus_123');
    expect(record!.stripe_subscription_id).toBe('sub_123');
  });

  it('upgrades existing free user on checkout', async () => {
    createApiKey('existing@example.com', 'free');
    const app = await importWebhooksRoute();
    const res = await postWebhook(app, {
      type: 'checkout.session.completed',
      data: {
        object: {
          customer_email: 'existing@example.com',
          customer: 'cus_456',
          subscription: 'sub_456',
        },
      },
    });
    expect(res.status).toBe(200);
    const record = findApiKeyByEmail('existing@example.com');
    expect(record!.plan).toBe('pro');
    expect(record!.stripe_customer_id).toBe('cus_456');
  });

  it('handles customer.subscription.deleted — downgrades to free', async () => {
    const record = createApiKey('cancel@example.com', 'pro');
    updateStripeInfo(record.id, 'cus_789', 'sub_789');
    const app = await importWebhooksRoute();
    const res = await postWebhook(app, {
      type: 'customer.subscription.deleted',
      data: { object: { id: 'sub_789' } },
    });
    expect(res.status).toBe(200);
    const updated = findApiKeyByEmail('cancel@example.com');
    expect(updated!.plan).toBe('free');
  });

  it('handles invoice.paid — resets usage', async () => {
    const record = createApiKey('invoice@example.com', 'pro');
    updateStripeInfo(record.id, 'cus_inv', 'sub_inv');
    const { getDb } = await import('../../src/db');
    getDb().prepare('UPDATE api_keys SET calls_used = 100 WHERE id = ?').run(record.id);

    const app = await importWebhooksRoute();
    const res = await postWebhook(app, {
      type: 'invoice.paid',
      data: {
        object: {
          parent: {
            subscription_details: { subscription: 'sub_inv' },
          },
        },
      },
    });
    expect(res.status).toBe(200);
    const updated = findApiKeyByEmail('invoice@example.com');
    expect(updated!.calls_used).toBe(0);
  });

  it('returns 500 when Stripe is not configured', async () => {
    delete process.env.STRIPE_SECRET_KEY;
    vi.resetModules();
    const app = await importWebhooksRoute();
    const res = await postWebhook(app, { type: 'test' });
    expect(res.status).toBe(500);
  });
});
