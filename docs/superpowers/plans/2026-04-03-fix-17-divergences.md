# Fix 17 Documentation Divergences — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reconcile all 17 divergences between docs/site and docs/analysis identified by the Legends Review, producing a single consistent documentation set aligned with canonical product decisions.

**Architecture:** First create a DECISIONS.md file that locks in the 8 product decisions. Then systematically update every docs/site page, the analysis documents, and CLAUDE.md to match those decisions. Each task targets one divergence cluster — related divergences are grouped to avoid contradictory intermediate states.

**Tech Stack:** Markdown/MDX editing only. No code changes — this is pure documentation reconciliation.

**Prerequisites:** The user must confirm the 8 product decisions in DECISIONS.md before any subsequent tasks execute. Task 1 creates the file with recommended defaults; the user reviews and approves.

---

## File Map

### Files to Create
- `docs/analysis/DECISIONS.md` — Canonical product decisions (source of truth)
- `docs/site/src/content/docs/api-reference/register.mdx` — New API reference page for POST /auth/register
- `docs/site/src/content/docs/api-reference/usage.mdx` — New API reference page for GET /usage

### Files to Modify
- `docs/site/src/content/docs/pricing.mdx` — Currency, trial, CTAs, "Most Popular" badge, quota reset language
- `docs/site/src/content/docs/index.mdx` — Minor: ensure benchmark claims match
- `docs/site/src/content/docs/quick-start.mdx` — /auth/register response format, async email flow
- `docs/site/src/content/docs/api-reference/overview.mdx` — Add missing endpoints to table, fix /validate auth
- `docs/site/src/content/docs/api-reference/render.mdx` — Fix 402 status, background image field naming note
- `docs/site/src/content/docs/api-reference/validate.mdx` — Auth requirement alignment
- `docs/site/src/content/docs/api-reference/batch.mdx` — Fix 402 status code
- `docs/site/src/content/docs/api-reference/errors.mdx` — Unify error shape, fix `docs` field, fix rate_limited body, fix 402/403
- `docs/site/src/content/docs/api-reference/health.mdx` — No changes needed (already consistent)
- `docs/site/src/content/docs/guides/error-handling.mdx` — Align error examples, fix retry semantics
- `docs/site/src/content/docs/guides/text-validation.mdx` — Auth alignment
- `docs/site/src/content/docs/guides/batch-rendering.mdx` — Fix plan_required status
- `docs/site/src/content/docs/sdk/installation.mdx` — Fix retries default
- `docs/site/src/content/docs/sdk/reference.mdx` — Fix batch() name, retry semantics, UsageResult shape
- `docs/site/src/content/docs/self-hosting/docker.mdx` — No changes needed
- `docs/site/src/content/docs/changelog.mdx` — No changes needed (describes v0.1.0 features only)
- `docs/analysis/USER-STORIES.md` — Update SDK method name, HTTP status, retry semantics
- `docs/analysis/MONETIZATION.md` — Update /validate middleware, /auth/register response, error shape
- `CLAUDE.md` — Fix free tier (500 not 1000), fix Pro price, add DECISIONS.md reference

---

## Task 1: Create DECISIONS.md — Lock in Product Decisions

**Files:**
- Create: `docs/analysis/DECISIONS.md`

This is the prerequisite for ALL other tasks. The user must review and approve before proceeding.

- [ ] **Step 1: Create DECISIONS.md with recommended defaults**

```markdown
# OG Engine — Canonical Product Decisions

> This file is the single source of truth for product decisions.
> All documentation, analysis, and implementation MUST align with these decisions.
> Last updated: 2026-04-03

## Decision 1: Currency

**Decision:** EUR (€)
**Rationale:** Company is Atypical Consulting SRL, based in Belgium. Stripe account is EUR-denominated. All public-facing content uses €. Analysis documents already use € — docs site must be updated from $ to €.

## Decision 2: Feature Gating Model

**Decision:** Volume-only (all features available on all plans)
**Rationale:** Simpler to implement, simpler to explain, simpler to maintain. The only gating is:
- **WebP output:** Starter+ (pure output format, not a core feature)
- **Batch endpoint:** Pro+ (operational convenience, not a core feature)
- **CDN caching:** Pro+ (infrastructure feature)
- **Custom JSON templates:** Scale only

All plans get: all 5 formats, all 4 built-in templates, all 8 fonts, /validate unlimited.

## Decision 3: /validate Authentication

**Decision:** Authenticated but free (accepts API key, does NOT count against quota)
**Rationale:** Auth allows tracking who validates (useful for analytics and future rate-limiting if abused), but metering would kill the DX value of "free unlimited validation." The endpoint accepts `Authorization: Bearer` header optionally — if provided, it's validated but not metered. If omitted, the request still succeeds (fully public for playground/testing).
**Wire behavior:** Optional auth. If key is present, it's validated. If absent, request proceeds without auth context. Never metered.

## Decision 4: /auth/register Key Delivery

**Decision:** Both — return key in HTTP response AND send by email
**Rationale:** Instant access (key in response) preserves the "2 minutes to first image" promise. Email provides a durable record and backup. The quick-start flow works without checking email. Duplicate registration returns the existing key (per US-1.1).
**Security note:** No email verification required for free tier. Paid upgrades go through Stripe which has its own verification.

## Decision 5: Quota Reset Mechanism

**Decision:** Billing-cycle based (Stripe `invoice.paid` webhook triggers reset for paid users; monthly cron on the 1st for free users)
**Rationale:** Billing-cycle resets are fair to users who sign up mid-month. Free users reset on the 1st (no Stripe invoice to trigger from). Documentation should say "resets each billing cycle" for paid plans and "resets on the 1st of each month" for free plans.

## Decision 6: Trial Period

**Decision:** No trial. Free tier IS the trial.
**Rationale:** GO-TO-MARKET.md's funnel is Free → Starter → Pro. A 14-day trial with full features undermines the free tier's purpose and adds Stripe complexity (trial periods, grace periods, trial-to-paid conversion). Delete all trial references.

## Decision 7: "Most Popular" Plan Badge

**Decision:** Pro ($39/mo)
**Rationale:** GTM revenue targets require ~$20 ARPU. Funneling users to Pro ($39) achieves this faster than Starter ($10). The "Most Popular" badge is aspirational positioning, not descriptive.

## Decision 8: Plan-Gated HTTP Status Code

**Decision:** 402 Payment Required
**Rationale:** Semantically correct — the user needs to pay to access this feature. 403 Forbidden implies permanent prohibition. 402 clearly communicates "upgrade to unlock." Update user stories to match.
```

- [ ] **Step 2: Ask the user to review and approve DECISIONS.md**

**STOP HERE.** Do not proceed to Task 2 until the user confirms all 8 decisions. If they change any decision, update DECISIONS.md first, then proceed.

---

## Task 2: Fix CLAUDE.md — Correct Free Tier and Pro Price (Divergences #2, #17)

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Fix the pricing section in CLAUDE.md**

In `CLAUDE.md`, find the section under "8. Key Decisions to Make" item 3 that reads:

```
→ Free tier: 1,000 renders/month. Pro: $29/mo for 50k renders. Scale: usage-based at $0.001/render.
```

Replace with:

```
→ Free tier: 500 renders/month. Starter: €10/mo for 10k. Pro: €39/mo for 50k. Scale: €99/mo for 200k. See docs/analysis/DECISIONS.md for canonical pricing.
```

- [ ] **Step 2: Add DECISIONS.md reference at top of CLAUDE.md**

After the existing "## 1. What the POC Proved" heading's introductory paragraph, add before section 2:

```markdown
> **Canonical decisions:** Product decisions (pricing, auth model, feature gating) are defined in `docs/analysis/DECISIONS.md`. That file is the source of truth — all documentation and implementation must align with it.
```

- [ ] **Step 3: Verify no other CLAUDE.md sections contradict DECISIONS.md**

Scan CLAUDE.md for any other pricing/quota mentions. The health endpoint example in section 4 is fine (doesn't mention pricing). The API design section is fine (structural, not pricing).

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "fix: correct free tier quota (500) and Pro price (€39) in CLAUDE.md"
```

---

## Task 3: Fix Pricing Page (Divergences #1, #3, #7, #10, #11)

**Files:**
- Modify: `docs/site/src/content/docs/pricing.mdx`

This task fixes: currency (already $, confirm), 14-day trial deletion, quota reset language, pricing CTAs, and "Most Popular" badge (already on Pro, confirm).

- [ ] **Step 1: Delete the 14-day trial FAQ entry**

In `pricing.mdx`, find and delete the entire FAQ block:

```markdown
### Is there a free trial?

Yes. Every paid plan includes a 14-day trial with full features. No credit card required.
```

- [ ] **Step 2: Fix quota reset language**

In `pricing.mdx`, find:

```
Monthly quotas reset on the 1st at 00:00 UTC. No per-second or per-minute caps — burst your entire quota in minutes if you need to.
```

Replace with:

```
Paid plan quotas reset each billing cycle (the anniversary of your signup date). Free plan quotas reset on the 1st of each month at 00:00 UTC. No per-second or per-minute caps — burst your entire quota in minutes if you need to.
```

- [ ] **Step 3: Fix the FAQ "Does unused quota roll over?" answer**

In `pricing.mdx`, find:

```
No. Quotas reset to zero on the 1st of each month.
```

Replace with:

```
No. Quotas reset to zero each billing cycle (paid plans) or on the 1st of each month (Free plan).
```

- [ ] **Step 4: Update pricing CTAs — Free stays as /quick-start/, paid plans get placeholder Stripe links**

In `pricing.mdx`, find each CTA and update:

Find:
```html
  <a href="/quick-start/" class="pricing-cta cta-outline">Get Started</a>
```
(the Starter CTA)

Replace with:
```html
  <a href="https://buy.stripe.com/starter" class="pricing-cta cta-outline">Get Started</a>
```

Find:
```html
  <a href="/quick-start/" class="pricing-cta cta-primary">Start Pro</a>
```
(the Pro CTA)

Replace with:
```html
  <a href="https://buy.stripe.com/pro" class="pricing-cta cta-primary">Start Pro</a>
```

Find:
```html
  <a href="/quick-start/" class="pricing-cta cta-outline">Contact Sales</a>
```
(the Scale CTA)

Replace with:
```html
  <a href="mailto:sales@og-engine.com" class="pricing-cta cta-outline">Contact Sales</a>
```

The Free CTA (`Start Free` → `/quick-start/`) stays as-is.

- [ ] **Step 5: Convert currency from $ to € across the entire pricing page**

In `pricing.mdx`, replace ALL occurrences of `<span class="currency">$</span>` with `<span class="currency">€</span>`. There are 4 instances (one per plan card: Free, Starter, Pro, Scale).

Also verify the `featured` class with "Most Popular" badge is on Pro (it already is). No change needed for badge.

- [ ] **Step 6: Commit**

```bash
git add docs/site/src/content/docs/pricing.mdx
git commit -m "fix(docs): convert pricing to EUR, remove phantom trial, fix quota reset, add Stripe CTAs"
```

---

## Task 4: Fix /validate Auth Across All Docs (Divergence #4)

**Files:**
- Modify: `docs/site/src/content/docs/api-reference/overview.mdx`
- Modify: `docs/site/src/content/docs/api-reference/validate.mdx`
- Modify: `docs/site/src/content/docs/guides/text-validation.mdx`

Per DECISIONS.md #3: /validate accepts auth optionally, never meters.

- [ ] **Step 1: Update API overview endpoint table**

In `overview.mdx`, find the endpoints table:

```markdown
| `POST` | `/validate` | Not required | Check if text fits a layout |
```

Replace with:

```markdown
| `POST` | `/validate` | Optional | Check if text fits a layout (free, unlimited) |
```

- [ ] **Step 2: Update validate.mdx auth section**

In `validate.mdx`, find:

```
**Authentication:** Not required
**Cost:** Free, unlimited, not metered against your plan quota
```

Replace with:

```
**Authentication:** Optional — accepts `Authorization: Bearer` header but does not require it
**Cost:** Free, unlimited, never metered against your plan quota
```

- [ ] **Step 3: Update text-validation guide**

In `text-validation.mdx`, find:

```
No `Authorization` header required. The response is always JSON:
```

Replace with:

```
The `Authorization` header is optional — if provided, your API key is validated but the call is never metered. The response is always JSON:
```

- [ ] **Step 4: Update MONETIZATION.md middleware**

In `docs/analysis/MONETIZATION.md`, find the routes section:

```typescript
app.use('/validate/*', authMiddleware)
```

Add a comment:

```typescript
app.use('/validate/*', optionalAuthMiddleware)  // Auth optional, never metered
```

- [ ] **Step 5: Commit**

```bash
git add docs/site/src/content/docs/api-reference/overview.mdx docs/site/src/content/docs/api-reference/validate.mdx docs/site/src/content/docs/guides/text-validation.mdx docs/analysis/MONETIZATION.md
git commit -m "fix(docs): align /validate auth to optional-but-free across all pages"
```

---

## Task 5: Add /auth/register API Reference Page (Divergences #5, #8, #12)

**Files:**
- Create: `docs/site/src/content/docs/api-reference/register.mdx`
- Modify: `docs/site/src/content/docs/api-reference/overview.mdx`
- Modify: `docs/site/src/content/docs/quick-start.mdx`

- [ ] **Step 1: Create register.mdx**

```markdown
---
title: POST /auth/register
description: Create a free account and receive an API key. No credit card required.
---

Register a new free-tier account with just an email address. Returns the API key immediately and sends a copy to the provided email.

\`\`\`
POST https://api.og-engine.com/auth/register
\`\`\`

**Authentication:** Not required

## Request Body

| Field | Type | Required | Description |
|---|---|---|---|
| `email` | string | Yes | Your email address |

## Example Request

\`\`\`bash
curl -X POST https://api.og-engine.com/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "you@example.com"}'
\`\`\`

## Response

\`\`\`json
{
  "apiKey": "oge_sk_a1b2c3d4e5f6...",
  "plan": "free",
  "limit": 500,
  "message": "API key also sent to you@example.com"
}
\`\`\`

### Response Fields

| Field | Type | Description |
|---|---|---|
| `apiKey` | string | Your new API key (prefix `oge_sk_`) |
| `plan` | string | Always `"free"` for new registrations |
| `limit` | number | Monthly render quota (500 for free plan) |
| `message` | string | Confirmation that the key was also emailed |

The API key is returned immediately in the response AND sent to the provided email address. The email includes the key, a curl example, and a link to the documentation.

## Duplicate Registration

If the email is already registered, the existing API key is returned (not a new one). This is idempotent — calling register twice with the same email produces the same result.

## Error Responses

| Status | Code | Cause |
|---|---|---|
| 400 | `missing_field` | `email` not provided |
| 400 | `invalid_request` | `email` is not a valid email address |

## Next Steps

- [Quick Start](/quick-start/) — use your new API key to generate your first image
- [API Reference Overview](/api-reference/overview/) — full endpoint documentation
- [Pricing](/pricing/) — upgrade to a paid plan for higher limits
```

- [ ] **Step 2: Add /auth/register and /usage to the API overview endpoint table**

In `overview.mdx`, find the endpoints table and add two rows:

```markdown
| `POST` | `/auth/register` | Not required | Create a free account and get an API key |
| `GET` | `/usage` | Required | Current quota usage for your API key |
```

Add these after the existing `/health` row.

- [ ] **Step 3: Update quick-start to mention email delivery**

In `quick-start.mdx`, find the Step 1 response:

```json
{ "apiKey": "oge_sk_a1b2c3...", "plan": "free", "limit": 500 }
```

Replace with:

```json
{ "apiKey": "oge_sk_a1b2c3...", "plan": "free", "limit": 500, "message": "API key also sent to you@example.com" }
```

And find:

```
Check your email — your API key is also in the response above.
```

Replace with:

```
Your API key is in the response above — ready to use immediately. A copy is also sent to your email for safekeeping.
```

- [ ] **Step 4: Commit**

```bash
git add docs/site/src/content/docs/api-reference/register.mdx docs/site/src/content/docs/api-reference/overview.mdx docs/site/src/content/docs/quick-start.mdx
git commit -m "feat(docs): add /auth/register API reference page, update quick-start and overview"
```

---

## Task 6: Add /usage API Reference Page (Divergence #5, #15)

**Files:**
- Create: `docs/site/src/content/docs/api-reference/usage.mdx`

- [ ] **Step 1: Create usage.mdx**

```markdown
---
title: GET /usage
description: Check your current quota usage, plan, and reset date.
---

Returns the current quota usage for your API key. This endpoint does not count as a render — calling it will never consume quota.

\`\`\`
GET https://api.og-engine.com/usage
\`\`\`

**Authentication:** Required (`Authorization: Bearer oge_sk_...`)

## Example Request

\`\`\`bash
curl https://api.og-engine.com/usage \
  -H "Authorization: Bearer oge_sk_YOUR_KEY"
\`\`\`

## Response

\`\`\`json
{
  "plan": "free",
  "limit": 500,
  "used": 142,
  "remaining": 358,
  "resetAt": "2026-05-01T00:00:00Z"
}
\`\`\`

### Response Fields

| Field | Type | Description |
|---|---|---|
| `plan` | string | Current plan: `free`, `starter`, `pro`, or `scale` |
| `limit` | number | Total monthly render quota |
| `used` | number | Renders consumed this billing cycle |
| `remaining` | number | Renders remaining (`limit - used`) |
| `resetAt` | string | ISO 8601 timestamp of next quota reset |

For paid plans, `resetAt` is the next billing cycle anniversary. For the free plan, it is the 1st of the next month at 00:00 UTC.

## Error Responses

| Status | Code | Cause |
|---|---|---|
| 401 | `unauthorized` | Missing or invalid API key |

## SDK Example

\`\`\`typescript
const { plan, used, remaining, resetAt } = await og.usage()

console.log(\`Plan: \${plan}\`)
console.log(\`Used: \${used} / \${used + remaining} renders\`)
console.log(\`Resets: \${new Date(resetAt).toLocaleDateString()}\`)
\`\`\`

## Next Steps

- [Pricing & Limits](/pricing/) — plan comparison and upgrade options
- [Error Handling](/guides/error-handling/) — rate limiting headers and retry strategies
- [API Reference Overview](/api-reference/overview/) — all endpoints
```

- [ ] **Step 2: Commit**

```bash
git add docs/site/src/content/docs/api-reference/usage.mdx
git commit -m "feat(docs): add /usage API reference page"
```

---

## Task 7: Unify Error Response Contract (Divergences #9, #10, #12)

**Files:**
- Modify: `docs/site/src/content/docs/api-reference/errors.mdx`
- Modify: `docs/site/src/content/docs/guides/error-handling.mdx`

Per DECISIONS.md: Canonical error shape is `{ error, message, details?, docs }` with `requestId` only on 500s. `docs` is present on ALL errors. HTTP 402 for plan-gating.

- [ ] **Step 1: Fix the `docs` field inconsistency in errors.mdx**

The error reference says `docs` is "Always present" but several examples omit it. Add the `docs` field to EVERY error example that lacks it.

In `errors.mdx`, find the unauthorized examples:

```json
{ "error": "unauthorized", "message": "No API key provided. Set the Authorization: Bearer <key> header." }
{ "error": "unauthorized", "message": "API key is invalid or does not exist." }
{ "error": "unauthorized", "message": "This API key has been revoked." }
```

Replace with:

```json
{ "error": "unauthorized", "message": "No API key provided. Set the Authorization: Bearer <key> header.", "docs": "https://og-engine.com/api-reference/errors#unauthorized" }
{ "error": "unauthorized", "message": "API key is invalid or does not exist.", "docs": "https://og-engine.com/api-reference/errors#unauthorized" }
{ "error": "unauthorized", "message": "This API key has been revoked.", "docs": "https://og-engine.com/api-reference/errors#unauthorized" }
```

In the server_error example, `requestId` replaces `docs` — this is acceptable. Update the schema table to clarify:

Find:
```
| `docs` | string | Yes | Link to this documentation page, anchored to the specific error |
```

Replace with:
```
| `docs` | string | Yes (except 500) | Link to this documentation page, anchored to the specific error |
| `requestId` | string | Only on 500 | Unique ID for support escalation |
```

- [ ] **Step 2: Fix the rate_limited error body to use canonical nested shape**

In `errors.mdx`, the rate_limited example already uses the nested shape with `details`. Verify it matches:

```json
{
  "error": "rate_limited",
  "message": "Monthly render quota exceeded. Resets 2024-02-01T00:00:00Z.",
  "details": {
    "limit": 500,
    "used": 500,
    "resetAt": "2024-02-01T00:00:00Z",
    "upgradeUrl": "https://og-engine.com/pricing"
  }
}
```

This is the canonical shape. Add the missing `docs` field:

```json
{
  "error": "rate_limited",
  "message": "Monthly render quota exceeded. Resets at next billing cycle.",
  "details": {
    "limit": 500,
    "used": 500,
    "resetAt": "2026-05-15T00:00:00Z",
    "upgradeUrl": "https://og-engine.com/pricing"
  },
  "docs": "https://og-engine.com/api-reference/errors#rate_limited"
}
```

Also update the date in the message to not say "Resets 2024-02-01" (stale) — use the generic "Resets at next billing cycle."

- [ ] **Step 3: Fix rate_limited example in error-handling.mdx**

In `error-handling.mdx`, find the rate_limited example:

```json
{
  "error": "rate_limited",
  "message": "Monthly render quota exceeded. Resets 2024-02-01T00:00:00Z.",
  "details": {
    "limit": 500,
    "used": 500,
    "resetAt": "2024-02-01T00:00:00Z",
    "upgradeUrl": "https://og-engine.com/pricing"
  }
}
```

Replace with:

```json
{
  "error": "rate_limited",
  "message": "Monthly render quota exceeded. Resets at next billing cycle.",
  "details": {
    "limit": 500,
    "used": 500,
    "resetAt": "2026-05-15T00:00:00Z",
    "upgradeUrl": "https://og-engine.com/pricing"
  },
  "docs": "https://og-engine.com/api-reference/errors#rate_limited"
}
```

- [ ] **Step 4: Add `docs` field to all error examples in error-handling.mdx that lack it**

Check each error example in `error-handling.mdx`. The `unauthorized` example at line 115-119 needs `docs` added:

Find:
```json
{
  "error": "unauthorized",
  "message": "No API key provided. Set the Authorization: Bearer <key> header.",
  "docs": "https://og-engine.com/quick-start#step-1"
}
```

This one already has `docs` — good. Verify all other examples have it. The `invalid_request`, `missing_field`, `invalid_font`, `invalid_format` examples need the `docs` field if missing.

- [ ] **Step 5: Commit**

```bash
git add docs/site/src/content/docs/api-reference/errors.mdx docs/site/src/content/docs/guides/error-handling.mdx
git commit -m "fix(docs): unify error response contract, add docs field to all examples"
```

---

## Task 8: Fix SDK Documentation (Divergences #13, #14, #15)

**Files:**
- Modify: `docs/site/src/content/docs/sdk/installation.mdx`
- Modify: `docs/site/src/content/docs/sdk/reference.mdx`

Per DECISIONS.md: SDK uses `batch()` (not `batchRender()`), 3 retries with exponential backoff, and `UsageResult` uses the canonical shape from Task 6.

- [ ] **Step 1: Verify SDK installation retries default**

In `installation.mdx`, the constructor example shows `retries: 3`. This is the canonical value. No change needed. Verify:

```typescript
const og = new OGEngine(process.env.OG_ENGINE_KEY!, {
  baseUrl: 'https://api.og-engine.com',
  timeout: 10000,
  retries: 3,
})
```

Good — no change.

- [ ] **Step 2: Verify SDK reference uses `batch()` not `batchRender()`**

In `reference.mdx`, the method is already `og.batch()`. No change needed. Verify the section header says `## og.batch()`.

Good — no change.

- [ ] **Step 3: Fix UsageResult type to match /usage API response**

In `reference.mdx`, find:

```typescript
interface UsageResult {
  plan: 'free' | 'starter' | 'pro' | 'scale'
  limit: number
  used: number
  remaining: number
  resetAt: string  // ISO 8601 timestamp
}
```

This already matches our canonical `/usage` response from Task 6. No change needed.

- [ ] **Step 4: Verify retry behavior documentation in SDK reference**

In `reference.mdx`, find the "Retry on 5xx" section:

```
The SDK retries failed requests on 5xx errors with exponential backoff (200ms, 400ms, 800ms). The retry count is configurable via the `retries` option (default: 3). Client errors (4xx) are never retried.
```

This is the canonical behavior. No change needed.

- [ ] **Step 5: Commit (only if changes were made)**

If any changes were needed:
```bash
git add docs/site/src/content/docs/sdk/installation.mdx docs/site/src/content/docs/sdk/reference.mdx
git commit -m "fix(docs): align SDK reference with canonical API contracts"
```

If no changes needed, skip this commit.

---

## Task 9: Update Analysis Documents to Match Decisions (Divergences #6, #13, #14, #15)

**Files:**
- Modify: `docs/analysis/USER-STORIES.md`
- Modify: `docs/analysis/MONETIZATION.md`

This task updates the analysis documents to align with DECISIONS.md where the docs site version is correct.

- [ ] **Step 1: Fix SDK method name in USER-STORIES.md**

In `USER-STORIES.md`, find US-9.1:

```
- Méthodes: `render()`, `validate()`, `batchRender()`, `usage()`
```

Replace with:

```
- Méthodes: `render()`, `validate()`, `batch()`, `usage()`, `health()`
```

- [ ] **Step 2: Fix SDK retry behavior in USER-STORIES.md**

In `USER-STORIES.md`, find US-9.1:

```
- Retry automatique sur erreur 5xx (1 retry, backoff 500ms)
```

Replace with:

```
- Retry automatique sur erreur 5xx (3 retries, exponential backoff 200ms/400ms/800ms)
```

- [ ] **Step 3: Fix HTTP status codes in USER-STORIES.md**

In `USER-STORIES.md`, find US-4.1:

```
- Si un utilisateur Starter tente un batch, retourner 403 avec message d'upgrade
```

Replace with:

```
- Si un utilisateur Starter tente un batch, retourner 402 `plan_required` avec message d'upgrade
```

In US-2.6, find:

```
- Si un utilisateur free demande du WebP, retourner une erreur 403 avec un message d'upgrade
```

Replace with:

```
- Si un utilisateur free demande du WebP, retourner une erreur 402 `plan_required` avec un message d'upgrade
```

- [ ] **Step 4: Fix error response shape in MONETIZATION.md**

In `MONETIZATION.md`, find the rate limit response in the auth middleware:

```typescript
    return c.json({
      error: 'Rate limit exceeded',
      limit: record.calls_limit,
      used: record.calls_used,
      plan: record.plan,
      upgrade_url: 'https://og-engine.com/#pricing'
    }, 429)
```

Replace with:

```typescript
    return c.json({
      error: 'rate_limited',
      message: `Monthly render quota exceeded. Resets at next billing cycle.`,
      details: {
        limit: record.calls_limit,
        used: record.calls_used,
        resetAt: record.period_end,
        upgradeUrl: 'https://og-engine.com/pricing'
      },
      docs: 'https://og-engine.com/api-reference/errors#rate_limited'
    }, 429)
```

- [ ] **Step 5: Fix /auth/register to return key in response**

In `MONETIZATION.md`, find section 5 "Free Tier (No Stripe)":

```
→ Generate API key, send by email, plan = "free", limit = 500.
```

Replace with:

```
→ Generate API key, return in HTTP response AND send by email. Response: `{ "apiKey": "oge_sk_...", "plan": "free", "limit": 500, "message": "API key also sent to {email}" }`
```

- [ ] **Step 6: Commit**

```bash
git add docs/analysis/USER-STORIES.md docs/analysis/MONETIZATION.md
git commit -m "fix(analysis): align user stories and monetization with DECISIONS.md"
```

---

## Task 10: Fix Quota Reset Language Across All Docs (Divergence #6)

**Files:**
- Modify: `docs/site/src/content/docs/api-reference/errors.mdx`
- Modify: `docs/site/src/content/docs/api-reference/overview.mdx`

Task 3 already fixed `pricing.mdx`. This task catches remaining instances.

- [ ] **Step 1: Fix errors.mdx rate limiting section**

In `errors.mdx`, find:

```
Quota resets on the first day of each calendar month at 00:00 UTC.
```

Replace with:

```
Paid plan quotas reset each billing cycle. Free plan quotas reset on the 1st of each month at 00:00 UTC.
```

- [ ] **Step 2: Fix overview.mdx rate limiting description**

In `overview.mdx`, find:

```
Render quota is metered monthly and resets on the first day of each calendar month.
```

Replace with:

```
Render quota is metered monthly. Paid plans reset each billing cycle; free plans reset on the 1st of each month.
```

- [ ] **Step 3: Commit**

```bash
git add docs/site/src/content/docs/api-reference/errors.mdx docs/site/src/content/docs/api-reference/overview.mdx
git commit -m "fix(docs): align quota reset language to billing-cycle model across all pages"
```

---

## Task 11: Add Starlight Sidebar Entries for New Pages

**Files:**
- Modify: `docs/site/astro.config.mjs` (or wherever the Starlight sidebar is configured)

- [ ] **Step 1: Find the sidebar configuration**

Run:
```bash
grep -r "sidebar" docs/site/astro.config.mjs
```

Or check `docs/site/astro.config.mjs` for the Starlight config with sidebar entries.

- [ ] **Step 2: Add register and usage to the API Reference section**

In the sidebar config, find the `api-reference` group and add entries for:
- `api-reference/register` — labeled "POST /auth/register"
- `api-reference/usage` — labeled "GET /usage"

Add them after the existing `/health` entry.

- [ ] **Step 3: Commit**

```bash
git add docs/site/astro.config.mjs
git commit -m "feat(docs): add /auth/register and /usage to sidebar navigation"
```

---

## Task 12: Final Verification Pass

- [ ] **Step 1: Search for any remaining "1st of each month" in docs/site**

Run:
```bash
grep -r "1st of each month\|1st at 00:00\|reset on the 1st\|calendar month" docs/site/src/content/
```

Any remaining instances (except in the Free plan context) need updating.

- [ ] **Step 2: Search for any remaining "403" for plan-gated features in docs/site**

Run:
```bash
grep -rn "403" docs/site/src/content/
```

Verify no 403 references remain for plan_required errors.

- [ ] **Step 3: Search for "14-day" or "trial" in docs/site**

Run:
```bash
grep -ri "trial\|14-day\|14 day" docs/site/src/content/
```

Verify all trial references are removed.

- [ ] **Step 4: Search for "batchRender" anywhere in the project**

Run:
```bash
grep -r "batchRender" docs/
```

Should only appear in USER-STORIES.md if Step 1 of Task 9 was missed.

- [ ] **Step 5: Verify all error examples include `docs` field**

Spot-check 3 error examples across different files to confirm the `docs` field is present.

- [ ] **Step 6: Commit any remaining fixes found**

```bash
git add -A
git commit -m "fix(docs): final verification pass — resolve remaining inconsistencies"
```

Only commit if changes were made. If verification found no issues, skip.

---

## Summary

| Task | Divergences Fixed | Files Changed |
|------|-------------------|---------------|
| 1. DECISIONS.md | All (foundational) | 1 created |
| 2. CLAUDE.md | #2, #17 | 1 modified |
| 3. Pricing page | #1, #3, #7, #10, #11 | 1 modified |
| 4. /validate auth | #4 | 4 modified |
| 5. /auth/register page | #5, #8, #12 | 3 (1 created, 2 modified) |
| 6. /usage page | #5, #15 | 1 created |
| 7. Error contract | #9, #10, #12 | 2 modified |
| 8. SDK docs | #13, #14, #15 | 2 verified (changes if needed) |
| 9. Analysis docs | #6, #13, #14, #15 | 2 modified |
| 10. Quota reset language | #6 | 2 modified |
| 11. Sidebar navigation | (structural) | 1 modified |
| 12. Verification pass | All remaining | Varies |
