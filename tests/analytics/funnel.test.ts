/**
 * The load-bearing test for ATY-71: if the docs → signup funnel stops being
 * measurable, this file fails.
 */

import { Hono } from 'hono';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { analyticsRoute } from '../../src/api/analytics';
import { registerRoute } from '../../src/api/register';
import { closeDb, findUserByEmail } from '../../src/db';
import { analyticsDb, findSignupAttribution, getPageFunnel, getPageTraffic } from '../../src/db/analytics';
import { pageViewTracking } from '../../src/middleware/analytics';

vi.mock('../../src/email/send', () => ({
  sendWelcomeEmail: vi.fn().mockResolvedValue(undefined),
}));

const BROWSER =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36';
const OTHER_BROWSER = 'Mozilla/5.0 (X11; Linux x86_64) Gecko/20100101 Firefox/131.0';
const ADMIN_SECRET = 'test-admin-secret';

/**
 * Mirrors src/index.ts: API routes claim their requests first, then the
 * page-view middleware wraps whatever reaches the static docs handler.
 */
function buildApp() {
  const app = new Hono();
  app.route('/', registerRoute);
  app.route('/', analyticsRoute);
  app.use('*', pageViewTracking());
  app.get('*', (c) => c.html('<!doctype html><title>docs</title>'));
  return app;
}

let app: ReturnType<typeof buildApp>;

beforeEach(() => {
  closeDb();
  process.env.DATABASE_URL = 'file::memory:';
  process.env.ADMIN_CRON_SECRET = ADMIN_SECRET;
  delete process.env.ANALYTICS_ENABLED;
  analyticsDb();
  app = buildApp();
});

afterAll(() => {
  closeDb();
  delete process.env.DATABASE_URL;
  delete process.env.ADMIN_CRON_SECRET;
});

function view(path: string, opts: { ip?: string; ua?: string; referer?: string } = {}) {
  const headers: Record<string, string> = {
    'X-Forwarded-For': opts.ip ?? '203.0.113.10',
    'User-Agent': opts.ua ?? BROWSER,
  };
  if (opts.referer) headers.Referer = opts.referer;
  return app.request(path, { headers });
}

function register(email: string, opts: { ip?: string; ua?: string; src?: string } = {}) {
  const url = opts.src ? `/auth/register?src=${encodeURIComponent(opts.src)}` : '/auth/register';
  return app.request(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Forwarded-For': opts.ip ?? '203.0.113.10',
      'User-Agent': opts.ua ?? BROWSER,
    },
    body: JSON.stringify({ email }),
  });
}

describe('page view recording', () => {
  it('records a docs page view with its traffic source', async () => {
    const res = await view('/compare/puppeteer/', { referer: 'https://www.google.com/search?q=puppeteer+alternative' });
    expect(res.status).toBe(200);

    const traffic = getPageTraffic(30);
    expect(traffic).toHaveLength(1);
    expect(traffic[0]).toMatchObject({
      path: '/compare/puppeteer/',
      pageviews: 1,
      sessions: 1,
      entries: 1,
      sources: { organic_search: 1 },
    });
    expect(traffic[0]?.topReferrers).toEqual([{ host: 'google.com', sessions: 1 }]);
  });

  it('stitches a second page into the same session and keeps the arrival source', async () => {
    await view('/compare/puppeteer/', { referer: 'https://www.google.com/' });
    await view('/quick-start/', { referer: 'http://localhost/compare/puppeteer/' });

    const traffic = getPageTraffic(30);
    const quickStart = traffic.find((r) => r.path === '/quick-start/');
    expect(quickStart).toMatchObject({ pageviews: 1, sessions: 1, entries: 0, sources: { organic_search: 1 } });

    const sessions = new Set(
      (analyticsDb().prepare('SELECT session_id FROM page_views').all() as { session_id: string }[]).map(
        (r) => r.session_id,
      ),
    );
    expect(sessions.size).toBe(1);
  });

  it('does not count crawlers, non-HTML responses or 404s', async () => {
    await view('/pricing/', { ua: 'Mozilla/5.0 (compatible; Googlebot/2.1)' });
    await app.request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': BROWSER },
      body: JSON.stringify({ email: 'json@example.com' }),
    });

    expect(getPageTraffic(30)).toEqual([]);
  });

  it('never stores an IP address or a user agent', async () => {
    await view('/pricing/', { ip: '198.51.100.7', referer: 'https://news.ycombinator.com/' });

    const rows = analyticsDb().prepare('SELECT * FROM page_views').all() as Record<string, unknown>[];
    const serialised = JSON.stringify(rows);
    expect(serialised).not.toContain('198.51.100.7');
    expect(serialised).not.toContain('Chrome/129.0');
  });

  it('is fully off when ANALYTICS_ENABLED=false', async () => {
    process.env.ANALYTICS_ENABLED = 'false';
    const res = await view('/pricing/');
    expect(res.status).toBe(200);
    expect(getPageTraffic(30)).toEqual([]);
  });
});

describe('signup attribution', () => {
  it('joins a browser signup to the page the visitor last read', async () => {
    await view('/compare/puppeteer/', { referer: 'https://www.google.com/' });
    await view('/quick-start/', { referer: 'http://localhost/compare/puppeteer/' });

    const res = await register('dev@example.com');
    expect(res.status).toBe(201);

    const user = findUserByEmail('dev@example.com');
    const attribution = findSignupAttribution(user!.id);
    expect(attribution).toMatchObject({
      last_page: '/quick-start/',
      landing_page: '/compare/puppeteer/',
      source: 'organic_search',
      referrer_host: 'google.com',
      confidence: 'visitor',
    });
  });

  it('prefers the explicit src the signup form sends', async () => {
    await view('/quick-start/');
    const res = await register('explicit@example.com', { src: '/compare/puppeteer/' });
    expect(res.status).toBe(201);

    const user = findUserByEmail('explicit@example.com');
    expect(findSignupAttribution(user!.id)).toMatchObject({
      last_page: '/compare/puppeteer/',
      confidence: 'explicit',
    });
  });

  it('falls back to the network when the signup comes from a terminal, not the browser', async () => {
    await view('/quick-start/', { ip: '203.0.113.99', ua: BROWSER });

    // Same machine, different client: curl's user agent will never match the
    // browser's, so only the shared public IP can bridge the two.
    const res = await register('curl@example.com', { ip: '203.0.113.99', ua: OTHER_BROWSER });
    expect(res.status).toBe(201);

    const user = findUserByEmail('curl@example.com');
    expect(findSignupAttribution(user!.id)).toMatchObject({
      last_page: '/quick-start/',
      confidence: 'network',
    });
  });

  it('records an unattributed signup rather than silently dropping it', async () => {
    const res = await register('nowhere@example.com', { ip: '192.0.2.44' });
    expect(res.status).toBe(201);

    const user = findUserByEmail('nowhere@example.com');
    expect(findSignupAttribution(user!.id)).toMatchObject({ last_page: null, confidence: 'none' });
  });

  it('does not double-count a repeated registration for the same email', async () => {
    await view('/quick-start/');
    await register('once@example.com');
    const second = await register('once@example.com', { src: '/pricing/' });
    expect(second.status).toBe(200);

    const rows = analyticsDb().prepare('SELECT COUNT(*) AS n FROM signup_attribution').get() as { n: number };
    expect(rows.n).toBe(1);
    const user = findUserByEmail('once@example.com');
    expect(findSignupAttribution(user!.id)?.last_page).toBe('/quick-start/');
  });

  it('still issues the API key when attribution is impossible', async () => {
    process.env.ANALYTICS_ENABLED = 'false';
    const res = await register('noanalytics@example.com');
    expect(res.status).toBe(201);
    expect((await res.json()).apiKey).toMatch(/^oge_sk_/);
  });
});

describe('page funnel', () => {
  it('reports sessions, signups and conversion rate per page', async () => {
    await view('/compare/puppeteer/', { referer: 'https://www.google.com/' });
    await view('/quick-start/', { referer: 'http://localhost/compare/puppeteer/' });
    await register('converted@example.com', { src: '/compare/puppeteer/' });

    // A second visitor who reads the comparison page but never signs up.
    await view('/compare/puppeteer/', { ip: '198.51.100.1', referer: 'https://www.bing.com/' });

    const funnel = getPageFunnel(30);
    expect(funnel.find((r) => r.path === '/compare/puppeteer/')).toEqual({
      path: '/compare/puppeteer/',
      sessions: 2,
      signups: 1,
      conversionRate: 50,
    });
    expect(funnel.find((r) => r.path === '/quick-start/')).toEqual({
      path: '/quick-start/',
      sessions: 1,
      signups: 0,
      conversionRate: 0,
    });
  });
});

describe('GET /admin/analytics/*', () => {
  it('rejects a request without the admin secret', async () => {
    expect((await app.request('/admin/analytics/pages')).status).toBe(401);
    expect((await app.request('/admin/analytics/funnel')).status).toBe(401);
  });

  it('serves the per-page traffic table', async () => {
    await view('/pricing/', { referer: 'https://www.google.com/' });

    const res = await app.request('/admin/analytics/pages?days=7', {
      headers: { Authorization: `Bearer ${ADMIN_SECRET}` },
    });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.window.days).toBe(7);
    expect(body.rows).toEqual([
      expect.objectContaining({ path: '/pricing/', pageviews: 1, sessions: 1, sources: { organic_search: 1 } }),
    ]);
  });

  it('serves the funnel table with attribution confidence broken out', async () => {
    await view('/compare/puppeteer/', { referer: 'https://www.google.com/' });
    await register('funnel@example.com');

    const res = await app.request('/admin/analytics/funnel?days=30', {
      headers: { Authorization: `Bearer ${ADMIN_SECRET}` },
    });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.totals).toMatchObject({
      pageviews: 1,
      sessions: 1,
      signups: 1,
      attributedSignups: 1,
      byConfidence: { explicit: 0, visitor: 1, network: 0, none: 0 },
      bySource: { organic_search: 1 },
    });
    expect(body.rows).toContainEqual({
      path: '/compare/puppeteer/',
      sessions: 1,
      signups: 1,
      conversionRate: 100,
    });
  });

  it('returns an empty table rather than an error before anything is published', async () => {
    const res = await app.request('/admin/analytics/funnel', {
      headers: { Authorization: `Bearer ${ADMIN_SECRET}` },
    });
    const body = await res.json();
    expect(body.rows).toEqual([]);
    expect(body.totals).toMatchObject({ pageviews: 0, sessions: 0, signups: 0 });
  });
});
