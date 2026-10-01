# Docs-site analytics and signup attribution

First-party, cookieless, zero recurring cost. Answers two questions:

1. **Per-page traffic** — for any docs URL over a window: page views, sessions, and the source
   (organic search / AI assistant / social / referral / campaign / direct) each session arrived with.
2. **Attribution** — for a signup created by `POST /auth/register`, which page the visitor last read.

Nothing is sent to a third party. There is no analytics vendor, no subscription, and no new dependency:
the data lives in the SQLite database the service already runs on.

---

## How a page view is recorded

`pageViewTracking()` (`src/middleware/analytics.ts`) is mounted in `src/index.ts` immediately before the
static docs handler. Every API route is registered ahead of it, so it only ever wraps requests that
reach the docs site. It records a row when **all** of these hold:

- method is `GET`
- response status is `200`
- response `Content-Type` is `text/html` (so assets, JSON and 404s are skipped)
- the request is not a prefetch (`Sec-Purpose: prefetch`)
- the user agent is not a known crawler, monitor or scripted client

A failure inside the middleware is logged and swallowed. Analytics never takes the docs site down.

Turn the whole thing off with `ANALYTICS_ENABLED=false`. No migration, no redeploy of new code.

## Identity: cookieless, daily-rotating

There is no cookie and no `localStorage`. Each request gets two hashes, both salted with a secret
that **rotates every UTC day** (`analytics_salts`):

| Hash | Input | Purpose |
|---|---|---|
| `visitor_hash` | daily salt + client IP + user agent | identifies one browser for one day |
| `network_hash` | daily salt + client IP | joins a browser read to a terminal `curl` from the same machine |

**No raw IP and no user-agent string is ever written to disk.** Because the salt rotates daily and is
never exported, yesterday's hashes cannot be re-derived or joined to today's. This is the same
construction Plausible and Fathom use, and it is why no consent banner is required.

Sessions: a page view joins the visitor's existing session if their previous view was within
`SESSION_TIMEOUT_MINUTES` (30), otherwise it opens a new one. The first view of a session is the
landing page and carries the arrival source; later views inherit that source, so a per-page breakdown
reads "where did the people reading this page come from" rather than "they clicked an internal link".

## Attribution: three strategies, reported separately

og-engine has two very different signup paths — the in-page `SignupForm`, and a `curl` pasted into a
terminal from the quick-start page. No single mechanism covers both, so attribution is layered and the
tier used is stored on every row as `confidence`:

| `confidence` | How it was resolved | Accuracy |
|---|---|---|
| `explicit` | the caller sent `?src=<page path>` — the signup form appends it, and the documented curl snippets carry it | exact |
| `visitor` | the same browser (IP + user agent) read a docs page in the last 24h | exact for the in-page form |
| `network` | the same public IP read a docs page in the last 60 minutes | right most of the time; **wrong behind shared NAT** |
| `none` | nothing matched | unattributed, and counted as such |

`network` is the tier that catches "read the docs, then ran curl". It is kept as its own tier rather
than silently folded into the total so a reader can discount it. **Read `byConfidence` before you trust
a conversion rate.**

### Known limits — state these when you report numbers

- Cross-device (reads on a laptop, signs up on a phone) is not joined and lands in `none`.
- A corporate or café NAT can attribute a signup to a page a *different* person read → `network` tier.
- A user who strips `?src=` from the curl snippet falls back to `network`.
- Data starts at deploy. There is no backfill; pre-deploy traffic does not exist in these tables.

## Retention

`page_views` rows are purged after 180 days, salts after 2 days (`purgeOldAnalytics()`, run once per
process on the first recorded page view).

---

## Running the numbers

### Via the API (what to paste into a report)

Both endpoints are read-only, aggregate-only, and use the existing `ADMIN_CRON_SECRET` bearer token —
the same one `/admin/reset-free-quotas` uses. No new secret.

```bash
# Question 1 — per-page traffic with source/referrer broken out
curl -s -H "Authorization: Bearer $ADMIN_CRON_SECRET" \
  "https://og-engine.com/admin/analytics/pages?days=30" | jq

# Question 2 — sessions → signups per page, plus attribution confidence
curl -s -H "Authorization: Bearer $ADMIN_CRON_SECRET" \
  "https://og-engine.com/admin/analytics/funnel?days=30" | jq
```

A compact table from the funnel endpoint:

```bash
curl -s -H "Authorization: Bearer $ADMIN_CRON_SECRET" \
  "https://og-engine.com/admin/analytics/funnel?days=30" \
  | jq -r '["PAGE","SESSIONS","SIGNUPS","CONV%"], (.rows[] | [.path, .sessions, .signups, .conversionRate]) | @tsv' \
  | column -t
```

### Via SQL (direct against the database on the box)

```sql
-- Per-page traffic, last 30 days, with source breakdown
SELECT path,
       COUNT(*)                     AS pageviews,
       COUNT(DISTINCT session_id)   AS sessions,
       SUM(is_entry)                AS entries,
       source,
       COALESCE(referrer_host, '—') AS referrer
FROM page_views
WHERE created_at >= datetime('now', '-30 days')
GROUP BY path, source, referrer_host
ORDER BY sessions DESC;

-- Page → signup, last 30 days
SELECT pv.path,
       COUNT(DISTINCT pv.session_id) AS sessions,
       COALESCE(s.signups, 0)        AS signups,
       ROUND(100.0 * COALESCE(s.signups, 0) / COUNT(DISTINCT pv.session_id), 2) AS conversion_pct
FROM page_views pv
LEFT JOIN (
  SELECT last_page, COUNT(*) AS signups
  FROM signup_attribution
  WHERE created_at >= datetime('now', '-30 days')
  GROUP BY last_page
) s ON s.last_page = pv.path
WHERE pv.created_at >= datetime('now', '-30 days')
GROUP BY pv.path
ORDER BY signups DESC, sessions DESC;

-- How much of the attribution can you actually trust?
SELECT confidence, COUNT(*) AS signups
FROM signup_attribution
WHERE created_at >= datetime('now', '-30 days')
GROUP BY confidence;
```

## Event schema — do not rename these

`source` values: `direct`, `organic_search`, `ai_assistant`, `social`, `referral`, `campaign`.
`confidence` values: `explicit`, `visitor`, `network`, `none`.

Renaming any of them silently destroys the historical funnel. Add a value rather than repurposing one.

## Relationship to the Umami tag

`docs/site/src/components/Analytics.astro` can emit an Umami tag when `PUBLIC_UMAMI_WEBSITE_ID` is set
at build time. It is unset, so no tag ships today. Umami is complementary, not required: it would give
richer client-side behaviour (scroll, clicks) but cannot see `POST /auth/register`, so it cannot answer
question 2 on its own. Umami Cloud is a paid subscription beyond its free tier, and self-hosting it
needs another container plus a Postgres database. Neither is needed for the two questions above.
