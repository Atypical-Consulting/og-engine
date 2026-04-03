# Monetization Architecture — OG Engine

## Quick Start Revenue Stack

The fastest path from API to paid product. Zero custom payment UI.

---

## 1. Stripe Setup

### Products & Prices (Stripe Dashboard)

Create 4 products in Stripe:

| Plan | Price ID | Montant | Appels/mois |
|------|----------|---------|-------------|
| Free | — | 0€ | 500 |
| Starter | `price_starter_monthly` | 10€/mois | 10 000 |
| Pro | `price_pro_monthly` | 39€/mois | 50 000 |
| Scale | `price_scale_monthly` | 99€/mois | 200 000 |

### Stripe Checkout Links

For each paid plan, create a Stripe Payment Link in the dashboard.
These links go directly on the landing page buttons — no custom checkout code.

```
Starter: https://buy.stripe.com/xxx_starter
Pro:     https://buy.stripe.com/xxx_pro
Scale:   https://buy.stripe.com/xxx_scale
```

When a customer pays, Stripe sends a webhook to our API.

---

## 2. Database Schema (SQLite via Drizzle or Turso)

Minimal schema — 2 tables:

```sql
CREATE TABLE api_keys (
  id TEXT PRIMARY KEY,              -- uuid
  key TEXT UNIQUE NOT NULL,         -- "oge_sk_" + random 32 chars
  email TEXT NOT NULL,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  plan TEXT NOT NULL DEFAULT 'free', -- free | starter | pro | scale
  calls_limit INTEGER NOT NULL DEFAULT 500,
  calls_used INTEGER NOT NULL DEFAULT 0,
  period_start TEXT NOT NULL,        -- ISO date, resets monthly
  created_at TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE usage_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  api_key_id TEXT NOT NULL,
  endpoint TEXT NOT NULL,            -- /render or /render/batch
  render_time_ms REAL,
  format TEXT,
  created_at TEXT NOT NULL
);
```

---

## 3. Stripe Webhook Handler

```typescript
// src/api/webhooks.ts
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

const PLAN_LIMITS = {
  free: 500,
  starter: 10_000,
  pro: 50_000,
  scale: 200_000,
}

export async function handleStripeWebhook(req: Request) {
  const sig = req.headers.get('stripe-signature')!
  const body = await req.text()
  const event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object
      const email = session.customer_email!
      const customerId = session.customer as string
      const subscriptionId = session.subscription as string

      // Determine plan from price
      const sub = await stripe.subscriptions.retrieve(subscriptionId)
      const priceId = sub.items.data[0].price.id
      const plan = priceIdToPlan(priceId)

      // Generate API key
      const apiKey = 'oge_sk_' + crypto.randomUUID().replace(/-/g, '')

      // Save to DB
      await db.insert(apiKeys).values({
        id: crypto.randomUUID(),
        key: apiKey,
        email,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        plan,
        calls_limit: PLAN_LIMITS[plan],
        calls_used: 0,
        period_start: new Date().toISOString(),
        created_at: new Date().toISOString(),
      })

      // Send API key by email (use Resend or Postmark)
      await sendApiKeyEmail(email, apiKey, plan)
      break
    }

    case 'customer.subscription.updated': {
      // Plan change — update limits
      const sub = event.data.object
      const plan = priceIdToPlan(sub.items.data[0].price.id)
      await db.update(apiKeys)
        .set({ plan, calls_limit: PLAN_LIMITS[plan] })
        .where(eq(apiKeys.stripe_subscription_id, sub.id))
      break
    }

    case 'customer.subscription.deleted': {
      // Downgrade to free
      const sub = event.data.object
      await db.update(apiKeys)
        .set({ plan: 'free', calls_limit: 500 })
        .where(eq(apiKeys.stripe_subscription_id, sub.id))
      break
    }

    case 'invoice.paid': {
      // Monthly reset — new billing period
      const invoice = event.data.object
      const subId = invoice.subscription as string
      await db.update(apiKeys)
        .set({ calls_used: 0, period_start: new Date().toISOString() })
        .where(eq(apiKeys.stripe_subscription_id, subId))
      break
    }
  }

  return new Response('ok')
}
```

---

## 4. API Key Middleware

```typescript
// src/middleware/auth.ts
import { createMiddleware } from 'hono/factory'

export const authMiddleware = createMiddleware(async (c, next) => {
  const auth = c.req.header('Authorization')
  if (!auth?.startsWith('Bearer ')) {
    return c.json({ error: 'Missing API key' }, 401)
  }

  const key = auth.slice(7)
  const record = await db.select().from(apiKeys).where(eq(apiKeys.key, key)).get()

  if (!record || !record.active) {
    return c.json({ error: 'Invalid API key' }, 401)
  }

  if (record.calls_used >= record.calls_limit) {
    return c.json({
      error: 'Rate limit exceeded',
      limit: record.calls_limit,
      used: record.calls_used,
      plan: record.plan,
      upgrade_url: 'https://og-engine.com/#pricing'
    }, 429)
  }

  // Increment usage
  await db.update(apiKeys)
    .set({ calls_used: record.calls_used + 1 })
    .where(eq(apiKeys.id, record.id))

  // Attach to context
  c.set('apiKey', record)
  await next()
})
```

---

## 5. Free Tier (No Stripe)

For the free tier, users sign up with just an email:

```
POST /auth/register
{ "email": "user@example.com" }
```

→ Generate API key, send by email, plan = "free", limit = 500.

No Stripe involved. This maximizes conversion to try the API.

---

## 6. Email Delivery (Resend)

Use Resend (resend.com) — simplest transactional email service.

```typescript
import { Resend } from 'resend'
const resend = new Resend(process.env.RESEND_API_KEY)

async function sendApiKeyEmail(email: string, apiKey: string, plan: string) {
  await resend.emails.send({
    from: 'OG Engine <api@og-engine.com>',
    to: email,
    subject: 'Your OG Engine API Key',
    html: `
      <h2>Welcome to OG Engine!</h2>
      <p>Your API key (plan: ${plan}):</p>
      <code style="background:#f0f0f0;padding:8px 16px;border-radius:4px;font-size:16px;">
        ${apiKey}
      </code>
      <p>Quick start:</p>
      <pre>curl -X POST https://api.og-engine.com/render \
  -H "Authorization: Bearer ${apiKey}" \
  -H "Content-Type: application/json" \
  -d '{"format":"og","title":"Hello World"}'</pre>
      <p><a href="https://og-engine.com/docs">Read the docs →</a></p>
    `
  })
}
```

---

## 7. Routes Summary

```typescript
// src/index.ts
import { Hono } from 'hono'
import { cors } from 'hono/cors'

const app = new Hono()

// Public routes
app.get('/health', healthHandler)
app.post('/auth/register', registerHandler)      // Free tier signup
app.post('/webhooks/stripe', stripeWebhookHandler) // Stripe webhooks

// Protected routes (require API key)
app.use('/render/*', authMiddleware)
app.use('/validate/*', optionalAuthMiddleware)  // Auth optional, never metered

app.post('/render', renderHandler)                // Generate image
app.post('/render/batch', batchRenderHandler)      // Batch generation (Pro+)
app.post('/validate', validateHandler)             // Text fit check (free, no metering)

// Usage dashboard
app.get('/usage', authMiddleware, usageHandler)    // Current usage stats

export default app
```

---

## 8. Deployment Checklist

```bash
# Environment variables needed:
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
RESEND_API_KEY=re_xxx
DATABASE_URL=file:./data/og-engine.db   # SQLite for MVP
API_BASE_URL=https://api.og-engine.com
```

### Fly.io deployment (recommended for MVP):

```bash
fly launch --name og-engine
fly secrets set STRIPE_SECRET_KEY=sk_live_xxx
fly secrets set STRIPE_WEBHOOK_SECRET=whsec_xxx
fly secrets set RESEND_API_KEY=re_xxx
fly deploy
```

### Domain setup:
- `og-engine.com` → landing page (Vercel/Cloudflare Pages)
- `api.og-engine.com` → API server (Fly.io)

---

## 9. MVP Definition

Ship when you have:
- [ ] `POST /render` returning PNG ✅
- [ ] `POST /validate` returning JSON ✅
- [ ] `POST /auth/register` generating free API key ✅
- [ ] Stripe webhook creating paid API keys ✅
- [ ] Auth middleware with usage counting ✅
- [ ] Rate limiting (429 when over limit) ✅
- [ ] Landing page deployed with Stripe Payment Links ✅
- [ ] Email delivery of API keys ✅
- [ ] One `fly deploy` away from production ✅

**That's it. Ship it. Iterate after revenue.**
