import { Hono } from 'hono';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { upgradeRoute } from '../../src/api/upgrade';
import { closeDb, createSession, createUser } from '../../src/db';
import { PAYMENT_LINK_ENV_KEYS } from '../../src/utils/checkout-link';

// The built-in links. Asserted literally on purpose: if someone edits the
// mapping in `src/utils/checkout-link.ts`, that is a money-path change and it
// should have to come through a failing test, not slip in as a typo.
const STARTER_LINK = 'https://buy.stripe.com/8x2cN56iE9EU9bQ0F5fAc00';
const PRO_LINK = 'https://buy.stripe.com/7sY5kDcH26sI73IafFfAc01';

let app: Hono;

beforeEach(() => {
  closeDb();
  process.env.DATABASE_URL = 'file::memory:';
  for (const key of Object.values(PAYMENT_LINK_ENV_KEYS)) delete process.env[key];
  app = new Hono();
  app.route('/', upgradeRoute);
});

afterAll(() => {
  closeDb();
  delete process.env.DATABASE_URL;
  for (const key of Object.values(PAYMENT_LINK_ENV_KEYS)) delete process.env[key];
});

/** Signs a user in and returns the Cookie header a browser would send. */
function signIn(email: string) {
  const user = createUser(email);
  const token = crypto.randomUUID();
  createSession(user.id, token);
  return { user, cookie: `oge_session=${token}` };
}

describe('GET /upgrade/:plan — anonymous', () => {
  it('redirects to the bare Starter Payment Link with no query string', async () => {
    const res = await app.request('/upgrade/starter');
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe(STARTER_LINK);
  });

  it('redirects to the bare Pro Payment Link with no query string', async () => {
    const res = await app.request('/upgrade/pro');
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe(PRO_LINK);
  });

  it('ignores a stale or forged session cookie instead of failing the purchase', async () => {
    const res = await app.request('/upgrade/pro', {
      headers: { Cookie: `oge_session=${crypto.randomUUID()}` },
    });
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe(PRO_LINK);
  });
});

describe('GET /upgrade/:plan — authenticated', () => {
  it('carries client_reference_id and prefilled_email into checkout', async () => {
    const { user, cookie } = signIn('buyer@example.com');

    const res = await app.request('/upgrade/pro', { headers: { Cookie: cookie } });
    expect(res.status).toBe(302);

    const location = new URL(res.headers.get('Location') ?? '');
    expect(location.origin + location.pathname).toBe(PRO_LINK);
    // This is the value the Stripe webhook resolves back to a users.id.
    expect(location.searchParams.get('client_reference_id')).toBe(user.id);
    expect(location.searchParams.get('prefilled_email')).toBe('buyer@example.com');
  });

  it('percent-encodes the email rather than emitting a raw @ or +', async () => {
    const { cookie } = signIn('buyer+tag@example.com');

    const res = await app.request('/upgrade/starter', { headers: { Cookie: cookie } });
    const location = res.headers.get('Location') ?? '';
    expect(location).toContain('prefilled_email=buyer%2Btag%40example.com');
    // A raw `+` in a query string decodes to a space and would break prefill.
    expect(location).not.toContain('buyer+tag@example.com');
  });
});

describe('GET /upgrade/:plan — plans we cannot sell', () => {
  it('bounces Scale to /pricing/ while no Payment Link is configured', async () => {
    const res = await app.request('/upgrade/scale');
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('/pricing/');
  });

  it('sells Scale as soon as STRIPE_PAYMENT_LINK_SCALE is set — no code change', async () => {
    process.env.STRIPE_PAYMENT_LINK_SCALE = 'https://buy.stripe.com/test_scale_link';
    const { user, cookie } = signIn('scale@example.com');

    const res = await app.request('/upgrade/scale', { headers: { Cookie: cookie } });
    expect(res.status).toBe(302);
    const location = new URL(res.headers.get('Location') ?? '');
    expect(location.origin + location.pathname).toBe('https://buy.stripe.com/test_scale_link');
    expect(location.searchParams.get('client_reference_id')).toBe(user.id);
  });

  it('ignores a malformed Payment Link override and uses the built-in link', async () => {
    process.env.STRIPE_PAYMENT_LINK_PRO = 'not-a-url';
    const res = await app.request('/upgrade/pro');
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe(PRO_LINK);
  });

  it('bounces an unknown plan to /pricing/ rather than 404 or 500', async () => {
    const res = await app.request('/upgrade/nonsense');
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('/pricing/');
  });

  it('accepts the plan segment case-insensitively', async () => {
    const res = await app.request('/upgrade/Pro');
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe(PRO_LINK);
  });
});
