import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { rateLimit } from '../../src/middleware/rate-limit';

describe('rateLimit middleware', () => {
  it('allows requests within the limit', async () => {
    const app = new Hono();
    app.use('*', rateLimit({ windowMs: 60_000, max: 5 }));
    app.get('/test', (c) => c.text('ok'));

    const res = await app.request('/test');
    expect(res.status).toBe(200);
    expect(res.headers.get('X-RateLimit-Limit')).toBe('5');
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('4');
  });

  it('returns 429 when limit is exceeded', async () => {
    const app = new Hono();
    app.use('*', rateLimit({ windowMs: 60_000, max: 2 }));
    app.get('/test', (c) => c.text('ok'));

    await app.request('/test');
    await app.request('/test');
    const res = await app.request('/test');

    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toBe('rate_limit_exceeded');
  });

  it('sets rate limit headers', async () => {
    const app = new Hono();
    app.use('*', rateLimit({ windowMs: 60_000, max: 10 }));
    app.get('/test', (c) => c.text('ok'));

    const res = await app.request('/test');
    expect(res.headers.get('X-RateLimit-Limit')).toBe('10');
    expect(res.headers.get('X-RateLimit-Reset')).toBeTruthy();
  });
});
