import { Hono } from 'hono';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
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

beforeEach(() => {
  closeDb();
  process.env.DATABASE_URL = 'file::memory:';
  process.env.ADMIN_CRON_SECRET = 'test_admin_secret';
  delete process.env.ADMIN_STATS_TOKEN;
});

afterAll(() => {
  closeDb();
  delete process.env.DATABASE_URL;
  delete process.env.ADMIN_CRON_SECRET;
  delete process.env.ADMIN_STATS_TOKEN;
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
    // one key per seeded user, all issued active
    expect(body.api_keys_total).toBe(4);
    expect(body.api_keys_active).toBe(4);
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
    expect(body.api_keys_total).toBe(0);
    expect(body.api_keys_active).toBe(0);
    expect(body.median_hours_signup_to_first_render).toBeNull();
  });

  it('counts revoked keys in api_keys_total but not in api_keys_active', async () => {
    const live = seedUser('live@example.com', 'free', 10);
    seedUser('revoked@example.com', 'free', 10);
    getDb().prepare('UPDATE api_keys SET active = 0 WHERE user_id != ?').run(live.user.id);

    const app = await createApp();
    const body = await (await getStats(app, 'test_admin_secret')).json();

    expect(body.api_keys_total).toBe(2);
    expect(body.api_keys_active).toBe(1);
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

  it('returns 500 when neither admin credential is configured', async () => {
    delete process.env.ADMIN_CRON_SECRET;
    const app = await createApp();
    const res = await getStats(app, 'anything');
    expect(res.status).toBe(500);
  });
});

/**
 * The whole point of ADMIN_STATS_TOKEN: a bearer that reads the funnel must not
 * also be able to reset every free quota and log out every session. If any of
 * these four start passing the wrong way, the read-only grant is no longer read-only.
 */
describe('admin token scoping', () => {
  const STATS_TOKEN = 'test_stats_token';

  beforeEach(() => {
    process.env.ADMIN_STATS_TOKEN = STATS_TOKEN;
  });

  it('accepts ADMIN_STATS_TOKEN on GET /admin/stats', async () => {
    const app = await createApp();
    const res = await getStats(app, STATS_TOKEN);
    expect(res.status).toBe(200);
    expect((await res.json()).users_total).toBe(0);
  });

  it('rejects ADMIN_STATS_TOKEN on POST /admin/reset-free-quotas with 401', async () => {
    const user = createUser('free@example.com', 'free');
    createApiKey(user.id);
    getDb().prepare('UPDATE users SET calls_used = 42 WHERE id = ?').run(user.id);

    const app = await createApp();
    const res = await postReset(app, STATS_TOKEN);
    expect(res.status).toBe(401);
    // the destructive side effect must not have run
    expect(findUserByEmail('free@example.com')!.calls_used).toBe(42);
  });

  it('still accepts ADMIN_CRON_SECRET on both routes', async () => {
    const app = await createApp();
    expect((await getStats(app, 'test_admin_secret')).status).toBe(200);
    expect((await postReset(app, 'test_admin_secret')).status).toBe(200);
  });

  it('rejects an unauthenticated caller on both routes', async () => {
    const app = await createApp();
    expect((await getStats(app)).status).toBe(401);
    expect((await postReset(app)).status).toBe(401);
  });

  it('serves stats on ADMIN_CRON_SECRET alone while the stats token is unset', async () => {
    delete process.env.ADMIN_STATS_TOKEN;
    const app = await createApp();
    expect((await getStats(app, 'test_admin_secret')).status).toBe(200);
  });

  it('does not authenticate an empty-string credential', async () => {
    process.env.ADMIN_STATS_TOKEN = '';
    const app = await createApp();
    expect((await getStats(app, '')).status).toBe(401);
  });

  it('serves stats on ADMIN_STATS_TOKEN alone while the cron secret is unset', async () => {
    delete process.env.ADMIN_CRON_SECRET;
    const app = await createApp();
    expect((await getStats(app, STATS_TOKEN)).status).toBe(200);
    // reset-free-quotas has no credential left to accept
    expect((await postReset(app, STATS_TOKEN)).status).toBe(500);
  });
});
