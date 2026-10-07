import { Hono } from 'hono';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { closeDb, createApiKey, createUser, findApiKeyByEmail, findUserByEmail, updateStripeInfo } from '../../src/db';

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

  it('returns 500 when Stripe is not configured', async () => {
    delete process.env.STRIPE_SECRET_KEY;
    vi.resetModules();
    const app = await importWebhooksRoute();
    const res = await postWebhook(app, { type: 'test' });
    expect(res.status).toBe(500);
  });
});

// Checkout is started by static Stripe Payment Links, so the only identity that
// crosses back into `checkout.session.completed` is what we put on the URL. The
// expensive failure is silent: a paying customer is provisioned a *second*
// account because they paid with a different email, and nothing in the system
// reports an error. These lock the resolution order that prevents it.
describe('POST /webhooks/stripe — checkout identity (client_reference_id)', () => {
  // `returns 500 when Stripe is not configured` above calls vi.resetModules(),
  // which detaches this file's static `src/db` import from the one the route
  // resolves — two different in-memory databases. Reset deliberately instead and
  // read the db through the same fresh module graph the route gets.
  let db: typeof import('../../src/db');

  beforeEach(async () => {
    vi.resetModules();
    db = await import('../../src/db');
  });

  function countUsers(): number {
    return (db.getDb().prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number }).n;
  }

  it('upgrades the referenced account in place when the Stripe email differs', async () => {
    const user = db.createUser('dev@acme.com', 'free');
    const originalKey = db.createApiKey(user.id);

    const app = await importWebhooksRoute();
    const res = await postWebhook(app, {
      type: 'checkout.session.completed',
      data: {
        object: {
          // The company card is on the billing address, which never signed up.
          customer_email: 'billing@acme.com',
          client_reference_id: user.id,
          customer: 'cus_acme',
          subscription: 'sub_acme',
        },
      },
    });

    expect(res.status).toBe(200);

    // The account the developer actually uses is the one that got upgraded.
    const upgraded = db.findUserById(user.id);
    expect(upgraded!.plan).toBe('pro');
    expect(upgraded!.email).toBe('dev@acme.com');
    expect(upgraded!.stripe_customer_id).toBe('cus_acme');
    expect(upgraded!.stripe_subscription_id).toBe('sub_acme');

    // No shadow account, and no second key for the payer's address.
    expect(countUsers()).toBe(1);
    expect(db.findUserByEmail('billing@acme.com')).toBeNull();
    const keys = db.listApiKeysByUserId(user.id);
    expect(keys).toHaveLength(1);
    expect(keys[0]!.key).toBe(originalKey.key);

    // The key is emailed to the account, never to the billing address.
    const { sendWelcomeEmail } = await import('../../src/email/send');
    expect(sendWelcomeEmail).toHaveBeenCalledWith('dev@acme.com', originalKey.key, 'pro');
  });

  it('converges when Stripe re-delivers the same event', async () => {
    const user = db.createUser('retry@acme.com', 'free');
    const originalKey = db.createApiKey(user.id);

    const app = await importWebhooksRoute();
    const event = {
      type: 'checkout.session.completed',
      data: {
        object: {
          customer_email: 'billing@acme.com',
          client_reference_id: user.id,
          customer: 'cus_retry',
          subscription: 'sub_retry',
        },
      },
    };

    expect((await postWebhook(app, event)).status).toBe(200);
    expect((await postWebhook(app, event)).status).toBe(200);

    expect(countUsers()).toBe(1);
    const keys = db.listApiKeysByUserId(user.id);
    expect(keys).toHaveLength(1);
    expect(keys[0]!.key).toBe(originalKey.key);
    expect(db.findUserById(user.id)!.plan).toBe('pro');
  });

  it('still resolves by email when no client_reference_id is present', async () => {
    // The anonymous purchase from the public pricing page. Must keep working.
    const user = db.createUser('anon@example.com', 'free');
    db.createApiKey(user.id);

    const app = await importWebhooksRoute();
    const res = await postWebhook(app, {
      type: 'checkout.session.completed',
      data: {
        object: {
          customer_email: 'anon@example.com',
          customer: 'cus_anon',
          subscription: 'sub_anon',
        },
      },
    });

    expect(res.status).toBe(200);
    expect(countUsers()).toBe(1);
    const updated = db.findUserByEmail('anon@example.com');
    expect(updated!.id).toBe(user.id);
    expect(updated!.plan).toBe('pro');
    expect(updated!.stripe_customer_id).toBe('cus_anon');
    expect(db.listApiKeysByUserId(user.id)).toHaveLength(1);
  });

  it('falls back to the email join when the client_reference_id is unknown', async () => {
    // A stale upgrade link, or a deleted account. We must not drop the sale.
    const app = await importWebhooksRoute();
    const res = await postWebhook(app, {
      type: 'checkout.session.completed',
      data: {
        object: {
          customer_email: 'stale@example.com',
          client_reference_id: 'b9f0a3d4-0000-4000-8000-000000000000',
          customer: 'cus_stale',
          subscription: 'sub_stale',
        },
      },
    });

    expect(res.status).toBe(200);
    const created = db.findUserByEmail('stale@example.com');
    expect(created).not.toBeNull();
    expect(created!.plan).toBe('pro');
    expect(db.findApiKeyByEmail('stale@example.com')).not.toBeNull();
  });

  it('provisions by client_reference_id even when Stripe reports no email', async () => {
    const user = db.createUser('noemail@acme.com', 'free');
    db.createApiKey(user.id);

    const app = await importWebhooksRoute();
    const res = await postWebhook(app, {
      type: 'checkout.session.completed',
      data: {
        object: {
          client_reference_id: user.id,
          customer: 'cus_noemail',
          subscription: 'sub_noemail',
        },
      },
    });

    expect(res.status).toBe(200);
    expect(db.findUserById(user.id)!.plan).toBe('pro');
    expect(countUsers()).toBe(1);
  });
});
