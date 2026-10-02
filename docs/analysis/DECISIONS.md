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

**PDF output:** free on all plans. This list enumerates every gate, and PDF is not on it. PDF is
therefore ungated in code and has no entry in `FEATURE_GATES`. The pricing page does not mention PDF
at all — that is a copy gap to close, not a gate to add.

**Wire behavior (WebP):** `output.format` arrives in the request body, so the gate cannot be
path-level `planGate` middleware. `outputFormatGate()` in `src/middleware/auth.ts` runs inside the
`/render`, `/render/from-url`, `/render/batch` and `/triggers` handlers after Zod parsing and
returns `402 plan_required`. `/triggers` is checked twice — once when the render config is saved,
and again on `/triggers/:id/fire`, because a saved trigger outlives the plan that created it and a
mid-period downgrade must stop paid renders.

**Rollout flag:** enforcement is off unless `WEBP_PAYWALL_ENABLED=true`. With the flag unset, free
keys keep receiving WebP exactly as before. Turning the paywall on is a customer-visible pricing
change for existing free users, so the flag flip needs the Growth Lead's go-ahead per deploy, and a
rollback is a one-line env change.

## Decision 3: /validate Authentication

**Decision:** Authenticated but free (accepts API key, does NOT count against quota)
**Rationale:** Auth allows tracking who validates (useful for analytics and future rate-limiting if abused), but metering would kill the DX value of "free unlimited validation." The endpoint accepts `Authorization: Bearer` header optionally — if provided, it's validated but not metered. If omitted, the request still succeeds (fully public for playground/testing).
**Wire behavior:** Optional auth. If key is present, it's validated. If absent, request proceeds without auth context. Never metered.

## Decision 4: /auth/register Key Delivery

**Decision:** For a **new** email, both — return the key in the HTTP response AND send it by email. For an **already-registered** email, return `409 account_exists` with no credential in the body and send no email.
**Rationale:** Instant access (key in response) preserves the "2 minutes to first image" promise for the activation path. Email provides a durable record and backup. The quick-start flow works without checking email.
**Amended (2026-10-01):** this decision originally said duplicate registration returns the existing key (per US-1.1), and the endpoint shipped that way. That was wrong. `/auth/register` is unauthenticated, so echoing the stored key back meant anyone who guessed or enumerated an email address received a working API key — unauthenticated credential disclosure, not idempotency. Options and accepted residual risk are recorded in ATY-68; Shape 1 (typed conflict) was chosen.
**Wire behavior (duplicate email):** `409` with `{ "error": "account_exists", "message": …, "docs": … }`. No `apiKey`, no `plan`, no `limit`. No email is sent — recovery is the caller's own `POST /auth/send-link` request, because auto-sending would let an anonymous caller put mail in a stranger's inbox. `409` rather than `200` so a client can diagnose the failure instead of discovering `apiKey` became `undefined`.
**Abuse bound:** `/auth/register` and `/auth/send-link` are rate limited at 20 requests/hour/IP (`src/index.ts`). Deliberately loose — signups can share a corporate NAT, and signup volume is a growth metric. `/auth/send-link`'s own limit is per-email (3 per 10 min) and therefore does not bound an attacker walking a list of addresses.
**Security note:** No email verification required for free tier. Paid upgrades go through Stripe which has its own verification.

## Decision 5: Quota Reset Mechanism

**Decision:** Billing-cycle based (Stripe `invoice.paid` webhook triggers reset for paid users; monthly cron on the 1st for free users)
**Rationale:** Billing-cycle resets are fair to users who sign up mid-month. Free users reset on the 1st (no Stripe invoice to trigger from). Documentation should say "resets each billing cycle" for paid plans and "resets on the 1st of each month" for free plans.

## Decision 6: Trial Period

**Decision:** No trial. Free tier IS the trial.
**Rationale:** GO-TO-MARKET.md's funnel is Free → Starter → Pro. A 14-day trial with full features undermines the free tier's purpose and adds Stripe complexity (trial periods, grace periods, trial-to-paid conversion). Delete all trial references.

## Decision 7: "Most Popular" Plan Badge

**Decision:** Pro (€39/mo)
**Rationale:** GTM revenue targets require ~€20 ARPU. Funneling users to Pro (€39) achieves this faster than Starter (€10). The "Most Popular" badge is aspirational positioning, not descriptive.

## Decision 8: Plan-Gated HTTP Status Code

**Decision:** 402 Payment Required
**Rationale:** Semantically correct — the user needs to pay to access this feature. 403 Forbidden implies permanent prohibition. 402 clearly communicates "upgrade to unlock." Update user stories to match.
