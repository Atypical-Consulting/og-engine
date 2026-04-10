import { Hono } from 'hono';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createMagicLinkToken } from '../src/auth/magic-link';
import { csrfMiddleware, sessionMiddleware } from '../src/auth/middleware';
import { authRoutes } from '../src/auth/routes';
import { dashboardRoutes } from '../src/dashboard/routes';
import { closeDb, findSessionByToken } from '../src/db';

/**
 * End-to-end smoke test for the full auth -> dashboard flow.
 *
 * Uses Hono's in-process request API (no HTTP server) and in-memory SQLite.
 */
describe('e2e: auth -> dashboard flow', () => {
  let app: Hono;

  beforeEach(() => {
    closeDb();
    process.env.DATABASE_URL = 'file::memory:';

    app = new Hono();

    // Wire up session + CSRF middleware for dashboard (same as src/index.ts)
    app.use('/dashboard', sessionMiddleware());
    app.use('/dashboard', csrfMiddleware());
    app.use('/dashboard/*', sessionMiddleware());
    app.use('/dashboard/*', csrfMiddleware());

    // Register routes
    app.route('/', authRoutes);
    app.route('/', dashboardRoutes);
  });

  afterAll(() => {
    closeDb();
    delete process.env.DATABASE_URL;
  });

  // ── Step 1: GET /auth/login returns the login form ─────────

  it('step 1: GET /auth/login returns 200 with login form', async () => {
    const res = await app.request('/auth/login');
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('type="email"');
    expect(html).toContain('Send magic link');
  });

  // ── Step 2: POST /auth/send-link with valid email succeeds ─

  it('step 2: POST /auth/send-link with valid email returns 200', async () => {
    const res = await app.request('/auth/send-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'e2e@example.com' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.message).toContain('Check your email');
  });

  // ── Steps 3-7: Full flow from magic link to logout ─────────

  it('steps 3-7: magic link verify -> dashboard -> logout -> redirect', async () => {
    const email = 'flow@example.com';

    // Step 3: Create a magic link token directly (simulates clicking the email link)
    const { token } = createMagicLinkToken(email);

    // Step 4: GET /auth/verify with the token -> 302 to /dashboard + Set-Cookie
    const verifyRes = await app.request(`/auth/verify?token=${token}`);
    expect(verifyRes.status).toBe(302);
    expect(verifyRes.headers.get('Location')).toBe('/dashboard');

    const setCookie = verifyRes.headers.get('Set-Cookie') ?? '';
    expect(setCookie).toContain('oge_session=');

    // Extract the session token from the cookie
    const sessionToken = setCookie.split('oge_session=')[1].split(';')[0];
    expect(sessionToken).toBeTruthy();
    expect(sessionToken.length).toBeGreaterThan(0);

    // Verify session exists in DB
    const session = findSessionByToken(sessionToken);
    expect(session).not.toBeNull();

    // Step 5: GET /dashboard with the session cookie -> 200, contains expected content
    const dashRes = await app.request('/dashboard', {
      headers: { Cookie: `oge_session=${sessionToken}` },
    });
    expect(dashRes.status).toBe(200);
    const dashHtml = await dashRes.text();
    expect(dashHtml).toContain('Overview');
    expect(dashHtml).toContain(email);

    // Step 6: POST /auth/logout with the session cookie -> 302 to /auth/login
    // Logout requires CSRF token — extract it from the session
    const logoutRes = await app.request('/auth/logout', {
      method: 'POST',
      headers: {
        Cookie: `oge_session=${sessionToken}`,
        'X-CSRF-Token': session!.csrf_token,
      },
    });
    expect(logoutRes.status).toBe(302);
    expect(logoutRes.headers.get('Location')).toBe('/auth/login');

    // Verify cookie is cleared
    const clearCookie = logoutRes.headers.get('Set-Cookie') ?? '';
    expect(clearCookie).toContain('Max-Age=0');

    // Step 7: GET /dashboard with the same (now invalid) cookie -> 302 to /auth/login
    const afterLogoutRes = await app.request('/dashboard', {
      headers: { Cookie: `oge_session=${sessionToken}` },
    });
    expect(afterLogoutRes.status).toBe(302);
    expect(afterLogoutRes.headers.get('Location')).toContain('/auth/login');
  });
});
