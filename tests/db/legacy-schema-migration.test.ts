import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerRoute } from '../../src/api/register';
import { closeDb, countRecentMagicLinks, findApiKeyByKey, findUserByEmail, getDb } from '../../src/db';
import { openDatabase } from '../../src/db/sqlite';

vi.mock('../../src/email/send', () => ({
  sendWelcomeEmail: vi.fn().mockResolvedValue(undefined),
}));

// ATY-78: production ran on a SQLite volume created at commit 1b80f16, before
// quotas moved to a `users` table. `CREATE TABLE IF NOT EXISTS` is a silent
// no-op against it, so the volume kept the old `api_keys` shape forever and
// every signup 500'd on `no column named user_id`.
const LEGACY_API_KEYS_SCHEMA = `
  CREATE TABLE api_keys (
    id TEXT PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    email TEXT NOT NULL,
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    plan TEXT NOT NULL DEFAULT 'free',
    calls_limit INTEGER NOT NULL DEFAULT 500,
    calls_used INTEGER NOT NULL DEFAULT 0,
    period_start TEXT NOT NULL,
    created_at TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1
  );
  CREATE INDEX IF NOT EXISTS idx_api_keys_key ON api_keys(key);
`;

const PAYING_KEY = 'oge_sk_legacypayingcustomer00000000';
const FREE_KEY = 'oge_sk_legacyfreecustomer000000000';

let dir: string;
let dbPath: string;

/** Writes a SQLite file in the pre-`users` shape, with real customer rows in it. */
function seedLegacyVolume(): void {
  const d = openDatabase(dbPath);
  d.exec(LEGACY_API_KEYS_SCHEMA);
  const insert = d.prepare(`
    INSERT INTO api_keys (id, key, email, stripe_customer_id, stripe_subscription_id, plan, calls_limit, calls_used, period_start, created_at, active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insert.run(
    'k1',
    PAYING_KEY,
    'paying@example.com',
    'cus_123',
    'sub_123',
    'pro',
    50_000,
    4321,
    '2026-09-01',
    '2026-08-01',
    1,
  );
  insert.run('k2', FREE_KEY, 'free@example.com', null, null, 'free', 500, 12, '2026-09-01', '2026-08-02', 1);
  d.close();
}

const app = new Hono();
app.route('/', registerRoute);

function register(email: string) {
  return app.request('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
}

beforeEach(() => {
  closeDb();
  dir = mkdtempSync(join(tmpdir(), 'og-engine-aty78-'));
  dbPath = join(dir, 'og-engine.db');
  seedLegacyVolume();
  process.env.DATABASE_URL = `file:${dbPath}`;
});

afterEach(() => {
  closeDb();
  delete process.env.DATABASE_URL;
  rmSync(dir, { recursive: true, force: true });
});

describe('legacy volume migration (ATY-78)', () => {
  // This is the load-bearing one: it fails the moment /auth/register stops
  // handing back a key, which is what took the whole funnel down.
  it('POST /auth/register returns an API key on a pre-`users` volume', async () => {
    const res = await register('newsignup@example.com');
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.apiKey).toMatch(/^oge_sk_/);
    expect(body.plan).toBe('free');
    expect(body.limit).toBe(500);
  });

  it('keeps existing API keys working after the rebuild', () => {
    getDb();
    expect(findApiKeyByKey(PAYING_KEY)?.email).toBe('paying@example.com');
    expect(findApiKeyByKey(FREE_KEY)?.email).toBe('free@example.com');
  });

  it("carries each legacy key's plan and usage onto a users row", () => {
    getDb();

    const paying = findUserByEmail('paying@example.com');
    expect(paying?.plan).toBe('pro');
    expect(paying?.calls_limit).toBe(50_000);
    expect(paying?.calls_used).toBe(4321);
    expect(paying?.stripe_customer_id).toBe('cus_123');
    expect(paying?.stripe_subscription_id).toBe('sub_123');

    const free = findUserByEmail('free@example.com');
    expect(free?.plan).toBe('free');
    expect(free?.calls_used).toBe(12);
  });

  it('links every migrated key to its user', () => {
    getDb();
    const paying = findUserByEmail('paying@example.com');
    expect(findApiKeyByKey(PAYING_KEY)?.user_id).toBe(paying?.id);
  });

  it('creates the tables the aborted migration never reached', () => {
    const d = getDb();
    const tables = (d.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[]).map(
      (r) => r.name,
    );
    // The old migration died on `CREATE INDEX … ON api_keys(user_id)`, so
    // everything declared after that point was never created — which is why
    // POST /auth/send-link 500'd too.
    expect(tables).toEqual(expect.arrayContaining(['sessions', 'magic_links', 'render_history', 'webhooks']));
    expect(() => countRecentMagicLinks('someone@example.com')).not.toThrow();
  });

  it('keeps the pre-migration rows as a rollback path', () => {
    const d = getDb();
    const backup = d.prepare('SELECT key, plan FROM api_keys_backup_aty78 ORDER BY key').all() as {
      key: string;
      plan: string;
    }[];
    expect(backup).toEqual([
      { key: FREE_KEY, plan: 'free' },
      { key: PAYING_KEY, plan: 'pro' },
    ]);
  });

  it('is idempotent across restarts', async () => {
    getDb();
    closeDb(); // simulate a redeploy against the already-migrated volume
    const res = await register('second-boot@example.com');
    expect(res.status).toBe(201);

    const d = getDb();
    const users = (d.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }).count;
    expect(users).toBe(3); // the two migrated accounts plus the new signup
  });
});
