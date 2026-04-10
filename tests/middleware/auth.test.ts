import { Hono } from 'hono';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { type ApiKeyRecord, closeDb, createApiKey, createUser, updatePlan } from '../../src/db';
import { authMiddleware, canAccessFeature, optionalAuthMiddleware, planGate } from '../../src/middleware/auth';

beforeEach(() => {
  closeDb();
  process.env.DATABASE_URL = 'file::memory:';
});

afterAll(() => {
  closeDb();
  delete process.env.DATABASE_URL;
});

describe('authMiddleware', () => {
  function createApp() {
    const app = new Hono();
    app.use('/protected', authMiddleware());
    app.get('/protected', (c) => {
      const key = (c as any).get('apiKey') as ApiKeyRecord;
      return c.json({ email: key.email });
    });
    return app;
  }

  it('rejects request without auth header', async () => {
    const app = createApp();
    const res = await app.request('/protected');
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('unauthorized');
  });

  it('rejects request with invalid key', async () => {
    const app = createApp();
    const res = await app.request('/protected', {
      headers: { Authorization: 'Bearer oge_sk_invalid' },
    });
    expect(res.status).toBe(401);
  });

  it('accepts request with valid key', async () => {
    const user = createUser('auth@example.com');
    const record = createApiKey(user.id);
    const app = createApp();
    const res = await app.request('/protected', {
      headers: { Authorization: `Bearer ${record.key}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.email).toBe('auth@example.com');
  });

  it('rejects when quota exceeded', async () => {
    const user = createUser('quota@example.com');
    const record = createApiKey(user.id);
    // Exhaust quota by setting calls_used = calls_limit on the user
    const { getDb } = await import('../../src/db');
    getDb().prepare('UPDATE users SET calls_used = calls_limit WHERE id = ?').run(user.id);

    const app = createApp();
    const res = await app.request('/protected', {
      headers: { Authorization: `Bearer ${record.key}` },
    });
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toBe('quota_exceeded');
  });
});

describe('optionalAuthMiddleware', () => {
  function createApp() {
    const app = new Hono();
    app.use('/optional', optionalAuthMiddleware());
    app.get('/optional', (c) => {
      const key = (c as any).get('apiKey') as ApiKeyRecord | undefined;
      return c.json({ authenticated: !!key });
    });
    return app;
  }

  it('allows unauthenticated requests', async () => {
    const app = createApp();
    const res = await app.request('/optional');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.authenticated).toBe(false);
  });

  it('attaches key when provided', async () => {
    const user = createUser('opt@example.com');
    const record = createApiKey(user.id);
    const app = createApp();
    const res = await app.request('/optional', {
      headers: { Authorization: `Bearer ${record.key}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.authenticated).toBe(true);
  });
});

describe('planGate', () => {
  it('returns 402 when plan insufficient', async () => {
    const user = createUser('gate@example.com'); // free plan
    const record = createApiKey(user.id);
    const app = new Hono();
    app.use('/gated', authMiddleware(), planGate('batch'));
    app.get('/gated', (c) => c.text('ok'));

    const res = await app.request('/gated', {
      headers: { Authorization: `Bearer ${record.key}` },
    });
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.error).toBe('plan_required');
  });

  it('allows when plan is sufficient', async () => {
    const user = createUser('pro@example.com');
    const record = createApiKey(user.id);
    updatePlan(user.id, 'pro');
    const app = new Hono();
    app.use('/gated', authMiddleware(), planGate('batch'));
    app.get('/gated', (c) => c.text('ok'));

    const res = await app.request('/gated', {
      headers: { Authorization: `Bearer ${record.key}` },
    });
    expect(res.status).toBe(200);
  });
});

describe('canAccessFeature', () => {
  it('free plan cannot access webp', () => {
    expect(canAccessFeature('free', 'webp')).toBe(false);
  });

  it('starter plan can access webp', () => {
    expect(canAccessFeature('starter', 'webp')).toBe(true);
  });

  it('free plan cannot access batch', () => {
    expect(canAccessFeature('free', 'batch')).toBe(false);
  });

  it('pro plan can access batch', () => {
    expect(canAccessFeature('pro', 'batch')).toBe(true);
  });

  it('all plans can access ungated features', () => {
    expect(canAccessFeature('free', 'nonexistent')).toBe(true);
  });
});
