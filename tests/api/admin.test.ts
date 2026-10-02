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
});

afterAll(() => {
  closeDb();
  delete process.env.DATABASE_URL;
  delete process.env.ADMIN_CRON_SECRET;
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
function seedRender(
  userId: string,
  apiKeyId: string,
  renderHoursAgo: number,
  requestPayload: object = {},
  endpoint = '/render',
) {
  logRender({ userId, apiKeyId, endpoint, requestPayload, format: 'og' });
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

  it('breaks renders down by plan x output format and reports what it could not attribute', async () => {
    // Explicit WebP from a free user — the render the paywall decision hinges on.
    const a = seedUser('webp@example.com', 'free', 240);
    seedRender(a.user.id, a.apiKey.id, 24, { output: { format: 'webp' } });
    // A real body with no `output` block: the schema defaults it to png, so this
    // is honestly attributed, not unattributed.
    const b = seedUser('plain@example.com', 'free', 240);
    seedRender(b.user.id, b.apiKey.id, 48, { title: 'Hello' });
    // No body captured at all — genuinely unattributable, lands in the png bucket.
    const c = seedUser('nobody@example.com', 'free', 240);
    seedRender(c.user.id, c.apiKey.id, 72, {});
    // Batch: the format lives per item, so the top-level lookup misses it.
    const dUser = seedUser('batch@example.com', 'free', 240);
    seedRender(
      dUser.user.id,
      dUser.apiKey.id,
      96,
      { items: [{ title: 'One', output: { format: 'webp' } }] },
      '/render/batch',
    );
    // PDF stays free on every plan; it should still show up in the breakdown.
    const e = seedUser('pdf@example.com', 'starter', 240);
    seedRender(e.user.id, e.apiKey.id, 24, { output: { format: 'pdf' } });
    // Outside the 30-day window — must not appear anywhere.
    const old = seedUser('stale@example.com', 'free', 2400);
    seedRender(old.user.id, old.apiKey.id, 45 * 24, { output: { format: 'webp' } });

    const app = await createApp();
    const res = await getStats(app, 'test_admin_secret');
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.renders_by_output_format).toEqual([
      { plan: 'free', output_format: 'png', renders: 3, users: 3 },
      { plan: 'free', output_format: 'webp', renders: 1, users: 1 },
      { plan: 'starter', output_format: 'pdf', renders: 1, users: 1 },
    ]);

    expect(body.output_format_attribution).toEqual({
      renders_last_30d: 5,
      renders_with_explicit_output_format: 2,
      renders_without_explicit_output_format: 3,
      empty_payload_renders: 1,
      batch_payload_renders: 1,
      unattributed_renders: 2,
      unattributed_share_pct: 40,
    });

    // N per plan: the explicit WebP user *and* the batch WebP user, which the
    // top-level breakdown above counts as png.
    expect(body.webp_users_by_plan).toEqual([{ plan: 'free', users: 2, renders: 2 }]);
  });

  it('reports no output-format rows and a null unattributed share on an empty database', async () => {
    const app = await createApp();
    const res = await getStats(app, 'test_admin_secret');
    const body = await res.json();

    expect(body.renders_by_output_format).toEqual([]);
    expect(body.webp_users_by_plan).toEqual([]);
    expect(body.output_format_attribution.renders_last_30d).toBe(0);
    expect(body.output_format_attribution.unattributed_share_pct).toBeNull();
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
