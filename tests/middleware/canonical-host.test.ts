import { Hono } from 'hono';
import { afterEach, describe, expect, it } from 'vitest';
import { canonicalHost } from '../../src/middleware/canonical-host';

const CANONICAL = 'og-engine.com';
const ALIAS = 'og-engine.fly.dev';

function get(app: Hono, path: string, host: string) {
  return app.request(`https://${host}${path}`, { headers: { host } });
}

/**
 * Mirrors the registration order in src/index.ts: API routes first, then the
 * canonical-host redirect, then the static docs fallback.
 */
function createApp(opts?: Parameters<typeof canonicalHost>[0]) {
  const app = new Hono();
  app.get('/health', (c) => c.json({ status: 'ok' }));
  app.post('/webhooks/stripe', (c) => c.json({ received: true }));
  app.use('*', canonicalHost(opts));
  app.use('*', async (c) => c.html('<html lang="en">docs page</html>'));
  return app;
}

afterEach(() => {
  delete process.env.CANONICAL_HOST;
  delete process.env.CANONICAL_HOST_ALIASES;
});

describe('canonicalHost', () => {
  it('301s a docs page on the alias host to the canonical host', async () => {
    const app = createApp({ canonical: CANONICAL, aliases: [ALIAS] });
    const res = await get(app, '/pricing', ALIAS);
    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe(`https://${CANONICAL}/pricing`);
  });

  it('preserves the path and query string', async () => {
    const app = createApp({ canonical: CANONICAL, aliases: [ALIAS] });
    const res = await get(app, '/guides/nextjs/?utm_source=x', ALIAS);
    expect(res.headers.get('location')).toBe(`https://${CANONICAL}/guides/nextjs/?utm_source=x`);
  });

  it('redirects HEAD as well as GET', async () => {
    const app = createApp({ canonical: CANONICAL, aliases: [ALIAS] });
    const res = await app.request(`https://${ALIAS}/pricing`, { method: 'HEAD', headers: { host: ALIAS } });
    expect(res.status).toBe(301);
  });

  it('serves the docs page unchanged on the canonical host', async () => {
    const app = createApp({ canonical: CANONICAL, aliases: [ALIAS] });
    const res = await get(app, '/pricing', CANONICAL);
    expect(res.status).toBe(200);
  });

  it('leaves unlisted hosts alone so local and private access still works', async () => {
    const app = createApp({ canonical: CANONICAL, aliases: [ALIAS] });
    for (const host of ['localhost', '127.0.0.1', 'og-engine.internal']) {
      const res = await get(app, '/pricing', host);
      expect(res.status, host).toBe(200);
    }
  });

  it('ignores the port when matching the alias host', async () => {
    const app = createApp({ canonical: CANONICAL, aliases: [ALIAS] });
    const res = await app.request(`https://${ALIAS}/pricing`, { headers: { host: `${ALIAS}:443` } });
    expect(res.status).toBe(301);
  });

  it('cannot redirect the canonical host to itself', async () => {
    const app = createApp({ canonical: CANONICAL, aliases: [CANONICAL, ALIAS] });
    const res = await get(app, '/pricing', CANONICAL);
    expect(res.status).toBe(200);
  });

  it('is a no-op when the flag is unset', async () => {
    const app = createApp();
    const res = await get(app, '/pricing', ALIAS);
    expect(res.status).toBe(200);
  });

  it('is a no-op when a canonical host is set but no aliases are', async () => {
    process.env.CANONICAL_HOST = CANONICAL;
    const app = createApp();
    const res = await get(app, '/pricing', ALIAS);
    expect(res.status).toBe(200);
  });

  it('reads the canonical host and aliases from the environment', async () => {
    process.env.CANONICAL_HOST = CANONICAL;
    process.env.CANONICAL_HOST_ALIASES = `${ALIAS}, www.og-engine.com`;
    const app = createApp();
    expect((await get(app, '/pricing', ALIAS)).status).toBe(301);
    expect((await get(app, '/pricing', 'www.og-engine.com')).status).toBe(301);
  });

  // The money path: Stripe does not follow redirects and a 301 would drop the
  // request body, so webhooks on the alias host must never be redirected.
  it('never redirects a non-GET/HEAD request', async () => {
    const app = createApp({ canonical: CANONICAL, aliases: [ALIAS] });
    const res = await app.request(`https://${ALIAS}/webhooks/stripe`, {
      method: 'POST',
      headers: { host: ALIAS, 'Content-Type': 'application/json' },
      body: '{}',
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true });
  });

  // API routes are registered before this middleware, so they answer first and
  // clients pointed at the alias host keep working.
  it('does not redirect a GET handled by an API route', async () => {
    const app = createApp({ canonical: CANONICAL, aliases: [ALIAS] });
    const res = await get(app, '/health', ALIAS);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
  });
});
