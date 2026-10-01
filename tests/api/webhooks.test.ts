import { Hono } from 'hono';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  closeDb,
  createApiKey,
  createUser,
  findApiKeyByEmail,
  findUserByEmail,
  PLAN_LIMITS,
  type Plan,
  updateStripeInfo,
} from '../../src/db';

// The price id the mocked Stripe API reports for a retrieved subscription.
// Hoisted so the `vi.mock` factory below can close over it; tests override it to
// exercise a specific tier's checkout.
const stripeSubscription = vi.hoisted(() => ({ priceId: 'price_pro_monthly' }));

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
          // Read at call time so a test can select the tier under test.
          retrieve: vi.fn().mockImplementation(async () => ({
            items: { data: [{ price: { id: stripeSubscription.priceId } }] },
          })),
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
  stripeSubscription.priceId = 'price_pro_monthly';
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
    // No vi.resetModules() here: the handler reads STRIPE_SECRET_KEY per
    // request, so resetting was unnecessary — and it detached the route's
    // module graph from this file's, giving the route a *second*
    // `file::memory:` database. Every test declared after this one then wrote
    // to a db the assertions could not see.
    delete process.env.STRIPE_SECRET_KEY;
    const app = await importWebhooksRoute();
    const res = await postWebhook(app, { type: 'test' });
    expect(res.status).toBe(500);
  });
});

// The Scale tier is the only self-serve price whose checkout was added after the
// entitlement side already shipped, so these lock down that the price id
// configured as STRIPE_PRICE_SCALE actually provisions the `scale` plan. If the
// env var and the Payment Link's price ever drift apart, these fail.
describe('POST /webhooks/stripe — Scale tier provisioning', () => {
  it('provisions a new Scale customer with the scale plan and its 200k limit', async () => {
    stripeSubscription.priceId = 'price_scale_monthly';
    const app = await importWebhooksRoute();
    const res = await postWebhook(app, {
      type: 'checkout.session.completed',
      data: {
        object: {
          customer_email: 'scale@example.com',
          customer: 'cus_scale',
          subscription: 'sub_scale',
        },
      },
    });

    expect(res.status).toBe(200);
    const user = findUserByEmail('scale@example.com');
    expect(user).not.toBeNull();
    expect(user!.plan).toBe('scale');
    expect(user!.stripe_subscription_id).toBe('sub_scale');
    // The entitlement the tier is sold on.
    expect(PLAN_LIMITS[user!.plan as Plan]).toBe(200_000);
    // A Scale customer must leave checkout with a usable key.
    expect(findApiKeyByEmail('scale@example.com')).not.toBeNull();
  });

  it('upgrades an existing Pro subscriber to scale on subscription.updated', async () => {
    const user = createUser('upgrade@example.com', 'pro');
    createApiKey(user.id);
    updateStripeInfo(user.id, 'cus_up', 'sub_up');

    const app = await importWebhooksRoute();
    const res = await postWebhook(app, {
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_up',
          items: { data: [{ price: { id: 'price_scale_monthly' } }] },
        },
      },
    });

    expect(res.status).toBe(200);
    expect(findUserByEmail('upgrade@example.com')!.plan).toBe('scale');
  });

  it('does not provision when the price id is not one of the configured tiers', async () => {
    // Guards the failure mode behind a mis-set STRIPE_PRICE_SCALE: Stripe has
    // charged the card and getPlanFromPriceId returns null. We must not answer
    // 200 — see the unmapped-price-id suite below for the full contract.
    stripeSubscription.priceId = 'price_not_configured';
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const app = await importWebhooksRoute();
    const res = await postWebhook(app, {
      type: 'checkout.session.completed',
      data: {
        object: {
          customer_email: 'unmapped@example.com',
          customer: 'cus_unmapped',
          subscription: 'sub_unmapped',
        },
      },
    });

    expect(res.status).toBe(500);
    expect(findUserByEmail('unmapped@example.com')).toBeNull();
    errSpy.mockRestore();
  });
});

// A 2xx tells Stripe the event was handled, so it never retries and the
// delivery looks green in the dashboard. Every branch that cannot provision
// must therefore be loud, and the ones a retry could fix must be non-2xx.
describe('POST /webhooks/stripe — an unmapped price id is never a silent 200', () => {
  it('fails the delivery and logs the price id on checkout.session.completed', async () => {
    stripeSubscription.priceId = 'price_archived_and_recreated';
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const app = await importWebhooksRoute();
    const res = await postWebhook(app, {
      type: 'checkout.session.completed',
      id: 'evt_unmapped_checkout',
      data: {
        object: {
          customer_email: 'charged@example.com',
          customer: 'cus_charged',
          subscription: 'sub_charged',
        },
      },
    });

    // Non-2xx so Stripe retries with backoff and surfaces a failed delivery.
    expect(res.status).toBe(500);
    expect(findUserByEmail('charged@example.com')).toBeNull();

    const logged = errSpy.mock.calls.map((args) => args.join(' ')).join('\n');
    expect(logged).toContain('checkout.session.completed');
    expect(logged).toContain('evt_unmapped_checkout');
    expect(logged).toContain('price_archived_and_recreated');
    errSpy.mockRestore();
  });

  it('fails the delivery and logs the price id on customer.subscription.updated', async () => {
    // The branch the original report missed: the same mapping guards plan
    // changes, so a drifted price id freezes an existing paying subscriber on
    // their old entitlement with nothing to show for it.
    const user = createUser('frozen@example.com', 'starter');
    createApiKey(user.id);
    updateStripeInfo(user.id, 'cus_frozen', 'sub_frozen');
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const app = await importWebhooksRoute();
    const res = await postWebhook(app, {
      type: 'customer.subscription.updated',
      id: 'evt_unmapped_update',
      data: {
        object: {
          id: 'sub_frozen',
          items: { data: [{ price: { id: 'price_renamed_pro' } }] },
        },
      },
    });

    expect(res.status).toBe(500);
    // The entitlement is unchanged, which is exactly why this must be loud.
    expect(findUserByEmail('frozen@example.com')!.plan).toBe('starter');

    const logged = errSpy.mock.calls.map((args) => args.join(' ')).join('\n');
    expect(logged).toContain('customer.subscription.updated');
    expect(logged).toContain('evt_unmapped_update');
    expect(logged).toContain('price_renamed_pro');
    expect(logged).toContain('sub_frozen');
    errSpy.mockRestore();
  });

  it('is idempotent on the retry Stripe will now send', async () => {
    // The whole premise of returning non-2xx is that replaying the event is
    // safe. Prove it: the same checkout delivered twice converges on one user,
    // one plan, one api key.
    const app = await importWebhooksRoute();
    const event = {
      type: 'checkout.session.completed',
      id: 'evt_retried',
      data: {
        object: {
          customer_email: 'retried@example.com',
          customer: 'cus_retried',
          subscription: 'sub_retried',
        },
      },
    };

    expect((await postWebhook(app, event)).status).toBe(200);
    const first = findUserByEmail('retried@example.com');
    const firstKey = findApiKeyByEmail('retried@example.com');

    expect((await postWebhook(app, event)).status).toBe(200);
    const second = findUserByEmail('retried@example.com');

    expect(second!.id).toBe(first!.id);
    expect(second!.plan).toBe('pro');
    expect(second!.stripe_subscription_id).toBe('sub_retried');
    // A second key would silently double the account's credentials.
    expect(findApiKeyByEmail('retried@example.com')!.key).toBe(firstKey!.key);
  });

  it('logs, but still answers 200, when the session has no subscription', async () => {
    // A retry cannot conjure a subscription out of a one-off payment session,
    // so this one stays 2xx — but it may never be silent.
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const app = await importWebhooksRoute();
    const res = await postWebhook(app, {
      type: 'checkout.session.completed',
      id: 'evt_no_subscription',
      data: { object: { customer_email: 'oneoff@example.com', customer: 'cus_oneoff' } },
    });

    expect(res.status).toBe(200);
    expect(findUserByEmail('oneoff@example.com')).toBeNull();

    const logged = errSpy.mock.calls.map((args) => args.join(' ')).join('\n');
    expect(logged).toContain('evt_no_subscription');
    expect(logged).toContain('subscription=absent');
    errSpy.mockRestore();
  });

  it('treats an unset STRIPE_PRICE_* as unmapped rather than matching the empty id', async () => {
    // The original mapping built its keys straight from the env vars, so an
    // unset var inserted a `''` key — indistinguishable from a wrong value.
    delete process.env.STRIPE_PRICE_SCALE;
    stripeSubscription.priceId = '';
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const app = await importWebhooksRoute();
    const res = await postWebhook(app, {
      type: 'checkout.session.completed',
      id: 'evt_empty_price',
      data: {
        object: {
          customer_email: 'emptyprice@example.com',
          customer: 'cus_empty',
          subscription: 'sub_empty',
        },
      },
    });

    expect(res.status).toBe(500);
    expect(findUserByEmail('emptyprice@example.com')).toBeNull();
    errSpy.mockRestore();
  });
});
