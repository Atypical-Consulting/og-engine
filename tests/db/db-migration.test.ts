import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  closeDb,
  countRecentMagicLinks,
  createApiKey,
  createMagicLink,
  createSession,
  createUser,
  deleteSession,
  findMagicLinkByToken,
  findSessionByToken,
  findUserByApiKey,
  findUserByEmail,
  findUserById,
  getDailyUsage,
  getDb,
  getRenderHistory,
  getUsageStats,
  incrementUsage,
  logRender,
  markMagicLinkUsed,
  purgeExpiredMagicLinks,
  purgeExpiredSessions,
} from '../../src/db';

// Use in-memory database for tests
beforeEach(() => {
  closeDb();
  process.env.DATABASE_URL = 'file::memory:';
});

afterEach(() => {
  closeDb();
  delete process.env.DATABASE_URL;
});

describe('users table migration', () => {
  it('creates users table on first access', () => {
    const db = getDb();
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[];
    const names = tables.map((t) => t.name);
    expect(names).toContain('users');
  });

  it('creates index on users.email', () => {
    const db = getDb();
    const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='users'").all() as {
      name: string;
    }[];
    const indexNames = indexes.map((i) => i.name);
    expect(indexNames).toContain('idx_users_email');
  });
});

describe('createUser', () => {
  it('creates a user and retrieves by email', () => {
    const user = createUser('user@example.com');
    expect(user.email).toBe('user@example.com');
    expect(user.plan).toBe('free');
    expect(user.calls_limit).toBe(500);
    expect(user.calls_used).toBe(0);
    expect(user.active).toBe(1);
    expect(user.id).toBeTruthy();

    const found = findUserByEmail('user@example.com');
    expect(found).not.toBeNull();
    expect(found!.id).toBe(user.id);
    expect(found!.email).toBe('user@example.com');
  });

  it('creates a user with a specified plan', () => {
    const user = createUser('pro@example.com', 'pro');
    expect(user.plan).toBe('pro');
    expect(user.calls_limit).toBe(50_000);
  });

  it('enforces unique email constraint', () => {
    createUser('duplicate@example.com');
    expect(() => createUser('duplicate@example.com')).toThrow();
  });
});

describe('findUserByEmail', () => {
  it('returns null for unknown email', () => {
    const found = findUserByEmail('nobody@example.com');
    expect(found).toBeNull();
  });

  it('returns the correct user', () => {
    createUser('alpha@example.com');
    createUser('beta@example.com');

    const found = findUserByEmail('beta@example.com');
    expect(found).not.toBeNull();
    expect(found!.email).toBe('beta@example.com');
  });
});

describe('findUserById', () => {
  it('retrieves user by id', () => {
    const user = createUser('byid@example.com');
    const found = findUserById(user.id);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(user.id);
    expect(found!.email).toBe('byid@example.com');
  });

  it('returns null for unknown id', () => {
    const found = findUserById('00000000-0000-0000-0000-000000000000');
    expect(found).toBeNull();
  });
});

describe('API key linked to user', () => {
  it('creates API key linked to user', () => {
    const user = createUser('linked@example.com');
    const key = createApiKey(user.id);
    expect(key.user_id).toBe(user.id);
    expect(key.email).toBe('linked@example.com');
  });

  it('finds user by API key id', () => {
    const user = createUser('findbykey@example.com');
    const key = createApiKey(user.id);
    const found = findUserByApiKey(key.id);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(user.id);
    expect(found!.email).toBe('findbykey@example.com');
  });

  it('incrementUsage works on user level', () => {
    const user = createUser('increment@example.com');
    createApiKey(user.id);
    incrementUsage(user.id);
    incrementUsage(user.id);
    incrementUsage(user.id);
    const updated = findUserById(user.id);
    expect(updated!.calls_used).toBe(3);
  });

  it('api_keys table has user_id index', () => {
    const db = getDb();
    const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='api_keys'").all() as {
      name: string;
    }[];
    const indexNames = indexes.map((i) => i.name);
    expect(indexNames).toContain('idx_api_keys_user_id');
  });
});

describe('sessions', () => {
  it('creates and retrieves a session by token', () => {
    const user = createUser('session-user@example.com');
    const token = 'my-secret-token-1';
    const session = createSession(user.id, token);

    expect(session.user_id).toBe(user.id);
    expect(session.csrf_token).toBeTruthy();
    expect(session.expires_at).toBeTruthy();

    const found = findSessionByToken(token);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(session.id);
    expect(found!.user_id).toBe(user.id);
    // token_hash should not be the raw token
    expect(found!.token_hash).not.toBe(token);
  });

  it('deletes a session by token', () => {
    const user = createUser('session-delete@example.com');
    const token = 'delete-me-token';
    createSession(user.id, token);

    deleteSession(token);

    const found = findSessionByToken(token);
    expect(found).toBeNull();
  });

  it('returns null for expired session', () => {
    const user = createUser('session-expired@example.com');
    const token = 'expired-session-token';
    // Insert a session with a past expiry directly
    const db = getDb();
    const session = createSession(user.id, token);
    db.prepare('UPDATE sessions SET expires_at = ? WHERE id = ?').run('2000-01-01 00:00:00', session.id);

    const found = findSessionByToken(token);
    expect(found).toBeNull();
  });

  it('purges expired sessions and returns count', () => {
    const user = createUser('session-purge@example.com');
    const db = getDb();

    const s1 = createSession(user.id, 'purge-token-1');
    const s2 = createSession(user.id, 'purge-token-2');
    createSession(user.id, 'purge-token-3'); // keep this one

    db.prepare('UPDATE sessions SET expires_at = ? WHERE id IN (?, ?)').run('2000-01-01 00:00:00', s1.id, s2.id);

    const count = purgeExpiredSessions();
    expect(count).toBe(2);
  });
});

describe('magic_links', () => {
  it('creates and retrieves a magic link by token', () => {
    const token = 'magic-token-1';
    const link = createMagicLink('magic@example.com', token);

    expect(link.email).toBe('magic@example.com');
    expect(link.used).toBe(0);

    const found = findMagicLinkByToken(token);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(link.id);
    expect(found!.email).toBe('magic@example.com');
    expect(found!.token_hash).not.toBe(token);
  });

  it('marks a magic link as used', () => {
    const token = 'magic-token-used';
    createMagicLink('used@example.com', token);

    markMagicLinkUsed(token);

    const found = findMagicLinkByToken(token);
    expect(found).toBeNull();
  });

  it('returns null for expired magic link', () => {
    const token = 'magic-token-expired';
    // negative expiresInMinutes puts expiry in the past
    createMagicLink('expired@example.com', token, -5);

    const found = findMagicLinkByToken(token);
    expect(found).toBeNull();
  });

  it('counts recent magic links within window', () => {
    const email = 'rate-limit@example.com';
    createMagicLink(email, 'rl-token-1');
    createMagicLink(email, 'rl-token-2');
    createMagicLink(email, 'rl-token-3');

    const count = countRecentMagicLinks(email);
    expect(count).toBe(3);
  });

  it('returns 0 for magic links outside the window', () => {
    const email = 'old-links@example.com';
    const db = getDb();

    const link = createMagicLink(email, 'old-token-1');
    db.prepare('UPDATE magic_links SET created_at = ? WHERE id = ?').run('2000-01-01 00:00:00', link.id);

    const count = countRecentMagicLinks(email, 10);
    expect(count).toBe(0);
  });

  it('purges expired and used magic links and returns count', () => {
    createMagicLink('purge1@example.com', 'purge-ml-1', -5); // expired
    const link2 = createMagicLink('purge2@example.com', 'purge-ml-2');
    markMagicLinkUsed('purge-ml-2'); // used
    createMagicLink('purge3@example.com', 'purge-ml-3'); // keep this one

    const count = purgeExpiredMagicLinks();
    expect(count).toBeGreaterThanOrEqual(2);

    const kept = findMagicLinkByToken('purge-ml-3');
    expect(kept).not.toBeNull();
    void link2;
  });
});

describe('render_history', () => {
  it('logs a render and retrieves history', () => {
    const user = createUser('history@example.com');
    const key = createApiKey(user.id);

    logRender({
      userId: user.id,
      apiKeyId: key.id,
      endpoint: '/render',
      requestPayload: { format: 'og', template: 'default', title: 'Hello' },
      format: 'og',
      template: 'default',
      renderTimeMs: 22.5,
    });

    const history = getRenderHistory(user.id, { limit: 10, offset: 0 });
    expect(history).toHaveLength(1);
    const record = history[0];
    expect(record.user_id).toBe(user.id);
    expect(record.api_key_id).toBe(key.id);
    expect(record.endpoint).toBe('/render');
    expect(record.format).toBe('og');
    expect(record.template).toBe('default');
    expect(record.render_time_ms).toBe(22.5);
    expect(JSON.parse(record.request_payload)).toMatchObject({ title: 'Hello' });
    expect(record.id).toBeTruthy();
    expect(record.created_at).toBeTruthy();
  });

  it('returns usage stats from render_history', () => {
    const user = createUser('stats@example.com');
    const key = createApiKey(user.id);

    logRender({ userId: user.id, apiKeyId: key.id, endpoint: '/render', requestPayload: {}, format: 'og' });
    logRender({ userId: user.id, apiKeyId: key.id, endpoint: '/render', requestPayload: {}, format: 'og' });
    logRender({ userId: user.id, apiKeyId: key.id, endpoint: '/render/batch', requestPayload: {}, format: 'png' });

    const stats = getUsageStats(user.id);
    expect(stats.total).toBe(3);
    expect(stats.byEndpoint['/render']).toBe(2);
    expect(stats.byEndpoint['/render/batch']).toBe(1);
    expect(stats.byFormat['og']).toBe(2);
    expect(stats.byFormat['png']).toBe(1);
  });

  it('getDailyUsage returns daily counts', () => {
    const user = createUser('daily@example.com');
    const key = createApiKey(user.id);

    logRender({ userId: user.id, apiKeyId: key.id, endpoint: '/render', requestPayload: {}, format: 'og' });
    logRender({ userId: user.id, apiKeyId: key.id, endpoint: '/render', requestPayload: {}, format: 'og' });

    const daily = getDailyUsage(user.id, 7);
    expect(daily.length).toBeGreaterThanOrEqual(1);
    const todayEntry = daily[daily.length - 1];
    expect(todayEntry.count).toBe(2);
    expect(todayEntry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('isolates render_history by user', () => {
    const user1 = createUser('iso1@example.com');
    const user2 = createUser('iso2@example.com');
    const key1 = createApiKey(user1.id);
    const key2 = createApiKey(user2.id);

    logRender({ userId: user1.id, apiKeyId: key1.id, endpoint: '/render', requestPayload: {}, format: 'og' });
    logRender({ userId: user2.id, apiKeyId: key2.id, endpoint: '/render', requestPayload: {}, format: 'png' });

    const h1 = getRenderHistory(user1.id, { limit: 10, offset: 0 });
    const h2 = getRenderHistory(user2.id, { limit: 10, offset: 0 });
    expect(h1).toHaveLength(1);
    expect(h2).toHaveLength(1);
    expect(h1[0].format).toBe('og');
    expect(h2[0].format).toBe('png');
  });
});
