import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Hono } from 'hono';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { adminRoute } from '../../src/api/admin';
import { closeDb, countErrors, ERROR_LOG_MAX_ROWS, getDb, listErrors, logError } from '../../src/db';
import { openDatabase } from '../../src/db/sqlite';
import { errorHandler } from '../../src/middleware/error-handler';

const TOKEN = 'test_error_log_token';

beforeEach(() => {
  closeDb();
  process.env.DATABASE_URL = 'file::memory:';
  process.env.ERROR_LOG_TOKEN = TOKEN;
  // The handler console.errors every failure on purpose; keep the suite readable.
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(() => {
  closeDb();
  delete process.env.DATABASE_URL;
  delete process.env.ERROR_LOG_TOKEN;
});

/** A bare app wired exactly like src/index.ts: the global onError plus /admin. */
function createApp() {
  const app = new Hono();
  app.route('/', adminRoute);
  app.get('/boom', () => {
    throw new Error('deliberate explosion');
  });
  app.get('/leaky', () => {
    throw new Error('failed for oge_sk_deadbeefdeadbeefdeadbeef (user alice@example.com)');
  });
  app.onError(errorHandler);
  return app;
}

function getErrors(app: Hono, token?: string, query = '') {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  return app.request(`/admin/errors${query}`, { method: 'GET', headers });
}

describe('error_log schema', () => {
  it('is created on a fresh database', () => {
    const table = getDb().prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'error_log'").get();
    expect(table).toEqual({ name: 'error_log' });
    expect(countErrors()).toBe(0);
  });

  it('is created on an existing production-shaped volume that predates the table', () => {
    // A real volume already holds users/api_keys/render_history and rows.
    // CREATE TABLE IF NOT EXISTS must add error_log without touching them.
    const dir = mkdtempSync(join(tmpdir(), 'og-error-log-'));
    const dbPath = join(dir, 'og-engine.db');
    try {
      const seed = openDatabase(dbPath);
      seed.exec(`
        CREATE TABLE users (
          id TEXT PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          plan TEXT NOT NULL DEFAULT 'free',
          stripe_customer_id TEXT,
          stripe_subscription_id TEXT,
          calls_limit INTEGER NOT NULL DEFAULT 500,
          calls_used INTEGER NOT NULL DEFAULT 0,
          period_start TEXT NOT NULL,
          created_at TEXT NOT NULL,
          active INTEGER NOT NULL DEFAULT 1
        );
        CREATE TABLE api_keys (
          id TEXT PRIMARY KEY,
          key TEXT UNIQUE NOT NULL,
          email TEXT NOT NULL,
          user_id TEXT,
          created_at TEXT NOT NULL,
          active INTEGER NOT NULL DEFAULT 1
        );
      `);
      seed
        .prepare(
          'INSERT INTO users (id, email, plan, calls_limit, calls_used, period_start, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        )
        .run('u1', 'paying@example.com', 'pro', 50_000, 4321, '2026-09-01', '2026-08-01');
      seed.close();

      closeDb();
      process.env.DATABASE_URL = `file:${dbPath}`;

      const d = getDb();
      expect(d.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'error_log'").get()).toEqual({
        name: 'error_log',
      });
      // Pre-existing data survived the boot.
      expect(d.prepare('SELECT calls_used FROM users WHERE id = ?').get('u1')).toEqual({ calls_used: 4321 });
      expect(countErrors()).toBe(0);
    } finally {
      closeDb();
      process.env.DATABASE_URL = 'file::memory:';
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('global error handler', () => {
  it('writes exactly one row with the real stack trace and returns its request_id', async () => {
    const app = createApp();
    const res = await app.request('/boom');

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('server_error');
    expect(body.request_id).toMatch(/^[0-9a-f]{8}$/);

    const rows = listErrors(50);
    expect(rows).toHaveLength(1);
    expect(rows[0].request_id).toBe(body.request_id);
    expect(rows[0].method).toBe('GET');
    expect(rows[0].path).toBe('/boom');
    expect(rows[0].status).toBe(500);
    expect(rows[0].message).toBe('deliberate explosion');
    expect(rows[0].stack).toContain('Error: deliberate explosion');
    expect(rows[0].stack).toContain('errors.test.ts');
  });

  it('redacts api keys and customer emails out of the stored message and stack', async () => {
    const app = createApp();
    const res = await app.request('/leaky');
    expect(res.status).toBe(500);

    const row = listErrors(1)[0];
    expect(row.message).not.toContain('oge_sk_deadbeefdeadbeefdeadbeef');
    expect(row.message).toContain('oge_sk_[redacted]');
    expect(row.message).not.toContain('alice@example.com');
    expect(row.message).toContain('a***@example.com');
    expect(row.stack).not.toContain('oge_sk_deadbeefdeadbeefdeadbeef');
  });

  it('still returns a clean 500 when the logging write itself fails', async () => {
    const app = createApp();
    // Simulate the logging layer being broken: the insert target is gone.
    getDb().exec('DROP TABLE error_log');

    const res = await app.request('/boom');

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('server_error');
    expect(body.request_id).toMatch(/^[0-9a-f]{8}$/);
    // Process is alive and the next request is still served.
    expect((await app.request('/boom')).status).toBe(500);
  });

  it('caps the table at the most recent 500 rows', () => {
    for (let i = 0; i < 600; i++) {
      logError({ method: 'GET', path: '/boom', status: 500, message: `error ${i}`, requestId: `req${i}` });
    }

    expect(countErrors()).toBe(ERROR_LOG_MAX_ROWS);
    const rows = listErrors(ERROR_LOG_MAX_ROWS);
    expect(rows[0].message).toBe('error 599');
    expect(rows[rows.length - 1].message).toBe('error 100');
  });
});

describe('GET /admin/errors', () => {
  it('returns the stored errors with a valid bearer token', async () => {
    const app = createApp();
    const boom = await (await app.request('/boom')).json();

    const res = await getErrors(app, TOKEN);
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.limit).toBe(20);
    expect(body.stored).toBe(1);
    expect(body.max_stored).toBe(ERROR_LOG_MAX_ROWS);
    expect(body.errors).toHaveLength(1);
    expect(body.errors[0].request_id).toBe(boom.request_id);
    expect(body.errors[0].message).toBe('deliberate explosion');
  });

  it('returns 401 without a token', async () => {
    expect((await getErrors(createApp())).status).toBe(401);
  });

  it('returns 401 with the wrong token', async () => {
    expect((await getErrors(createApp(), 'wrong_token')).status).toBe(401);
  });

  it('does not accept ADMIN_CRON_SECRET', async () => {
    process.env.ADMIN_CRON_SECRET = 'some_cron_secret';
    try {
      expect((await getErrors(createApp(), 'some_cron_secret')).status).toBe(401);
    } finally {
      delete process.env.ADMIN_CRON_SECRET;
    }
  });

  it('returns 500 when ERROR_LOG_TOKEN is not configured', async () => {
    delete process.env.ERROR_LOG_TOKEN;
    try {
      expect((await getErrors(createApp(), 'anything')).status).toBe(500);
    } finally {
      process.env.ERROR_LOG_TOKEN = TOKEN;
    }
  });

  it('clamps limit to the retained window and newest first', async () => {
    const app = createApp();
    for (let i = 0; i < 5; i++) {
      logError({ method: 'GET', path: '/boom', status: 500, message: `error ${i}`, requestId: `req${i}` });
    }

    const two = await (await getErrors(app, TOKEN, '?limit=2')).json();
    expect(two.errors.map((e: { message: string }) => e.message)).toEqual(['error 4', 'error 3']);

    const clamped = await (await getErrors(app, TOKEN, '?limit=99999')).json();
    expect(clamped.limit).toBe(ERROR_LOG_MAX_ROWS);

    const nonsense = await (await getErrors(app, TOKEN, '?limit=abc')).json();
    expect(nonsense.limit).toBe(20);

    const zero = await (await getErrors(app, TOKEN, '?limit=0')).json();
    expect(zero.limit).toBe(1);
  });
});
