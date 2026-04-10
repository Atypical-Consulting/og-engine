import { Hono } from 'hono';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, createApiKey, createUser, findUserByEmail, getDb } from '../../src/db';

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
