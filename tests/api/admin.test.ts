import { Hono } from 'hono';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, createApiKey, findApiKeyByEmail, getDb } from '../../src/db';

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
    const free1 = createApiKey('free1@example.com', 'free');
    const free2 = createApiKey('free2@example.com', 'free');
    const paid = createApiKey('paid@example.com', 'pro');

    const db = getDb();
    db.prepare('UPDATE api_keys SET calls_used = 100 WHERE id = ?').run(free1.id);
    db.prepare('UPDATE api_keys SET calls_used = 200 WHERE id = ?').run(free2.id);
    db.prepare('UPDATE api_keys SET calls_used = 300 WHERE id = ?').run(paid.id);

    const app = await createApp();
    const res = await postReset(app, 'test_admin_secret');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.reset).toBe(2);

    expect(findApiKeyByEmail('free1@example.com')!.calls_used).toBe(0);
    expect(findApiKeyByEmail('free2@example.com')!.calls_used).toBe(0);
    expect(findApiKeyByEmail('paid@example.com')!.calls_used).toBe(300);
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
