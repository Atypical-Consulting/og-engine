import { Hono } from 'hono';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { closeDb, createApiKey, createUser, findApiKeyByEmail, findUserByEmail, updateStripeInfo } from '../../src/db';

// Mock stripe. The call mocks live outside the constructor so a single test can
// make one delivery fail (`mockRejectedValueOnce`) without rebuilding the double.
const stripeMocks = vi.hoisted(() => ({
  constructEventAsync: vi.fn(),
  retrieve: vi.fn(),
}));

vi.mock('stripe', () => {
  return {
    // biome-ignore lint/complexity/useArrowFunction: function keyword required for `new Stripe()` constructor mock
    default: vi.fn().mockImplementation(function () {
      return {
        webhooks: { constructEventAsync: stripeMocks.constructEventAsync },
        subscriptions: { retrieve: stripeMocks.retrieve },
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
  stripeMocks.constructEventAsync.mockReset();
  stripeMocks.constructEventAsync.mockImplementation(async (body: string) => JSON.parse(body));
  stripeMocks.retrieve.mockReset();
  stripeMocks.retrieve.mockResolvedValue({
    status: 'active',
    items: { data: [{ price: { id: 'price_pro_monthly' } }] },
  });

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
    const user = findUserByEmail('newpaid@example.com');
    expect(user).not.toBeNull();
    expect(user!.plan).toBe('pro');
    expect(user!.stripe_customer_id).toBe('cus_123');
    expect(user!.stripe_subscription_id).toBe('sub_123');
    // API key should also be created
    const apiKey = findApiKeyByEmail('newpaid@example.com');
    expect(apiKey).not.toBeNull();
  });

  it('upgrades existing free user on checkout', async () => {
    const user = createUser('existing@example.com', 'free');
    createApiKey(user.id);
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
    const updated = findUserByEmail('existing@example.com');
    expect(updated!.plan).toBe('pro');
    expect(updated!.stripe_customer_id).toBe('cus_456');
  });

  it('returns 200 and still provisions the user when the welcome email fails', async () => {
    const { sendWelcomeEmail } = await import('../../src/email/send');
    vi.mocked(sendWelcomeEmail).mockRejectedValueOnce(new Error('resend unavailable'));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const app = await importWebhooksRoute();
    const res = await postWebhook(app, {
      type: 'checkout.session.completed',
      data: {
        object: {
          customer_email: 'emailfail@example.com',
          customer: 'cus_ef',
          subscription: 'sub_ef',
        },
      },
    });

    // A failing email provider must NOT fail the webhook — Stripe only needs a 2xx.
    expect(res.status).toBe(200);
    // Billing state is persisted synchronously before the response.
    const user = findUserByEmail('emailfail@example.com');
    expect(user).not.toBeNull();
    expect(user!.plan).toBe('pro');
    expect(findApiKeyByEmail('emailfail@example.com')).not.toBeNull();

    // Let the deferred (fire-and-forget) email rejection settle, then assert it
    // was logged rather than thrown.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it('handles customer.subscription.deleted — downgrades to free', async () => {
    const user = createUser('cancel@example.com', 'pro');
    createApiKey(user.id);
    updateStripeInfo(user.id, 'cus_789', 'sub_789');
    const app = await importWebhooksRoute();
    const res = await postWebhook(app, {
      type: 'customer.subscription.deleted',
      data: { object: { id: 'sub_789' } },
    });
    expect(res.status).toBe(200);
    const updated = findUserByEmail('cancel@example.com');
    expect(updated!.plan).toBe('free');
  });

  it('returns 200 and still downgrades when the downgrade email fails', async () => {
    const user = createUser('dgfail@example.com', 'pro');
    createApiKey(user.id);
    updateStripeInfo(user.id, 'cus_dgf', 'sub_dgf');

    const { sendDowngradeEmail } = await import('../../src/email/send');
    vi.mocked(sendDowngradeEmail).mockRejectedValueOnce(new Error('resend unavailable'));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const app = await importWebhooksRoute();
    const res = await postWebhook(app, {
      type: 'customer.subscription.deleted',
      data: { object: { id: 'sub_dgf' } },
    });

    expect(res.status).toBe(200);
    expect(findUserByEmail('dgfail@example.com')!.plan).toBe('free');

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it('handles invoice.paid — resets usage', async () => {
    const user = createUser('invoice@example.com', 'pro');
    createApiKey(user.id);
    updateStripeInfo(user.id, 'cus_inv', 'sub_inv');
    const { getDb } = await import('../../src/db');
    getDb().prepare('UPDATE users SET calls_used = 100 WHERE id = ?').run(user.id);

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
    const updated = findUserByEmail('invoice@example.com');
    expect(updated!.calls_used).toBe(0);
  });

  // Stripe retries deliveries and does not guarantee ordering. Both branches
  // below handed out paid entitlement for free before the event ledger and the
  // ordering watermark existed.
  describe('idempotency at the boundary', () => {
    it('resets usage exactly once when the same invoice.paid is delivered twice', async () => {
      const user = createUser('replay@example.com', 'pro');
      createApiKey(user.id);
      updateStripeInfo(user.id, 'cus_replay', 'sub_replay');
      const { getDb } = await import('../../src/db');
      const db = getDb();
      const setUsed = (n: number) => db.prepare('UPDATE users SET calls_used = ? WHERE id = ?').run(n, user.id);
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const invoicePaid = {
        id: 'evt_invoice_replay',
        type: 'invoice.paid',
        created: 1_700_000_000,
        data: { object: { parent: { subscription_details: { subscription: 'sub_replay' } } } },
      };

      const app = await importWebhooksRoute();

      setUsed(4321);
      const first = await postWebhook(app, invoicePaid);
      expect(first.status).toBe(200);
      expect(findUserByEmail('replay@example.com')!.calls_used).toBe(0);

      // The customer spends quota, then Stripe retries the same invoice.
      setUsed(4321);
      const replay = await postWebhook(app, invoicePaid);
      expect(replay.status).toBe(200);
      // Usage must be untouched: one invoice buys exactly one quota period.
      expect(findUserByEmail('replay@example.com')!.calls_used).toBe(4321);
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('evt_invoice_replay'));
      warnSpy.mockRestore();
    });

    it('does not restore the paid plan when subscription.updated arrives after deleted', async () => {
      const user = createUser('ooo@example.com', 'pro');
      createApiKey(user.id);
      updateStripeInfo(user.id, 'cus_ooo', 'sub_ooo');
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const app = await importWebhooksRoute();

      const deleted = await postWebhook(app, {
        id: 'evt_sub_deleted',
        type: 'customer.subscription.deleted',
        created: 1_700_000_500,
        data: { object: { id: 'sub_ooo', status: 'canceled' } },
      });
      expect(deleted.status).toBe(200);
      expect(findUserByEmail('ooo@example.com')!.plan).toBe('free');

      // Distinct event id, so the ledger lets it through — only the ordering
      // watermark can stop it. Stripe generated it *before* the cancellation.
      const updated = await postWebhook(app, {
        id: 'evt_sub_updated',
        type: 'customer.subscription.updated',
        created: 1_700_000_400,
        data: {
          object: { id: 'sub_ooo', status: 'active', items: { data: [{ price: { id: 'price_pro_monthly' } }] } },
        },
      });
      expect(updated.status).toBe(200);

      const after = findUserByEmail('ooo@example.com')!;
      expect(after.plan).toBe('free');
      expect(after.calls_limit).toBe(500);
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('evt_sub_updated'), expect.anything());
      warnSpy.mockRestore();
    });

    it('treats the cancellation as final when the replayed updated carries no newer timestamp', async () => {
      const user = createUser('noclock@example.com', 'pro');
      createApiKey(user.id);
      updateStripeInfo(user.id, 'cus_noclock', 'sub_noclock');
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const app = await importWebhooksRoute();

      // The payloads from the reproduction harness: neither carries `created`.
      await postWebhook(app, {
        id: 'evt_nc_deleted',
        type: 'customer.subscription.deleted',
        data: { object: { id: 'sub_noclock' } },
      });
      expect(findUserByEmail('noclock@example.com')!.plan).toBe('free');

      await postWebhook(app, {
        id: 'evt_nc_updated',
        type: 'customer.subscription.updated',
        data: { object: { id: 'sub_noclock', items: { data: [{ price: { id: 'price_pro_monthly' } }] } } },
      });
      expect(findUserByEmail('noclock@example.com')!.plan).toBe('free');
      warnSpy.mockRestore();
    });

    it('still upgrades on a newer subscription.updated after a cancellation', async () => {
      const user = createUser('resub@example.com', 'pro');
      createApiKey(user.id);
      updateStripeInfo(user.id, 'cus_resub', 'sub_resub');

      const app = await importWebhooksRoute();

      await postWebhook(app, {
        id: 'evt_resub_deleted',
        type: 'customer.subscription.deleted',
        created: 1_700_000_500,
        data: { object: { id: 'sub_resub', status: 'canceled' } },
      });
      expect(findUserByEmail('resub@example.com')!.plan).toBe('free');

      // Genuinely newer event: the guard must not freeze the account on free.
      await postWebhook(app, {
        id: 'evt_resub_updated',
        type: 'customer.subscription.updated',
        created: 1_700_000_900,
        data: {
          object: { id: 'sub_resub', status: 'active', items: { data: [{ price: { id: 'price_pro_monthly' } }] } },
        },
      });
      const after = findUserByEmail('resub@example.com')!;
      expect(after.plan).toBe('pro');
      expect(after.calls_limit).toBe(50_000);
    });

    it('releases the claim when processing throws so the Stripe retry is not swallowed', async () => {
      // Money has already changed hands: if the failed delivery kept its claim,
      // Stripe's retry would be dropped as a duplicate and the paying customer
      // would never be provisioned.
      stripeMocks.retrieve.mockRejectedValueOnce(new Error('stripe unavailable'));
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const event = {
        id: 'evt_retry_me',
        type: 'checkout.session.completed',
        created: 1_700_000_900,
        data: { object: { customer_email: 'retry@example.com', customer: 'cus_retry', subscription: 'sub_retry' } },
      };

      const app = await importWebhooksRoute();

      // Hono turns the thrown error into a 500, which is what makes Stripe retry.
      const failed = await postWebhook(app, event);
      expect(failed.status).toBe(500);
      expect(findUserByEmail('retry@example.com')).toBeNull();

      const { findStripeEvent } = await import('../../src/db');
      expect(findStripeEvent('evt_retry_me')).toBeNull();

      const retried = await postWebhook(app, event);
      expect(retried.status).toBe(200);
      expect(findUserByEmail('retry@example.com')!.plan).toBe('pro');
      expect(findStripeEvent('evt_retry_me')).not.toBeNull();
      errSpy.mockRestore();
    });
  });

  it('returns 500 when Stripe is not configured', async () => {
    delete process.env.STRIPE_SECRET_KEY;
    vi.resetModules();
    const app = await importWebhooksRoute();
    const res = await postWebhook(app, { type: 'test' });
    expect(res.status).toBe(500);
  });
});
