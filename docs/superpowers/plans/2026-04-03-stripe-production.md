# Stripe Production Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire up production Stripe Payment Links, webhook signature verification, Customer Portal, Resend transactional emails, and a GitHub Action cron for free-tier quota resets.

**Architecture:** Stripe Payment Links handle all checkout UI. Webhooks flow through the existing `POST /webhooks/stripe` endpoint, now with real signature verification via the `stripe` SDK. A new `GET /billing/portal` creates Stripe Customer Portal sessions. Resend sends transactional emails. A GitHub Action hits `POST /admin/reset-free-quotas` monthly.

**Tech Stack:** Stripe SDK (`stripe`), Resend SDK (`resend`), Hono, SQLite (better-sqlite3), Vitest

**Spec:** `docs/superpowers/specs/2026-04-03-stripe-production-design.md`

---

## Task 1: Install dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install stripe and resend**

```bash
bun add stripe resend
```

- [ ] **Step 2: Verify installation**

```bash
bun run type-check
```

Expected: passes (no type errors from new deps)

- [ ] **Step 3: Commit**

```bash
git add package.json bun.lock
git commit -m "chore: add stripe and resend dependencies"
```

---

## Task 2: Resend email module

**Files:**
- Create: `src/email/send.ts`
- Test: `tests/email/send.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/email/send.test.ts`:

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock resend before importing send module
vi.mock('resend', () => {
  const mockSend = vi.fn().mockResolvedValue({ id: 'mock-email-id' });
  return {
    Resend: vi.fn().mockImplementation(() => ({
      emails: { send: mockSend },
    })),
  };
});

describe('email/send', () => {
  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_123';
  });

  afterEach(() => {
    delete process.env.RESEND_API_KEY;
    vi.resetModules();
  });

  it('sendWelcomeEmail sends with correct fields', async () => {
    const { sendWelcomeEmail } = await import('../../src/email/send');
    await sendWelcomeEmail('user@example.com', 'oge_sk_abc123', 'free');
    const { Resend } = await import('resend');
    const instance = new Resend('test');
    expect(instance.emails.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@example.com',
        from: expect.stringContaining('OG Engine'),
        subject: expect.stringContaining('API Key'),
      }),
    );
  });

  it('sendUpgradeEmail sends with plan info', async () => {
    const { sendUpgradeEmail } = await import('../../src/email/send');
    await sendUpgradeEmail('user@example.com', 'pro');
    const { Resend } = await import('resend');
    const instance = new Resend('test');
    expect(instance.emails.send).toHaveBeenCalled();
  });

  it('sendDowngradeEmail sends downgrade notice', async () => {
    const { sendDowngradeEmail } = await import('../../src/email/send');
    await sendDowngradeEmail('user@example.com');
    const { Resend } = await import('resend');
    const instance = new Resend('test');
    expect(instance.emails.send).toHaveBeenCalled();
  });

  it('skips silently when RESEND_API_KEY is not set', async () => {
    delete process.env.RESEND_API_KEY;
    const { sendWelcomeEmail } = await import('../../src/email/send');
    // Should not throw
    await expect(sendWelcomeEmail('user@example.com', 'oge_sk_abc', 'free')).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
bun run vitest run tests/email/send.test.ts
```

Expected: FAIL — module `../../src/email/send` not found

- [ ] **Step 3: Implement the email module**

Create `src/email/send.ts`:

```typescript
import { Resend } from 'resend';
import { PLAN_LIMITS, type Plan } from '../db';

function getResend(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new Resend(apiKey);
}

const FROM = 'OG Engine <api@og-engine.com>';

export async function sendWelcomeEmail(email: string, apiKey: string, plan: Plan): Promise<void> {
  const resend = getResend();
  if (!resend) {
    console.warn('[email] RESEND_API_KEY not set — skipping welcome email');
    return;
  }

  const limit = PLAN_LIMITS[plan];

  await resend.emails.send({
    from: FROM,
    to: email,
    subject: 'Your OG Engine API Key',
    html: `
      <h2>Welcome to OG Engine!</h2>
      <p>Your API key (plan: <strong>${plan}</strong>, ${limit.toLocaleString()} renders/month):</p>
      <code style="background:#f0f0f0;padding:8px 16px;border-radius:4px;font-size:16px;display:inline-block;margin:8px 0;">
        ${apiKey}
      </code>
      <p>Quick start:</p>
      <pre style="background:#f0f0f0;padding:12px;border-radius:4px;overflow-x:auto;">curl -X POST https://og-engine.com/render \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"format":"og","title":"Hello World"}'</pre>
      <p><a href="https://og-engine.com/quick-start/">Read the docs →</a></p>
    `,
  });
}

export async function sendUpgradeEmail(email: string, plan: Plan): Promise<void> {
  const resend = getResend();
  if (!resend) {
    console.warn('[email] RESEND_API_KEY not set — skipping upgrade email');
    return;
  }

  const limit = PLAN_LIMITS[plan];

  await resend.emails.send({
    from: FROM,
    to: email,
    subject: `You're now on OG Engine ${plan.charAt(0).toUpperCase() + plan.slice(1)}`,
    html: `
      <h2>Plan upgraded!</h2>
      <p>Your plan is now <strong>${plan}</strong> with <strong>${limit.toLocaleString()}</strong> renders/month.</p>
      <p>Manage your subscription anytime via the billing portal:</p>
      <pre style="background:#f0f0f0;padding:12px;border-radius:4px;overflow-x:auto;">curl https://og-engine.com/billing/portal \\
  -H "Authorization: Bearer YOUR_API_KEY"</pre>
      <p><a href="https://og-engine.com/pricing">View all plans →</a></p>
    `,
  });
}

export async function sendDowngradeEmail(email: string): Promise<void> {
  const resend = getResend();
  if (!resend) {
    console.warn('[email] RESEND_API_KEY not set — skipping downgrade email');
    return;
  }

  await resend.emails.send({
    from: FROM,
    to: email,
    subject: 'OG Engine subscription cancelled',
    html: `
      <h2>Subscription cancelled</h2>
      <p>Your plan has been downgraded to <strong>Free</strong> (500 renders/month).</p>
      <p>Your API key is still active — you can keep using OG Engine on the free tier.</p>
      <p>Changed your mind? <a href="https://og-engine.com/pricing">Resubscribe anytime →</a></p>
    `,
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
bun run vitest run tests/email/send.test.ts
```

Expected: all 4 tests PASS

- [ ] **Step 5: Run full test suite**

```bash
bun run test
```

Expected: all existing tests still pass

- [ ] **Step 6: Commit**

```bash
git add src/email/send.ts tests/email/send.test.ts
git commit -m "feat: add Resend email module with welcome, upgrade, and downgrade emails"
```

---

## Task 3: Webhook handler rewrite with Stripe SDK

**Files:**
- Modify: `src/api/webhooks.ts`
- Test: `tests/api/webhooks.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/api/webhooks.test.ts`:

```typescript
import { Hono } from 'hono';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { closeDb, createApiKey, findApiKeyByEmail, updateStripeInfo } from '../../src/db';

// Mock stripe
vi.mock('stripe', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      webhooks: {
        constructEvent: vi.fn().mockImplementation((body: string) => JSON.parse(body)),
      },
      subscriptions: {
        retrieve: vi.fn().mockResolvedValue({
          items: { data: [{ price: { id: 'price_pro_monthly' } }] },
        }),
      },
    })),
  };
});

// Mock email
vi.mock('../../src/email/send', () => ({
  sendWelcomeEmail: vi.fn().mockResolvedValue(undefined),
  sendUpgradeEmail: vi.fn().mockResolvedValue(undefined),
  sendDowngradeEmail: vi.fn().mockResolvedValue(undefined),
}));

beforeEach(() => {
  closeDb();
  process.env.DATABASE_URL = 'file::memory:';
  process.env.STRIPE_SECRET_KEY = 'sk_test_123';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_123';
  process.env.STRIPE_PRICE_PRO = 'price_pro_monthly';
  process.env.STRIPE_PRICE_STARTER = 'price_starter_monthly';
  process.env.STRIPE_PRICE_SCALE = 'price_scale_monthly';
});

afterAll(() => {
  closeDb();
  delete process.env.DATABASE_URL;
  delete process.env.STRIPE_SECRET_KEY;
  delete process.env.STRIPE_WEBHOOK_SECRET;
  delete process.env.STRIPE_PRICE_PRO;
  delete process.env.STRIPE_PRICE_STARTER;
  delete process.env.STRIPE_PRICE_SCALE;
});

async function importWebhooksRoute() {
  // Dynamic import to pick up env vars
  const mod = await import('../../src/api/webhooks');
  const app = new Hono();
  app.route('/', mod.webhooksRoute);
  return app;
}

function postWebhook(app: Hono, event: object) {
  return app.request('/webhooks/stripe', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'stripe-signature': 'test_sig',
    },
    body: JSON.stringify(event),
  });
}

describe('POST /webhooks/stripe', () => {
  it('returns 400 without stripe-signature header', async () => {
    const app = await importWebhooksRoute();
    const res = await app.request('/webhooks/stripe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'test' }),
    });
    expect(res.status).toBe(400);
  });

  it('handles checkout.session.completed for new user', async () => {
    const app = await importWebhooksRoute();
    const res = await postWebhook(app, {
      type: 'checkout.session.completed',
      data: {
        object: {
          customer_email: 'newpaid@example.com',
          customer: 'cus_123',
          subscription: 'sub_123',
        },
      },
    });
    expect(res.status).toBe(200);
    const record = findApiKeyByEmail('newpaid@example.com');
    expect(record).not.toBeNull();
    expect(record!.plan).toBe('pro');
    expect(record!.stripe_customer_id).toBe('cus_123');
    expect(record!.stripe_subscription_id).toBe('sub_123');
  });

  it('upgrades existing free user on checkout', async () => {
    createApiKey('existing@example.com', 'free');
    const app = await importWebhooksRoute();
    const res = await postWebhook(app, {
      type: 'checkout.session.completed',
      data: {
        object: {
          customer_email: 'existing@example.com',
          customer: 'cus_456',
          subscription: 'sub_456',
        },
      },
    });
    expect(res.status).toBe(200);
    const record = findApiKeyByEmail('existing@example.com');
    expect(record!.plan).toBe('pro');
    expect(record!.stripe_customer_id).toBe('cus_456');
  });

  it('handles customer.subscription.deleted — downgrades to free', async () => {
    const record = createApiKey('cancel@example.com', 'pro');
    updateStripeInfo(record.id, 'cus_789', 'sub_789');
    const app = await importWebhooksRoute();
    const res = await postWebhook(app, {
      type: 'customer.subscription.deleted',
      data: { object: { id: 'sub_789' } },
    });
    expect(res.status).toBe(200);
    const updated = findApiKeyByEmail('cancel@example.com');
    expect(updated!.plan).toBe('free');
  });

  it('handles invoice.paid — resets usage', async () => {
    const record = createApiKey('invoice@example.com', 'pro');
    updateStripeInfo(record.id, 'cus_inv', 'sub_inv');
    // Simulate usage
    const { getDb } = await import('../../src/db');
    getDb().prepare('UPDATE api_keys SET calls_used = 100 WHERE id = ?').run(record.id);

    const app = await importWebhooksRoute();
    const res = await postWebhook(app, {
      type: 'invoice.paid',
      data: { object: { subscription: 'sub_inv' } },
    });
    expect(res.status).toBe(200);
    const updated = findApiKeyByEmail('invoice@example.com');
    expect(updated!.calls_used).toBe(0);
  });

  it('returns 500 when Stripe is not configured', async () => {
    delete process.env.STRIPE_SECRET_KEY;
    vi.resetModules();
    const app = await importWebhooksRoute();
    const res = await postWebhook(app, { type: 'test' });
    expect(res.status).toBe(500);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
bun run vitest run tests/api/webhooks.test.ts
```

Expected: FAIL — current webhooks.ts doesn't import stripe or call constructEvent

- [ ] **Step 3: Rewrite the webhook handler**

Replace the contents of `src/api/webhooks.ts`:

```typescript
import { Hono } from 'hono';
import Stripe from 'stripe';
import {
  createApiKey,
  findApiKeyByEmail,
  findApiKeyByStripeSubscription,
  type Plan,
  resetUsage,
  updatePlan,
  updateStripeInfo,
} from '../db';
import { sendDowngradeEmail, sendUpgradeEmail, sendWelcomeEmail } from '../email/send';

export const webhooksRoute = new Hono();

function getPlanFromPriceId(priceId: string): Plan | null {
  const mapping: Record<string, Plan> = {
    [process.env.STRIPE_PRICE_STARTER ?? '']: 'starter',
    [process.env.STRIPE_PRICE_PRO ?? '']: 'pro',
    [process.env.STRIPE_PRICE_SCALE ?? '']: 'scale',
  };
  return mapping[priceId] ?? null;
}

webhooksRoute.post('/webhooks/stripe', async (c) => {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeSecretKey || !webhookSecret) {
    return c.json(
      { error: 'server_error', message: 'Stripe is not configured.' },
      500,
    );
  }

  const signature = c.req.header('stripe-signature');
  if (!signature) {
    return c.json(
      { error: 'invalid_request', message: 'Missing stripe-signature header.' },
      400,
    );
  }

  const body = await c.req.text();
  const stripe = new Stripe(stripeSecretKey);

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    return c.json(
      { error: 'invalid_request', message: 'Invalid webhook signature.' },
      400,
    );
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const email = session.customer_email;
      const customerId = session.customer as string;
      const subscriptionId = session.subscription as string;

      if (!email || !subscriptionId) break;

      // Retrieve subscription to get the actual price ID
      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      const priceId = sub.items.data[0]?.price?.id;
      const plan = priceId ? getPlanFromPriceId(priceId) : null;
      if (!plan) break;

      // Check if user already has a free key
      let record = findApiKeyByEmail(email);
      if (record) {
        updatePlan(record.id, plan);
        updateStripeInfo(record.id, customerId, subscriptionId);
      } else {
        record = createApiKey(email, plan);
        updateStripeInfo(record.id, customerId, subscriptionId);
      }

      await sendWelcomeEmail(email, record.key, plan);
      break;
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription;
      const subId = sub.id;
      const priceId = sub.items?.data?.[0]?.price?.id;

      if (!subId || !priceId) break;

      const plan = getPlanFromPriceId(priceId);
      if (!plan) break;

      const record = findApiKeyByStripeSubscription(subId);
      if (record) {
        updatePlan(record.id, plan);
        await sendUpgradeEmail(record.email, plan);
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      const subId = sub.id;
      if (!subId) break;

      const record = findApiKeyByStripeSubscription(subId);
      if (record) {
        updatePlan(record.id, 'free');
        await sendDowngradeEmail(record.email);
      }
      break;
    }

    case 'invoice.paid': {
      const invoice = event.data.object as Stripe.Invoice;
      const subId = invoice.subscription as string;
      if (!subId) break;

      const record = findApiKeyByStripeSubscription(subId);
      if (record) {
        resetUsage(record.id);
      }
      break;
    }
  }

  return c.text('ok');
});
```

- [ ] **Step 4: Run webhook tests**

```bash
bun run vitest run tests/api/webhooks.test.ts
```

Expected: all 6 tests PASS

- [ ] **Step 5: Run full test suite**

```bash
bun run test
```

Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add src/api/webhooks.ts tests/api/webhooks.test.ts
git commit -m "feat: rewrite webhook handler with Stripe SDK signature verification and email sends"
```

---

## Task 4: Wire Resend into registration endpoint

**Files:**
- Modify: `src/api/register.ts`
- Modify: `tests/api/register.test.ts`

- [ ] **Step 1: Add email test to existing register tests**

Add to `tests/api/register.test.ts`, after the existing imports:

```typescript
import { vi } from 'vitest';

vi.mock('../../src/email/send', () => ({
  sendWelcomeEmail: vi.fn().mockResolvedValue(undefined),
}));
```

Add a new test case inside the existing `describe` block:

```typescript
  it('sends welcome email on new registration', async () => {
    const { sendWelcomeEmail } = await import('../../src/email/send');
    await post({ email: 'welcome@example.com' });
    expect(sendWelcomeEmail).toHaveBeenCalledWith(
      'welcome@example.com',
      expect.stringMatching(/^oge_sk_/),
      'free',
    );
  });
```

- [ ] **Step 2: Run tests to verify the new test fails**

```bash
bun run vitest run tests/api/register.test.ts
```

Expected: new test FAILS (sendWelcomeEmail not called yet)

- [ ] **Step 3: Add email send to register.ts**

In `src/api/register.ts`, add the import at the top:

```typescript
import { sendWelcomeEmail } from '../email/send';
```

Replace the TODO comment block (lines 55-57) with:

```typescript
  await sendWelcomeEmail(email, record.key, record.plan);
```

- [ ] **Step 4: Run tests**

```bash
bun run vitest run tests/api/register.test.ts
```

Expected: all tests PASS

- [ ] **Step 5: Run full test suite**

```bash
bun run test
```

Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add src/api/register.ts tests/api/register.test.ts
git commit -m "feat: send welcome email on free registration via Resend"
```

---

## Task 5: Customer Portal billing endpoint

**Files:**
- Create: `src/api/billing.ts`
- Test: `tests/api/billing.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/api/billing.test.ts`:

```typescript
import { Hono } from 'hono';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { closeDb, createApiKey, updateStripeInfo } from '../../src/db';
import { authMiddleware } from '../../src/middleware/auth';

// Mock stripe
vi.mock('stripe', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      billingPortal: {
        sessions: {
          create: vi.fn().mockResolvedValue({
            url: 'https://billing.stripe.com/session/test_session',
          }),
        },
      },
    })),
  };
});

beforeEach(() => {
  closeDb();
  process.env.DATABASE_URL = 'file::memory:';
  process.env.STRIPE_SECRET_KEY = 'sk_test_123';
});

afterAll(() => {
  closeDb();
  delete process.env.DATABASE_URL;
  delete process.env.STRIPE_SECRET_KEY;
});

async function createApp() {
  const { billingRoute } = await import('../../src/api/billing');
  const app = new Hono();
  app.use('/billing/*', authMiddleware());
  app.route('/', billingRoute);
  return app;
}

describe('GET /billing/portal', () => {
  it('returns portal URL for paid user with stripe_customer_id', async () => {
    const record = createApiKey('paid@example.com', 'pro');
    updateStripeInfo(record.id, 'cus_test_123', 'sub_test_123');
    const app = await createApp();
    const res = await app.request('/billing/portal', {
      headers: { Authorization: `Bearer ${record.key}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toBe('https://billing.stripe.com/session/test_session');
  });

  it('returns 400 for free user without stripe_customer_id', async () => {
    const record = createApiKey('free@example.com', 'free');
    const app = await createApp();
    const res = await app.request('/billing/portal', {
      headers: { Authorization: `Bearer ${record.key}` },
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('no_billing_account');
  });

  it('returns 401 without auth', async () => {
    const app = await createApp();
    const res = await app.request('/billing/portal');
    expect(res.status).toBe(401);
  });

  it('returns 500 when Stripe is not configured', async () => {
    delete process.env.STRIPE_SECRET_KEY;
    const record = createApiKey('nostripe@example.com', 'pro');
    updateStripeInfo(record.id, 'cus_ns', 'sub_ns');
    vi.resetModules();
    const app = await createApp();
    const res = await app.request('/billing/portal', {
      headers: { Authorization: `Bearer ${record.key}` },
    });
    expect(res.status).toBe(500);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
bun run vitest run tests/api/billing.test.ts
```

Expected: FAIL — module `../../src/api/billing` not found

- [ ] **Step 3: Implement the billing endpoint**

Create `src/api/billing.ts`:

```typescript
import { Hono } from 'hono';
import Stripe from 'stripe';
import type { ApiKeyRecord } from '../db';

export const billingRoute = new Hono();

billingRoute.get('/billing/portal', async (c) => {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    return c.json(
      { error: 'server_error', message: 'Stripe is not configured.' },
      500,
    );
  }

  const record = c.get('apiKey' as never) as ApiKeyRecord;

  if (!record.stripe_customer_id) {
    return c.json(
      {
        error: 'no_billing_account',
        message: 'No billing account. Subscribe to a paid plan first.',
        docs: 'https://og-engine.com/pricing',
      },
      400,
    );
  }

  const stripe = new Stripe(stripeSecretKey);
  const session = await stripe.billingPortal.sessions.create({
    customer: record.stripe_customer_id,
    return_url: 'https://og-engine.com/pricing',
  });

  return c.json({ url: session.url });
});
```

- [ ] **Step 4: Run billing tests**

```bash
bun run vitest run tests/api/billing.test.ts
```

Expected: all 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/api/billing.ts tests/api/billing.test.ts
git commit -m "feat: add GET /billing/portal for Stripe Customer Portal sessions"
```

---

## Task 6: Admin endpoint for free-tier quota reset

**Files:**
- Create: `src/api/admin.ts`
- Modify: `src/db/index.ts` (add `resetFreeQuotas` function)
- Test: `tests/api/admin.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/api/admin.test.ts`:

```typescript
import { Hono } from 'hono';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, createApiKey, findApiKeyByEmail, getDb } from '../../src/db';

beforeEach(() => {
  closeDb();
  process.env.DATABASE_URL = 'file::memory:';
  process.env.ADMIN_CRON_SECRET = 'test_admin_secret';
});

afterAll(() => {
  closeDb();
  delete process.env.DATABASE_URL;
  delete process.env.ADMIN_CRON_SECRET;
});

async function createApp() {
  const { adminRoute } = await import('../../src/api/admin');
  const app = new Hono();
  app.route('/', adminRoute);
  return app;
}

function postReset(app: Hono, secret?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (secret) headers.Authorization = `Bearer ${secret}`;
  return app.request('/admin/reset-free-quotas', { method: 'POST', headers });
}

describe('POST /admin/reset-free-quotas', () => {
  it('resets usage for all free users', async () => {
    const free1 = createApiKey('free1@example.com', 'free');
    const free2 = createApiKey('free2@example.com', 'free');
    const paid = createApiKey('paid@example.com', 'pro');

    // Simulate usage
    const db = getDb();
    db.prepare('UPDATE api_keys SET calls_used = 100 WHERE id = ?').run(free1.id);
    db.prepare('UPDATE api_keys SET calls_used = 200 WHERE id = ?').run(free2.id);
    db.prepare('UPDATE api_keys SET calls_used = 300 WHERE id = ?').run(paid.id);

    const app = await createApp();
    const res = await postReset(app, 'test_admin_secret');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.reset).toBe(2);

    // Verify free users reset
    expect(findApiKeyByEmail('free1@example.com')!.calls_used).toBe(0);
    expect(findApiKeyByEmail('free2@example.com')!.calls_used).toBe(0);
    // Verify paid user NOT reset
    expect(findApiKeyByEmail('paid@example.com')!.calls_used).toBe(300);
  });

  it('returns 401 without admin secret', async () => {
    const app = await createApp();
    const res = await postReset(app);
    expect(res.status).toBe(401);
  });

  it('returns 401 with wrong secret', async () => {
    const app = await createApp();
    const res = await postReset(app, 'wrong_secret');
    expect(res.status).toBe(401);
  });

  it('returns 500 when ADMIN_CRON_SECRET not configured', async () => {
    delete process.env.ADMIN_CRON_SECRET;
    const app = await createApp();
    const res = await postReset(app, 'anything');
    expect(res.status).toBe(500);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
bun run vitest run tests/api/admin.test.ts
```

Expected: FAIL — module `../../src/api/admin` not found

- [ ] **Step 3: Add `resetFreeQuotas` to the database module**

In `src/db/index.ts`, add this function after the existing `resetUsage` function (around line 165):

```typescript
export function resetFreeQuotas(): number {
  const d = getDb();
  const result = d.prepare(
    'UPDATE api_keys SET calls_used = 0, period_start = ? WHERE plan = ? AND active = 1',
  ).run(new Date().toISOString(), 'free');
  return result.changes;
}
```

- [ ] **Step 4: Implement the admin endpoint**

Create `src/api/admin.ts`:

```typescript
import { Hono } from 'hono';
import { resetFreeQuotas } from '../db';

export const adminRoute = new Hono();

adminRoute.post('/admin/reset-free-quotas', async (c) => {
  const cronSecret = process.env.ADMIN_CRON_SECRET;
  if (!cronSecret) {
    return c.json(
      { error: 'server_error', message: 'Admin cron secret not configured.' },
      500,
    );
  }

  const auth = c.req.header('Authorization');
  if (!auth?.startsWith('Bearer ') || auth.slice(7) !== cronSecret) {
    return c.json(
      { error: 'unauthorized', message: 'Invalid admin secret.' },
      401,
    );
  }

  const count = resetFreeQuotas();

  return c.json({
    reset: count,
    timestamp: new Date().toISOString(),
  });
});
```

- [ ] **Step 5: Run admin tests**

```bash
bun run vitest run tests/api/admin.test.ts
```

Expected: all 4 tests PASS

- [ ] **Step 6: Run full test suite**

```bash
bun run test
```

Expected: all tests pass

- [ ] **Step 7: Commit**

```bash
git add src/db/index.ts src/api/admin.ts tests/api/admin.test.ts
git commit -m "feat: add admin endpoint for monthly free-tier quota reset"
```

---

## Task 7: Register new routes in index.ts

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Add imports and routes**

In `src/index.ts`, add the new imports after the existing imports (after line 13):

```typescript
import { adminRoute } from './api/admin';
import { billingRoute } from './api/billing';
```

Inside the `if (authEnabled)` block (after line 66), add:

```typescript
  // Billing portal — requires auth
  app.use('/billing/*', authMiddleware());
```

In the public routes section (after line 72, after `app.route('/', webhooksRoute);`), add:

```typescript
app.route('/', adminRoute);
```

In the API routes section (after line 80, after `app.route('/', triggersRoute);`), add:

```typescript
app.route('/', billingRoute);
```

- [ ] **Step 2: Run type check**

```bash
bun run type-check
```

Expected: no errors

- [ ] **Step 3: Run full test suite**

```bash
bun run test
```

Expected: all tests pass

- [ ] **Step 4: Commit**

```bash
git add src/index.ts
git commit -m "feat: register billing portal and admin routes"
```

---

## Task 8: GitHub Action for monthly free-tier reset

**Files:**
- Create: `.github/workflows/reset-free-quotas.yml`

- [ ] **Step 1: Create the workflow file**

Create `.github/workflows/reset-free-quotas.yml`:

```yaml
name: Reset Free Tier Quotas

on:
  schedule:
    # 1st of each month at 00:05 UTC
    - cron: '5 0 1 * *'
  workflow_dispatch: # Allow manual trigger for testing

jobs:
  reset:
    runs-on: ubuntu-latest
    steps:
      - name: Reset free-tier quotas
        run: |
          response=$(curl -s -w "\n%{http_code}" -X POST \
            https://og-engine.com/admin/reset-free-quotas \
            -H "Authorization: Bearer ${{ secrets.ADMIN_CRON_SECRET }}" \
            -H "Content-Type: application/json")

          http_code=$(echo "$response" | tail -1)
          body=$(echo "$response" | head -n -1)

          echo "Status: $http_code"
          echo "Response: $body"

          if [ "$http_code" != "200" ]; then
            echo "::error::Reset failed with status $http_code"
            exit 1
          fi
```

- [ ] **Step 2: Validate YAML syntax**

```bash
cat .github/workflows/reset-free-quotas.yml | python3 -c "import sys,yaml; yaml.safe_load(sys.stdin)" && echo "Valid YAML"
```

Expected: "Valid YAML"

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/reset-free-quotas.yml
git commit -m "ci: add monthly GitHub Action cron for free-tier quota reset"
```

---

## Task 9: Update fly.toml with env var documentation

**Files:**
- Modify: `fly.toml`

- [ ] **Step 1: Add comments documenting new secrets**

At the top of `fly.toml`, update the existing comment block (line 1-3) to:

```toml
# Fly.io deployment config for OG Engine
# Deploy: fly deploy
# Secrets (set via fly secrets set):
#   STRIPE_SECRET_KEY       - Stripe API secret key
#   STRIPE_WEBHOOK_SECRET   - Stripe webhook signing secret
#   STRIPE_PRICE_STARTER    - Stripe Price ID for Starter plan
#   STRIPE_PRICE_PRO        - Stripe Price ID for Pro plan
#   STRIPE_PRICE_SCALE      - Stripe Price ID for Scale plan
#   RESEND_API_KEY           - Resend transactional email API key
#   ADMIN_CRON_SECRET        - Shared secret for GitHub Action cron
```

- [ ] **Step 2: Commit**

```bash
git add fly.toml
git commit -m "docs: document all required secrets in fly.toml"
```

---

## Task 10: Update pricing page with placeholder instructions

**Files:**
- Modify: `docs/site/src/content/docs/pricing.mdx`

- [ ] **Step 1: Add HTML comments for Payment Link replacement**

In `docs/site/src/content/docs/pricing.mdx`, replace the two placeholder Stripe URLs:

Line 96 — change:
```html
<a href="https://buy.stripe.com/starter" class="pricing-cta cta-outline">Get Started</a>
```
to:
```html
<!-- Replace with real Stripe Payment Link after creating in Stripe Dashboard -->
<a href="https://buy.stripe.com/STRIPE_PAYMENT_LINK_STARTER" class="pricing-cta cta-outline">Get Started</a>
```

Line 116 — change:
```html
<a href="https://buy.stripe.com/pro" class="pricing-cta cta-primary">Start Pro</a>
```
to:
```html
<!-- Replace with real Stripe Payment Link after creating in Stripe Dashboard -->
<a href="https://buy.stripe.com/STRIPE_PAYMENT_LINK_PRO" class="pricing-cta cta-primary">Start Pro</a>
```

- [ ] **Step 2: Commit**

```bash
git add docs/site/src/content/docs/pricing.mdx
git commit -m "docs: mark pricing page Stripe Payment Links as placeholders"
```

---

## Post-Implementation: Manual Stripe Dashboard Steps

After all code is deployed, you must complete these steps in the Stripe Dashboard:

1. **Create 3 Products** (Starter €10/mo, Pro €39/mo, Scale €99/mo)
2. **Copy Price IDs** → set as Fly.io secrets (`STRIPE_PRICE_STARTER`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_SCALE`)
3. **Create Payment Links** for Starter and Pro → update `pricing.mdx` with real URLs
4. **Configure Customer Portal** (allow plan switching, cancellation)
5. **Add Webhook Endpoint** → `https://og-engine.com/webhooks/stripe` with events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`
6. **Copy Webhook Signing Secret** → set as Fly.io secret (`STRIPE_WEBHOOK_SECRET`)
7. **Set remaining secrets** on Fly.io: `STRIPE_SECRET_KEY`, `RESEND_API_KEY`, `ADMIN_CRON_SECRET`
8. **Set `ADMIN_CRON_SECRET`** as a GitHub Actions secret
9. **Verify domain** in Resend for `og-engine.com`
