import { Hono } from 'hono';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { usageRoute } from '../../src/api/usage';
import { closeDb, createApiKey, createUser, incrementUsage, logUsage } from '../../src/db';
import { authMiddleware } from '../../src/middleware/auth';

beforeEach(() => {
  closeDb();
  process.env.DATABASE_URL = 'file::memory:';
});

afterAll(() => {
  closeDb();
  delete process.env.DATABASE_URL;
});

function createApp() {
  const app = new Hono();
  app.use('/usage', authMiddleware());
  app.route('/', usageRoute);
  return app;
}

describe('GET /usage', () => {
  it('returns 401 without auth', async () => {
    const app = createApp();
    const res = await app.request('/usage');
    expect(res.status).toBe(401);
  });

  it('returns usage stats with valid auth', async () => {
    const user = createUser('usage@example.com');
    const record = createApiKey(user.id);
    incrementUsage(user.id);
    logUsage(record.id, '/render', 10.0, 'og');

    const app = createApp();
    const res = await app.request('/usage', {
      headers: { Authorization: `Bearer ${record.key}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.plan).toBe('free');
    expect(body.quota.limit).toBe(500);
    expect(body.quota.used).toBe(1);
    expect(body.quota.remaining).toBe(499);
    expect(body.usage.total).toBe(1);
  });

  it('returns 401 for invalid key', async () => {
    const app = createApp();
    const res = await app.request('/usage', {
      headers: { Authorization: 'Bearer oge_sk_invalid' },
    });
    expect(res.status).toBe(401);
  });
});
