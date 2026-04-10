import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  closeDb,
  createApiKey,
  createUser,
  findApiKeyByEmail,
  findApiKeyByKey,
  findUserById,
  generateApiKey,
  getDb,
  getUsageStats,
  incrementUsage,
  logRender,
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
    expect(names).toContain('render_history');
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
  it('creates and retrieves a key linked to a user', () => {
    const user = createUser('test@example.com');
    const record = createApiKey(user.id);
    expect(record.user_id).toBe(user.id);
    expect(record.key.startsWith('oge_sk_')).toBe(true);

    const found = findApiKeyByKey(record.key);
    expect(found).not.toBeNull();
    expect(found!.email).toBe('test@example.com');
  });

  it('finds by email', () => {
    const user = createUser('lookup@example.com');
    createApiKey(user.id);
    const found = findApiKeyByEmail('lookup@example.com');
    expect(found).not.toBeNull();
  });

  it('returns null for unknown key', () => {
    expect(findApiKeyByKey('oge_sk_nonexistent')).toBeNull();
  });

  it('increments usage on user level', () => {
    const user = createUser('inc@example.com');
    createApiKey(user.id);
    incrementUsage(user.id);
    incrementUsage(user.id);
    const updated = findUserById(user.id);
    expect(updated!.calls_used).toBe(2);
  });

  it('updates plan and limits on user level', () => {
    const user = createUser('upgrade@example.com');
    createApiKey(user.id);
    updatePlan(user.id, 'pro');
    const updated = findUserById(user.id);
    expect(updated!.plan).toBe('pro');
    expect(updated!.calls_limit).toBe(PLAN_LIMITS.pro);
  });

  it('resets usage on user level', () => {
    const user = createUser('reset@example.com');
    createApiKey(user.id);
    incrementUsage(user.id);
    incrementUsage(user.id);
    resetUsage(user.id);
    const updated = findUserById(user.id);
    expect(updated!.calls_used).toBe(0);
  });
});

describe('usage logging', () => {
  it('logs and retrieves usage stats', () => {
    const user = createUser('log@example.com');
    const record = createApiKey(user.id);
    logRender({
      userId: user.id,
      apiKeyId: record.id,
      endpoint: '/render',
      requestPayload: {},
      format: 'og',
      renderTimeMs: 12.5,
    });
    logRender({
      userId: user.id,
      apiKeyId: record.id,
      endpoint: '/render',
      requestPayload: {},
      format: 'twitter',
      renderTimeMs: 8.3,
    });
    logRender({
      userId: user.id,
      apiKeyId: record.id,
      endpoint: '/render/batch',
      requestPayload: {},
      format: 'og',
      renderTimeMs: 45.0,
    });

    const stats = getUsageStats(user.id);
    expect(stats.total).toBe(3);
    expect(stats.byEndpoint['/render']).toBe(2);
    expect(stats.byEndpoint['/render/batch']).toBe(1);
    expect(stats.byFormat.og).toBe(2);
    expect(stats.byFormat.twitter).toBe(1);
  });
});
