import { Hono } from 'hono';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { closeDb, createApiKey, updateStripeInfo } from '../../src/db';
import { authMiddleware } from '../../src/middleware/auth';

// Mock stripe — must use function() not arrow for new Stripe() to work
vi.mock('stripe', () => {
  return {
    // biome-ignore lint/complexity/useArrowFunction: Vitest mock requires function for new
    default: vi.fn().mockImplementation(function () {
      return {
        billingPortal: {
          sessions: {
            create: vi.fn().mockResolvedValue({
              url: 'https://billing.stripe.com/session/test_session',
            }),
          },
        },
      };
    }),
  };
});

beforeEach(() => {
  closeDb();
  process.env.DATABASE_URL = 'file::memory:';
  process.env.STRIPE_SECRET_KEY = 'sk_test_123';
});

afterAll(() => {
  closeDb();
  delete process.env.DATABASE_URL;
  delete process.env.STRIPE_SECRET_KEY;
});

async function createApp() {
  const { billingRoute } = await import('../../src/api/billing');
  const app = new Hono();
  app.use('/billing/*', authMiddleware());
  app.route('/', billingRoute);
  return app;
}

describe('GET /billing/portal', () => {
  it('returns portal URL for paid user with stripe_customer_id', async () => {
    const record = createApiKey('paid@example.com', 'pro');
    updateStripeInfo(record.id, 'cus_test_123', 'sub_test_123');
    const app = await createApp();
    const res = await app.request('/billing/portal', {
      headers: { Authorization: `Bearer ${record.key}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toBe('https://billing.stripe.com/session/test_session');
  });

  it('returns 400 for free user without stripe_customer_id', async () => {
    const record = createApiKey('free@example.com', 'free');
    const app = await createApp();
    const res = await app.request('/billing/portal', {
      headers: { Authorization: `Bearer ${record.key}` },
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('no_billing_account');
  });

  it('returns 401 without auth', async () => {
    const app = await createApp();
    const res = await app.request('/billing/portal');
    expect(res.status).toBe(401);
  });

  it('returns 500 when Stripe is not configured', async () => {
    delete process.env.STRIPE_SECRET_KEY;
    const record = createApiKey('nostripe@example.com', 'pro');
    updateStripeInfo(record.id, 'cus_ns', 'sub_ns');
    vi.resetModules();
    const app = await createApp();
    const res = await app.request('/billing/portal', {
      headers: { Authorization: `Bearer ${record.key}` },
    });
    expect(res.status).toBe(500);
  });
});
