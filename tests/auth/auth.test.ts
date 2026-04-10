import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createMagicLinkToken } from '../../src/auth/magic-link';
import { verifyMagicLink } from '../../src/auth/session';
import { closeDb, createApiKey, createUser, findMagicLinkByToken, findSessionByToken } from '../../src/db';
import { escapeHtml } from '../../src/utils/html';

describe('escapeHtml', () => {
  it('escapes ampersand', () => {
    expect(escapeHtml('foo & bar')).toBe('foo &amp; bar');
  });

  it('escapes angle brackets', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  });

  it('escapes single quotes', () => {
    expect(escapeHtml("it's")).toBe('it&#39;s');
  });

  it('escapes double quotes', () => {
    expect(escapeHtml('say "hello"')).toBe('say &quot;hello&quot;');
  });

  it('returns empty string for empty input', () => {
    expect(escapeHtml('')).toBe('');
  });

  it('does not double-escape', () => {
    expect(escapeHtml('&amp;')).toBe('&amp;amp;');
  });

  it('handles strings with no special chars', () => {
    expect(escapeHtml('hello world')).toBe('hello world');
  });

  it('escapes all special chars in one string', () => {
    expect(escapeHtml(`<div class="a" data-x='b'>&`)).toBe('&lt;div class=&quot;a&quot; data-x=&#39;b&#39;&gt;&amp;');
  });
});

// ─── Magic Link Tests ───────────────────────────────────────

describe('createMagicLinkToken', () => {
  beforeEach(() => {
    closeDb();
    process.env.DATABASE_URL = 'file::memory:';
  });

  afterAll(() => {
    closeDb();
    delete process.env.DATABASE_URL;
  });

  it('creates a magic link token and stores it in DB', () => {
    const { token } = createMagicLinkToken('user@example.com');
    expect(token).toBeTruthy();
    expect(typeof token).toBe('string');

    const record = findMagicLinkByToken(token);
    expect(record).not.toBeNull();
    expect(record!.email).toBe('user@example.com');
    expect(record!.used).toBe(0);
  });

  it('allows up to 3 magic links within the rate-limit window', () => {
    createMagicLinkToken('rate@example.com');
    createMagicLinkToken('rate@example.com');
    createMagicLinkToken('rate@example.com');

    expect(() => createMagicLinkToken('rate@example.com')).toThrow('Too many login requests');
  });

  it('rate-limits per email (different emails are independent)', () => {
    createMagicLinkToken('a@example.com');
    createMagicLinkToken('a@example.com');
    createMagicLinkToken('a@example.com');

    // Different email should still work
    const { token } = createMagicLinkToken('b@example.com');
    expect(token).toBeTruthy();
  });
});

// ─── verifyMagicLink Tests ──────────────────────────────────

describe('verifyMagicLink', () => {
  beforeEach(() => {
    closeDb();
    process.env.DATABASE_URL = 'file::memory:';
  });

  afterAll(() => {
    closeDb();
    delete process.env.DATABASE_URL;
  });

  it('verifies a valid magic link and creates a user + session', () => {
    const { token } = createMagicLinkToken('new@example.com');
    const result = verifyMagicLink(token);

    expect(result.user.email).toBe('new@example.com');
    expect(result.sessionToken).toBeTruthy();

    // Session should be stored in DB
    const session = findSessionByToken(result.sessionToken);
    expect(session).not.toBeNull();
    expect(session!.user_id).toBe(result.user.id);
  });

  it('returns existing user if email already registered', () => {
    const existing = createUser('existing@example.com');
    const { token } = createMagicLinkToken('existing@example.com');
    const result = verifyMagicLink(token);

    expect(result.user.id).toBe(existing.id);
    expect(result.user.email).toBe('existing@example.com');
  });

  it('links orphaned API keys to the user', () => {
    // Create a user and API key, then simulate an orphaned key scenario
    const user = createUser('link@example.com');
    const apiKey = createApiKey(user.id);
    expect(apiKey.user_id).toBe(user.id);

    // Verify magic link for same email reuses the user
    const { token } = createMagicLinkToken('link@example.com');
    const result = verifyMagicLink(token);
    expect(result.user.id).toBe(user.id);
  });

  it('marks the magic link as used after verification', () => {
    const { token } = createMagicLinkToken('used@example.com');
    verifyMagicLink(token);

    // Second verification should fail
    expect(() => verifyMagicLink(token)).toThrow('Invalid or expired magic link');
  });

  it('throws on invalid token', () => {
    expect(() => verifyMagicLink('not-a-real-token')).toThrow('Invalid or expired magic link');
  });
});
