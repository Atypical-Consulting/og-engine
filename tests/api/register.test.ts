import { Hono } from 'hono';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerRoute } from '../../src/api/register';
import { closeDb } from '../../src/db';

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
  it('creates a free tier API key', async () => {
    const res = await post({ email: 'new@example.com' });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.apiKey).toMatch(/^oge_sk_/);
    expect(body.plan).toBe('free');
    expect(body.limit).toBe(500);
  });

  it('returns existing key for duplicate email', async () => {
    await post({ email: 'dup@example.com' });
    const res = await post({ email: 'dup@example.com' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.apiKey).toMatch(/^oge_sk_/);
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
