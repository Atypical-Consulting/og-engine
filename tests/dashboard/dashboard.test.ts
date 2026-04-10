import { Hono } from 'hono';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { csrfMiddleware, sessionMiddleware } from '../../src/auth/middleware';
import { dashboardRoutes } from '../../src/dashboard/routes';
import { closeDb, createSession, createUser } from '../../src/db';

describe('dashboard routes', () => {
  let app: Hono;

  beforeEach(() => {
    closeDb();
    process.env.DATABASE_URL = 'file::memory:';
    app = new Hono();
    app.use('/dashboard', sessionMiddleware());
    app.use('/dashboard', csrfMiddleware());
    app.use('/dashboard/*', sessionMiddleware());
    app.use('/dashboard/*', csrfMiddleware());
    app.route('/', dashboardRoutes);
  });

  afterAll(() => {
    closeDb();
    delete process.env.DATABASE_URL;
  });

  it('GET /dashboard without session redirects to /auth/login', async () => {
    const res = await app.request('/dashboard');
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toContain('/auth/login');
  });

  it('GET /dashboard returns full page with shell when authenticated', async () => {
    const user = createUser('dash@example.com');
    const token = crypto.randomUUID();
    createSession(user.id, token);

    const res = await app.request('/dashboard', {
      headers: { Cookie: `oge_session=${token}` },
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('OG Engine');
    expect(html).toContain('id="main-content"');
    expect(html).toContain('Overview');
    expect(html).toContain('dash@example.com');
  });

  it('GET /dashboard returns partial content with HX-Request header', async () => {
    const user = createUser('htmx@example.com');
    const token = crypto.randomUUID();
    createSession(user.id, token);

    const res = await app.request('/dashboard', {
      headers: {
        Cookie: `oge_session=${token}`,
        'HX-Request': 'true',
      },
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).not.toContain('<!DOCTYPE');
    expect(html).toContain('Overview');
    expect(html).toContain('stats-grid');
  });
});
