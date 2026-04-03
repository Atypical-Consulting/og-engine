# Stripe Production Integration — Design Spec

> **Status:** Approved
> **Date:** 2026-04-03
> **Approach:** Payment Links + Webhooks (Approach A)
> **Scope:** Full production Stripe integration including Customer Portal, Resend emails, and free-tier cron reset

---

## 1. Stripe Dashboard Setup

Configure in Stripe Dashboard (test mode first, then live).

### Products & Prices

| Product | Price | Env var for Price ID |
|---------|-------|---------------------|
| OG Engine Starter | €10/mo recurring | `STRIPE_PRICE_STARTER` |
| OG Engine Pro | €39/mo recurring | `STRIPE_PRICE_PRO` |
| OG Engine Scale | €99/mo recurring | `STRIPE_PRICE_SCALE` |

### Payment Links

One per paid product (Starter, Pro). Scale uses `mailto:sales@og-engine.com`.

- Collect email + create Stripe Customer
- Success URL: `https://og-engine.com/quick-start/?checkout=success`
- Real URLs replace placeholders in pricing page after creation

### Customer Portal

- Allow plan switching between Starter/Pro/Scale
- Allow cancellation
- No pause option

### Webhook Endpoint

- URL: `https://og-engine.com/webhooks/stripe`
- Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`

---

## 2. Dependencies & Environment Variables

### New npm dependencies

- `stripe` — Stripe SDK for webhook verification and Customer Portal sessions
- `resend` — transactional email delivery

### New environment variables

| Variable | Purpose |
|----------|---------|
| `STRIPE_SECRET_KEY` | `sk_test_...` / `sk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` from webhook endpoint config |
| `STRIPE_PRICE_STARTER` | Price ID for Starter plan |
| `STRIPE_PRICE_PRO` | Price ID for Pro plan |
| `STRIPE_PRICE_SCALE` | Price ID for Scale plan |
| `RESEND_API_KEY` | `re_...` |
| `ADMIN_CRON_SECRET` | Shared secret for GitHub Action cron |

No changes to existing env vars (`DATABASE_URL`, `PORT`, `AUTH_ENABLED`, etc.).

---

## 3. Webhook Handler Rewrite

**File:** `src/api/webhooks.ts`

### Changes

- Import `Stripe` from the `stripe` SDK
- Use `stripe.webhooks.constructEvent(body, signature, webhookSecret)` for cryptographic signature verification
- On `checkout.session.completed`:
  - Retrieve the subscription via `stripe.subscriptions.retrieve()` to get the actual `price.id`
  - Match email to existing free account — if found, upgrade in place (no new key); if not found, create new key with paid plan
  - Call `updateStripeInfo()` with customer ID and subscription ID
  - Send welcome email via Resend with API key + plan details
- On `customer.subscription.updated`:
  - Same plan update logic as current, but with verified signature
  - Send upgrade notification email
- On `customer.subscription.deleted`:
  - Downgrade to free (same as current, verified)
  - Send downgrade notification email
- On `invoice.paid`:
  - Reset usage (same as current, verified)

### Constraints

- Raw body must be read via `c.req.text()` before any JSON parsing (already correct in current code)
- No body-parser middleware may touch this route

---

## 4. Customer Portal Endpoint

**New file:** `src/api/billing.ts`

### Route: `GET /billing/portal`

1. Requires `authMiddleware()` (existing)
2. Looks up `stripe_customer_id` from the API key record
3. If no `stripe_customer_id` (free user), returns 400: `"No billing account. Subscribe to a paid plan first."`
4. Calls `stripe.billingPortal.sessions.create({ customer, return_url: "https://og-engine.com/pricing" })`
5. Returns `{ url: "https://billing.stripe.com/session/..." }`

Not metered. Protected by `authMiddleware()` same as `/usage`.

---

## 5. Resend Email Integration

**New file:** `src/email/send.ts`

### Email functions

| Function | Trigger | Content |
|----------|---------|---------|
| `sendWelcomeEmail(email, apiKey, plan)` | Free registration or paid checkout | API key, plan details, curl example, docs link |
| `sendUpgradeEmail(email, plan)` | `customer.subscription.updated` | New plan, new limits, portal link |
| `sendDowngradeEmail(email)` | `customer.subscription.deleted` | Downgrade confirmation, key still active |

### Configuration

- **Sender:** `OG Engine <api@og-engine.com>` (requires verified domain in Resend)
- **Fallback:** If `RESEND_API_KEY` is not set, log a warning and skip email silently. Dev/test environments work without Resend.
- **No template engine** — inline HTML strings, simple transactional emails.

### Integration points

- `src/api/register.ts` — replace TODO with `sendWelcomeEmail()` call
- `src/api/webhooks.ts` — call appropriate email function after each webhook event

---

## 6. Free-Tier Monthly Reset

### GitHub Action

**New file:** `.github/workflows/reset-free-quotas.yml`

- **Schedule:** `cron: '5 0 1 * *'` (1st of each month, 00:05 UTC)
- **Action:** `POST https://og-engine.com/admin/reset-free-quotas` with `Authorization: Bearer <ADMIN_CRON_SECRET>`
- **Secret:** `ADMIN_CRON_SECRET` stored in GitHub Actions secrets

### Admin Endpoint

**New file:** `src/api/admin.ts`

**Route:** `POST /admin/reset-free-quotas`

1. Checks `Authorization: Bearer` header against `ADMIN_CRON_SECRET` env var (separate from user API key auth)
2. Runs: `UPDATE api_keys SET calls_used = 0, period_start = <now> WHERE plan = 'free'`
3. Returns `{ reset: <count>, timestamp: "..." }`

---

## 7. Pricing Page Updates

**File:** `docs/site/src/content/docs/pricing.mdx`

- Replace `https://buy.stripe.com/starter` → real Stripe Payment Link for Starter
- Replace `https://buy.stripe.com/pro` → real Stripe Payment Link for Pro
- Scale stays as `mailto:sales@og-engine.com` (unchanged)
- No structural changes — URL swaps only
- Marked as `STRIPE_PAYMENT_LINK_STARTER` / `STRIPE_PAYMENT_LINK_PRO` placeholders until links are created in dashboard

---

## 8. File Change Summary

| Action | File | What |
|--------|------|------|
| **Add** | `src/email/send.ts` | Resend integration, 3 email functions |
| **Add** | `src/api/billing.ts` | `GET /billing/portal` Customer Portal endpoint |
| **Add** | `src/api/admin.ts` | `POST /admin/reset-free-quotas` cron endpoint |
| **Add** | `.github/workflows/reset-free-quotas.yml` | Monthly cron for free-tier reset |
| **Modify** | `package.json` | Add `stripe` and `resend` dependencies |
| **Modify** | `src/api/webhooks.ts` | Real signature verification, Stripe SDK, email sends |
| **Modify** | `src/api/register.ts` | Send welcome email via Resend |
| **Modify** | `src/index.ts` | Register billing + admin routes |
| **Modify** | `docs/site/src/content/docs/pricing.mdx` | Replace placeholder Payment Link URLs |
| **Modify** | `fly.toml` | Document new env vars in comments |

**No changes to:** database schema, auth middleware, engine code, templates, renderer, or any existing API behavior.

**Total: 4 new files, 6 modified files.**

---

## 9. References

- **Canonical decisions:** `docs/analysis/DECISIONS.md`
- **Monetization architecture:** `docs/analysis/MONETIZATION.md`
- **User stories:** `docs/analysis/USER-STORIES.md` (US-1.2, US-1.3, US-1.4, US-5.3)
- **Go-to-market:** `docs/analysis/GO-TO-MARKET.md`
