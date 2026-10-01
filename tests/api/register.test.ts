import { Hono } from 'hono';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerRoute } from '../../src/api/register';
import { closeDb } from '../../src/db';
import { rateLimit } from '../../src/middleware/rate-limit';

vi.mock('../../src/email/send', () => ({
  sendWelcomeEmail: vi.fn().mockResolvedValue(undefined),
}));

beforeEach(() => {
  closeDb();
  process.env.DATABASE_URL = 'file::memory:';
});

afterAll(() => {
  closeDb();
  delete process.env.DATABASE_URL;
});

const app = new Hono();
app.route('/', registerRoute);

function post(body: unknown) {
  return app.request('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /auth/register', () => {
  // The activation path. Unchanged by the 409 work — a regression here costs signups.
  it('creates a free tier API key for a new email', async () => {
    const res = await post({ email: 'new@example.com' });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.apiKey).toMatch(/^oge_sk_/);
    expect(body.plan).toBe('free');
    expect(body.limit).toBe(500);
  });

  // Per DECISIONS.md Decision 4 (amended): /auth/register is unauthenticated,
  // so a duplicate registration must never hand back the stored credential.
  it('returns 409 account_exists for a duplicate email and leaks no credential', async () => {
    await post({ email: 'dup@example.com' });
    const res = await post({ email: 'dup@example.com' });

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe('account_exists');
    expect(body.docs).toBe('https://og-engine.com/api-reference/errors#account_exists');

    // Assert absence explicitly — a renamed or nested field would still be a leak.
    expect(body).not.toHaveProperty('apiKey');
    expect(body).not.toHaveProperty('plan');
    expect(body).not.toHaveProperty('limit');
    expect(JSON.stringify(body)).not.toMatch(/oge_sk_/);
  });

  it('sends no email on the duplicate path', async () => {
    const { sendWelcomeEmail } = await import('../../src/email/send');
    await post({ email: 'nomail@example.com' });
    vi.mocked(sendWelcomeEmail).mockClear();

    const res = await post({ email: 'nomail@example.com' });

    expect(res.status).toBe(409);
    expect(sendWelcomeEmail).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid email', async () => {
    const res = await post({ email: 'not-an-email' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for missing email', async () => {
    const res = await post({});
    expect(res.status).toBe(400);
  });

  it('sends welcome email on new registration', async () => {
    const { sendWelcomeEmail } = await import('../../src/email/send');
    await post({ email: 'welcome@example.com' });
    expect(sendWelcomeEmail).toHaveBeenCalledWith('welcome@example.com', expect.stringMatching(/^oge_sk_/), 'free');
  });

  it('returns 400 for invalid JSON', async () => {
    const res = await app.request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    });
    expect(res.status).toBe(400);
  });
});

describe('POST /auth/register rate limit', () => {
  // Same wiring as src/index.ts: 20 requests/hour/IP in front of the route.
  const limited = new Hono();
  limited.use('/auth/register', rateLimit({ windowMs: 3_600_000, max: 20 }));
  limited.route('/', registerRoute);

  // The middleware store is module-level and keyed on the forwarded IP, so each
  // test needs its own IP to stay independent of the other suites in this file.
  function postFrom(ip: string, email: string) {
    return limited.request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
      body: JSON.stringify({ email }),
    });
  }

  it('allows 20 registrations per IP per hour and 429s the 21st', async () => {
    const ip = '203.0.113.10';

    for (let i = 0; i < 20; i++) {
      const res = await postFrom(ip, `burst-${i}@example.com`);
      expect(res.status).toBe(201);
    }

    const blocked = await postFrom(ip, 'burst-20@example.com');
    expect(blocked.status).toBe(429);
    const body = await blocked.json();
    expect(body.error).toBe('rate_limit_exceeded');
    expect(blocked.headers.get('X-RateLimit-Limit')).toBe('20');
  });

  it('counts per IP, so a different IP is unaffected', async () => {
    const res = await postFrom('203.0.113.11', 'other-ip@example.com');
    expect(res.status).toBe(201);
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('19');
  });
});
