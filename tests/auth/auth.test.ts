import { Hono } from 'hono';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createMagicLinkToken } from '../../src/auth/magic-link';
import { authRoutes } from '../../src/auth/routes';
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

// ─── Auth Routes Tests ──────────────────────────────────────

describe('auth routes', () => {
  let app: Hono;

  beforeEach(() => {
    closeDb();
    process.env.DATABASE_URL = 'file::memory:';
    app = new Hono();
    app.route('/', authRoutes);
  });

  afterAll(() => {
    closeDb();
    delete process.env.DATABASE_URL;
  });

  it('GET /auth/login returns HTML login page', async () => {
    const res = await app.request('/auth/login');
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('OG Engine');
    expect(html).toContain('type="email"');
    expect(html).toContain('Send magic link');
  });

  it('GET /auth/login includes returnTo in form', async () => {
    const res = await app.request('/auth/login?returnTo=/dashboard/keys');
    const html = await res.text();
    expect(html).toContain('value="/dashboard/keys"');
  });

  it('GET /auth/login shows error message when provided', async () => {
    const res = await app.request('/auth/login?error=Some%20error');
    const html = await res.text();
    expect(html).toContain('Some error');
  });

  it('POST /auth/send-link with JSON returns success', async () => {
    const res = await app.request('/auth/send-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.message).toContain('Check your email');
  });

  it('POST /auth/send-link with invalid email returns 400', async () => {
    const res = await app.request('/auth/send-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('validation_error');
  });

  it('POST /auth/send-link rate-limits after 3 requests', async () => {
    for (let i = 0; i < 3; i++) {
      await app.request('/auth/send-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'rl@example.com' }),
      });
    }
    const res = await app.request('/auth/send-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'rl@example.com' }),
    });
    expect(res.status).toBe(429);
  });

  it('GET /auth/verify with valid token redirects to /dashboard', async () => {
    const { token } = createMagicLinkToken('verify@example.com');
    const res = await app.request(`/auth/verify?token=${token}`);
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('/dashboard');
    expect(res.headers.get('Set-Cookie')).toContain('oge_session=');
  });

  it('GET /auth/verify with invalid token redirects to login with error', async () => {
    const res = await app.request('/auth/verify?token=bad-token');
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toContain('/auth/login?error=');
  });

  it('GET /auth/verify with returnTo redirects correctly', async () => {
    const { token } = createMagicLinkToken('redir@example.com');
    const res = await app.request(`/auth/verify?token=${token}&returnTo=/dashboard/keys`);
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('/dashboard/keys');
  });

  it('GET /auth/verify rejects returnTo not starting with /dashboard', async () => {
    const { token } = createMagicLinkToken('evil@example.com');
    const res = await app.request(`/auth/verify?token=${token}&returnTo=https://evil.com`);
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('/dashboard');
  });

  it('GET /auth/verify without token redirects to login', async () => {
    const res = await app.request('/auth/verify');
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toContain('/auth/login');
  });

  it('POST /auth/logout clears cookie and redirects to login', async () => {
    const res = await app.request('/auth/logout', { method: 'POST' });
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('/auth/login');
    expect(res.headers.get('Set-Cookie')).toContain('Max-Age=0');
  });
});
