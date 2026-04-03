import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  closeDb,
  createApiKey,
  findApiKeyByEmail,
  findApiKeyByKey,
  generateApiKey,
  getDb,
  getUsageStats,
  incrementUsage,
  logUsage,
  PLAN_LIMITS,
  resetUsage,
  updatePlan,
} from '../../src/db';

// Use in-memory database for tests
beforeEach(() => {
  closeDb();
  // Point to in-memory DB via env
  process.env.DATABASE_URL = 'file::memory:';
});

afterAll(() => {
  closeDb();
  delete process.env.DATABASE_URL;
});

describe('database', () => {
  it('creates tables on first access', () => {
    const db = getDb();
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[];
    const names = tables.map((t) => t.name);
    expect(names).toContain('api_keys');
    expect(names).toContain('usage_log');
  });
});

describe('generateApiKey', () => {
  it('generates key with oge_sk_ prefix', () => {
    const key = generateApiKey();
    expect(key.startsWith('oge_sk_')).toBe(true);
    expect(key.length).toBeGreaterThan(7);
  });
});

describe('API key CRUD', () => {
  it('creates and retrieves a free tier key', () => {
    const record = createApiKey('test@example.com');
    expect(record.plan).toBe('free');
    expect(record.calls_limit).toBe(500);
    expect(record.calls_used).toBe(0);
    expect(record.key.startsWith('oge_sk_')).toBe(true);

    const found = findApiKeyByKey(record.key);
    expect(found).not.toBeNull();
    expect(found!.email).toBe('test@example.com');
  });

  it('finds by email', () => {
    createApiKey('lookup@example.com');
    const found = findApiKeyByEmail('lookup@example.com');
    expect(found).not.toBeNull();
  });

  it('returns null for unknown key', () => {
    expect(findApiKeyByKey('oge_sk_nonexistent')).toBeNull();
  });

  it('increments usage', () => {
    const record = createApiKey('inc@example.com');
    incrementUsage(record.id);
    incrementUsage(record.id);
    const updated = findApiKeyByKey(record.key);
    expect(updated!.calls_used).toBe(2);
  });

  it('updates plan and limits', () => {
    const record = createApiKey('upgrade@example.com');
    updatePlan(record.id, 'pro');
    const updated = findApiKeyByKey(record.key);
    expect(updated!.plan).toBe('pro');
    expect(updated!.calls_limit).toBe(PLAN_LIMITS.pro);
  });

  it('resets usage', () => {
    const record = createApiKey('reset@example.com');
    incrementUsage(record.id);
    incrementUsage(record.id);
    resetUsage(record.id);
    const updated = findApiKeyByKey(record.key);
    expect(updated!.calls_used).toBe(0);
  });
});

describe('usage logging', () => {
  it('logs and retrieves usage stats', () => {
    const record = createApiKey('log@example.com');
    logUsage(record.id, '/render', 12.5, 'og');
    logUsage(record.id, '/render', 8.3, 'twitter');
    logUsage(record.id, '/render/batch', 45.0, 'og');

    const stats = getUsageStats(record.id);
    expect(stats.total).toBe(3);
    expect(stats.byEndpoint['/render']).toBe(2);
    expect(stats.byEndpoint['/render/batch']).toBe(1);
    expect(stats.byFormat.og).toBe(2);
    expect(stats.byFormat.twitter).toBe(1);
  });
});
