import { Hono } from 'hono';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  closeDb,
  createApiKey,
  createUser,
  findUserByEmail,
  getDb,
  logRender,
  type Plan,
  toSqliteDateTime,
} from '../../src/db';

// What the mocked Stripe API answers for `prices.retrieve`. Hoisted so the
// `vi.mock` factory can close over it; tests swap in the drift they exercise.
const stripePrices = vi.hoisted(() => {
  class StripeError extends Error {
    code?: string;
  }
  return {
    StripeError,
    retrieve: null as ((id: string) => Promise<unknown>) | null,
  };
});

vi.mock('stripe', () => {
  // biome-ignore lint/complexity/useArrowFunction: function keyword required for `new Stripe()` constructor mock
  const Stripe = vi.fn().mockImplementation(function () {
    return {
      prices: {
        retrieve: vi.fn().mockImplementation(async (id: string) => stripePrices.retrieve?.(id)),
      },
    };
  });
  Object.assign(Stripe, { errors: { StripeError: stripePrices.StripeError } });
  return { default: Stripe };
});

/** A live, correctly-priced Price, as Stripe would return it. */
function livePrice(id: string, unitAmount: number) {
  return { id, active: true, type: 'recurring', unit_amount: unitAmount, currency: 'eur' };
}

/** The 404 Stripe raises for a price id that does not exist on the account. */
function resourceMissing(id: string) {
  const err = new stripePrices.StripeError(`No such price: ${id}`);
  err.code = 'resource_missing';
  return err;
}

beforeEach(() => {
  closeDb();
  process.env.DATABASE_URL = 'file::memory:';
  process.env.ADMIN_CRON_SECRET = 'test_admin_secret';
  process.env.STRIPE_SECRET_KEY = 'sk_test_123';
  process.env.STRIPE_PRICE_STARTER = 'price_starter';
  process.env.STRIPE_PRICE_PRO = 'price_pro';
  process.env.STRIPE_PRICE_SCALE = 'price_scale';
  stripePrices.retrieve = async (id) => {
    if (id === 'price_starter') return livePrice(id, 1000);
    if (id === 'price_pro') return livePrice(id, 3900);
    if (id === 'price_scale') return livePrice(id, 9900);
    throw resourceMissing(id);
  };
});

afterAll(() => {
  closeDb();
  delete process.env.DATABASE_URL;
  delete process.env.ADMIN_CRON_SECRET;
  delete process.env.STRIPE_SECRET_KEY;
  delete process.env.STRIPE_PRICE_STARTER;
  delete process.env.STRIPE_PRICE_PRO;
  delete process.env.STRIPE_PRICE_SCALE;
});

async function createApp() {
  const { adminRoute } = await import('../../src/api/admin');
  const app = new Hono();
  app.route('/', adminRoute);
  return app;
}

function postReset(app: Hono, secret?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (secret) headers.Authorization = `Bearer ${secret}`;
  return app.request('/admin/reset-free-quotas', { method: 'POST', headers });
}

function getStats(app: Hono, secret?: string) {
  const headers: Record<string, string> = {};
  if (secret) headers.Authorization = `Bearer ${secret}`;
  return app.request('/admin/stats', { method: 'GET', headers });
}

function hoursAgo(hours: number): Date {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

/** Signup written the way production writes it: ISO-8601 with a `Z` suffix. */
function seedUser(email: string, plan: Plan, signupHoursAgo: number, stripeCustomerId?: string) {
  const user = createUser(email, plan);
  const apiKey = createApiKey(user.id);
  const db = getDb();
  db.prepare('UPDATE users SET created_at = ?, stripe_customer_id = ? WHERE id = ?').run(
    hoursAgo(signupHoursAgo).toISOString(),
    stripeCustomerId ?? null,
    user.id,
  );
  return { user, apiKey };
}

/** Render written the way production writes it: SQLite `YYYY-MM-DD HH:MM:SS`. */
function seedRender(userId: string, apiKeyId: string, renderHoursAgo: number) {
  logRender({ userId, apiKeyId, endpoint: '/render', requestPayload: {}, format: 'og' });
  const db = getDb();
  db.prepare(
    'UPDATE render_history SET created_at = ? WHERE id = (SELECT id FROM render_history ORDER BY rowid DESC LIMIT 1)',
  ).run(toSqliteDateTime(hoursAgo(renderHoursAgo)));
}

describe('POST /admin/reset-free-quotas', () => {
  it('resets usage for all free users', async () => {
    const free1User = createUser('free1@example.com', 'free');
    createApiKey(free1User.id);
    const free2User = createUser('free2@example.com', 'free');
    createApiKey(free2User.id);
    const paidUser = createUser('paid@example.com', 'pro');
    createApiKey(paidUser.id);

    const db = getDb();
    db.prepare('UPDATE users SET calls_used = 100 WHERE id = ?').run(free1User.id);
    db.prepare('UPDATE users SET calls_used = 200 WHERE id = ?').run(free2User.id);
    db.prepare('UPDATE users SET calls_used = 300 WHERE id = ?').run(paidUser.id);

    const app = await createApp();
    const res = await postReset(app, 'test_admin_secret');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.reset).toBe(2);

    expect(findUserByEmail('free1@example.com')!.calls_used).toBe(0);
    expect(findUserByEmail('free2@example.com')!.calls_used).toBe(0);
    expect(findUserByEmail('paid@example.com')!.calls_used).toBe(300);
  });

  it('returns 401 without admin secret', async () => {
    const app = await createApp();
    const res = await postReset(app);
    expect(res.status).toBe(401);
  });

  it('returns 401 with wrong secret', async () => {
    const app = await createApp();
    const res = await postReset(app, 'wrong_secret');
    expect(res.status).toBe(401);
  });

  it('returns 500 when ADMIN_CRON_SECRET not configured', async () => {
    delete process.env.ADMIN_CRON_SECRET;
    const app = await createApp();
    const res = await postReset(app, 'anything');
    expect(res.status).toBe(500);
  });
});

describe('GET /admin/stats', () => {
  it('reports signups, plan mix, activation and time to first value', async () => {
    // free, signed up 10d ago, activated 2h after signup, rendered again 1d ago
    const a = seedUser('a@example.com', 'free', 240);
    seedRender(a.user.id, a.apiKey.id, 238);
    seedRender(a.user.id, a.apiKey.id, 24);
    // starter, signed up 2d ago, activated 4h after signup
    const b = seedUser('b@example.com', 'starter', 48);
    seedRender(b.user.id, b.apiKey.id, 44);
    // free, signed up 40d ago, never activated
    seedUser('c@example.com', 'free', 960);
    // pro with a Stripe customer, signed up 3d ago, never activated
    seedUser('d@example.com', 'pro', 72, 'cus_test_1');

    const app = await createApp();
    const res = await getStats(app, 'test_admin_secret');
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.users_total).toBe(4);
    expect(body.users_by_plan).toEqual({ free: 2, starter: 1, pro: 1, scale: 0 });
    expect(body.users_created_last_7d).toBe(2);
    expect(body.users_created_last_30d).toBe(3);
    expect(body.activated_users_total).toBe(2);
    expect(body.activated_last_7d).toBe(1);
    expect(body.activated_last_30d).toBe(2);
    expect(body.active_users_last_7d).toBe(2);
    expect(body.active_users_last_30d).toBe(2);
    expect(body.renders_total).toBe(3);
    expect(body.renders_last_7d).toBe(2);
    expect(body.renders_last_30d).toBe(3);
    expect(body.users_with_stripe_customer_id).toBe(1);
    // median of a 2h and a 4h time-to-first-render
    expect(body.median_hours_signup_to_first_render).toBeCloseTo(3, 1);
    expect(new Date(body.generated_at).toString()).not.toBe('Invalid Date');
  });

  it('returns zeros and a null median on an empty database', async () => {
    const app = await createApp();
    const res = await getStats(app, 'test_admin_secret');
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.users_total).toBe(0);
    expect(body.users_by_plan).toEqual({ free: 0, starter: 0, pro: 0, scale: 0 });
    expect(body.activated_users_total).toBe(0);
    expect(body.renders_total).toBe(0);
    expect(body.users_with_stripe_customer_id).toBe(0);
    expect(body.median_hours_signup_to_first_render).toBeNull();
  });

  it('never mutates data', async () => {
    const user = seedUser('read-only@example.com', 'free', 10);
    seedRender(user.user.id, user.apiKey.id, 5);
    const db = getDb();
    const snapshot = () =>
      db.prepare('SELECT plan, calls_used, period_start, created_at FROM users WHERE id = ?').get(user.user.id);
    const before = snapshot();
    const rendersBefore = db.prepare('SELECT COUNT(*) as count FROM render_history').get();

    const app = await createApp();
    expect((await getStats(app, 'test_admin_secret')).status).toBe(200);

    expect(snapshot()).toEqual(before);
    expect(db.prepare('SELECT COUNT(*) as count FROM render_history').get()).toEqual(rendersBefore);
  });

  it('returns 401 without admin secret', async () => {
    const app = await createApp();
    const res = await getStats(app);
    expect(res.status).toBe(401);
  });

  it('returns 401 with wrong secret', async () => {
    const app = await createApp();
    const res = await getStats(app, 'wrong_secret');
    expect(res.status).toBe(401);
  });

  it('returns 500 when ADMIN_CRON_SECRET not configured', async () => {
    delete process.env.ADMIN_CRON_SECRET;
    const app = await createApp();
    const res = await getStats(app, 'anything');
    expect(res.status).toBe(500);
  });
});

function getPriceCheck(app: Hono, secret?: string) {
  const headers: Record<string, string> = {};
  if (secret) headers.Authorization = `Bearer ${secret}`;
  return app.request('/admin/stripe-price-check', { method: 'GET', headers });
}

// The charging side of the money path lives in the Stripe dashboard and the
// provisioning side lives in the env vars. Nothing compares them, which is how
// a price id can drift silently. This endpoint is that comparison.
describe('GET /admin/stripe-price-check', () => {
  it('reports ok for every tier when the configured ids resolve correctly', async () => {
    const app = await createApp();
    const res = await getPriceCheck(app, 'test_admin_secret');

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.checks.map((c: { plan: string; status: string }) => [c.plan, c.status])).toEqual([
      ['starter', 'ok'],
      ['pro', 'ok'],
      ['scale', 'ok'],
    ]);
    // Covers Scale, which has no Payment Link and so cannot be checked any
    // other way without a credential.
    expect(body.checks[2].priceId).toBe('price_scale');
  });

  it('flags a price id Stripe has never heard of', async () => {
    process.env.STRIPE_PRICE_PRO = 'price_archived_and_recreated';
    const app = await createApp();
    const res = await getPriceCheck(app, 'test_admin_secret');

    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.ok).toBe(false);
    const pro = body.checks.find((c: { plan: string }) => c.plan === 'pro');
    expect(pro.status).toBe('not_found');
    expect(pro.priceId).toBe('price_archived_and_recreated');
  });

  it('flags a tier whose env var is unset', async () => {
    delete process.env.STRIPE_PRICE_SCALE;
    const app = await createApp();
    const res = await getPriceCheck(app, 'test_admin_secret');

    expect(res.status).toBe(503);
    const body = await res.json();
    const scale = body.checks.find((c: { plan: string }) => c.plan === 'scale');
    expect(scale.status).toBe('not_configured');
    expect(scale.priceId).toBeNull();
  });

  it('flags a price that resolves but is archived or priced wrong', async () => {
    stripePrices.retrieve = async (id) => {
      if (id === 'price_starter') return { ...livePrice(id, 1500), active: false };
      if (id === 'price_pro') return livePrice(id, 3900);
      if (id === 'price_scale') return { ...livePrice(id, 9900), currency: 'usd' };
      throw resourceMissing(id);
    };

    const app = await createApp();
    const res = await getPriceCheck(app, 'test_admin_secret');

    expect(res.status).toBe(503);
    const body = await res.json();
    const starter = body.checks.find((c: { plan: string }) => c.plan === 'starter');
    expect(starter.status).toBe('mismatch');
    expect(starter.problems).toEqual(['Price is archived in Stripe.', 'Price is 1500 minor units, expected 1000.']);
    const scale = body.checks.find((c: { plan: string }) => c.plan === 'scale');
    expect(scale.problems).toEqual(['Price is in usd, expected eur.']);
  });

  it('never echoes the Stripe secret key', async () => {
    const app = await createApp();
    const res = await getPriceCheck(app, 'test_admin_secret');
    expect(await res.text()).not.toContain('sk_test_123');
  });

  it('returns 401 without the admin secret', async () => {
    const app = await createApp();
    expect((await getPriceCheck(app)).status).toBe(401);
    expect((await getPriceCheck(app, 'wrong_secret')).status).toBe(401);
  });
});
