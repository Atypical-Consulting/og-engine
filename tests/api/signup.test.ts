import { Hono } from 'hono';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { signupRoute } from '../../src/api/signup';
import { closeDb, findApiKeyByEmail, findUserByEmail, getDb } from '../../src/db';

vi.mock('../../src/email/send', () => ({
  sendWelcomeEmail: vi.fn().mockResolvedValue(undefined),
}));

beforeEach(() => {
  closeDb();
  process.env.DATABASE_URL = 'file::memory:';
  vi.clearAllMocks();
});

afterAll(() => {
  closeDb();
  delete process.env.DATABASE_URL;
});

const app = new Hono();
app.route('/', signupRoute);

function submit(email: string) {
  return app.request('/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ email }).toString(),
  });
}

function countUsers(): number {
  const row = getDb().prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number };
  return row.n;
}

describe('GET /signup', () => {
  it('serves a form that accepts an email address', async () => {
    const res = await app.request('/signup');
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('<form method="POST" action="/signup">');
    expect(html).toContain('name="email"');
  });

  it('redirects the other two paths developers try to the canonical one', async () => {
    for (const path of ['/register', '/sign-up']) {
      const res = await app.request(path);
      expect(res.status).toBe(301);
      expect(res.headers.get('location')).toBe('/signup');
    }
  });
});

describe('POST /signup', () => {
  it('provisions a free-plan user and a usable API key', async () => {
    const res = await submit('new@example.com');
    expect(res.status).toBe(201);

    const user = findUserByEmail('new@example.com');
    expect(user).not.toBeNull();
    expect(user?.plan).toBe('free');
    expect(user?.calls_limit).toBe(500);
    expect(user?.stripe_customer_id).toBeNull();

    const key = findApiKeyByEmail('new@example.com');
    expect(key?.key).toMatch(/^oge_sk_/);
    expect(key?.user_id).toBe(user?.id);

    // The key is shown once on the page so a mail outage cannot strand a new
    // account with no way to make its first call.
    expect(await res.text()).toContain(key?.key as string);
  });

  it('emails the key without letting a mail failure fail the request', async () => {
    const { sendWelcomeEmail } = await import('../../src/email/send');
    vi.mocked(sendWelcomeEmail).mockRejectedValueOnce(new Error('Resend is down'));

    const res = await submit('mailfail@example.com');

    // Account survives the outage, request still succeeds.
    expect(res.status).toBe(201);
    expect(findUserByEmail('mailfail@example.com')).not.toBeNull();
    expect(findApiKeyByEmail('mailfail@example.com')).not.toBeNull();
    expect(sendWelcomeEmail).toHaveBeenCalledWith('mailfail@example.com', expect.stringMatching(/^oge_sk_/), 'free');
  });

  it('does not duplicate the account on a repeat signup, and does not error', async () => {
    const first = await submit('dup@example.com');
    expect(first.status).toBe(201);
    const key = findApiKeyByEmail('dup@example.com')?.key;

    const second = await submit('dup@example.com');
    expect(second.status).toBe(200);
    expect(countUsers()).toBe(1);

    const html = await second.text();
    expect(html).toContain('You already have an account');
    // A public form must not hand a live credential to whoever typed the address.
    expect(html).not.toContain(key as string);
    expect(html).toContain('/auth/login');
  });

  it('resolves a case-varied repeat to the same single account', async () => {
    await submit('dev@example.com');
    const key = findApiKeyByEmail('dev@example.com')?.key;

    const res = await submit('Dev@Example.com');
    expect(res.status).toBe(200);
    expect(countUsers()).toBe(1);
    expect(await res.text()).toContain('You already have an account');

    // Same account, same key, and the row is stored normalized.
    expect(findApiKeyByEmail('dev@example.com')?.key).toBe(key);
    expect(findUserByEmail('Dev@Example.com')).toBeNull();
    expect(findUserByEmail('dev@example.com')?.email).toBe('dev@example.com');
  });

  it('normalizes a mixed-case first-time signup before writing it', async () => {
    await submit('  Fresh@Example.COM ');
    expect(findUserByEmail('fresh@example.com')?.email).toBe('fresh@example.com');
    expect(findApiKeyByEmail('fresh@example.com')).not.toBeNull();
  });

  it('re-renders the form with an error for an invalid email', async () => {
    const res = await submit('not-an-email');
    expect(res.status).toBe(400);
    const html = await res.text();
    expect(html).toContain('Please enter a valid email address.');
    expect(html).toContain('<form method="POST" action="/signup">');
    expect(countUsers()).toBe(0);
  });
});
