import type { Context, Next } from 'hono';
import { findSessionByToken, findUserById, refreshSession } from '../db/index';

/**
 * Parse a named cookie from the Cookie header.
 */
export function getCookie(c: Context, name: string): string | undefined {
  const header = c.req.header('Cookie');
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [k, ...rest] = part.split('=');
    if (k.trim() === name) {
      return rest.join('=').trim();
    }
  }
  return undefined;
}

/**
 * Set a session cookie (HttpOnly, Secure, SameSite=Lax, 30-day expiry).
 */
export function setSessionCookie(c: Context, token: string): void {
  const maxAge = 30 * 24 * 60 * 60; // 30 days in seconds
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  c.header('Set-Cookie', `oge_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure}`);
}

/**
 * Clear the session cookie.
 */
export function clearSessionCookie(c: Context): void {
  c.header('Set-Cookie', 'oge_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
}

/**
 * Session middleware — validates the oge_session cookie and attaches user + session to context.
 * Redirects to login page if session is invalid or missing.
 */
export function sessionMiddleware() {
  return async (c: Context, next: Next) => {
    const token = getCookie(c, 'oge_session');
    if (!token) {
      const returnTo = encodeURIComponent(c.req.path);
      return c.redirect(`/auth/login?returnTo=${returnTo}`);
    }

    const session = findSessionByToken(token);
    if (!session) {
      clearSessionCookie(c);
      const returnTo = encodeURIComponent(c.req.path);
      return c.redirect(`/auth/login?returnTo=${returnTo}`);
    }

    const user = findUserById(session.user_id);
    if (!user) {
      clearSessionCookie(c);
      return c.redirect('/auth/login');
    }

    // Refresh session expiry on each valid request
    refreshSession(session.id);

    c.set('session', session);
    c.set('user', user);
    await next();
  };
}

/**
 * CSRF middleware — validates X-CSRF-Token header on POST/PUT/DELETE requests.
 */
export function csrfMiddleware() {
  return async (c: Context, next: Next) => {
    const method = c.req.method;
    if (method === 'POST' || method === 'PUT' || method === 'DELETE') {
      const session = c.get('session' as never) as { csrf_token: string } | undefined;
      if (!session) {
        return c.json({ error: 'forbidden', message: 'No session found.' }, 403);
      }

      const csrfToken = c.req.header('X-CSRF-Token');
      if (!csrfToken || csrfToken !== session.csrf_token) {
        return c.json({ error: 'forbidden', message: 'Invalid CSRF token.' }, 403);
      }
    }
    await next();
  };
}
