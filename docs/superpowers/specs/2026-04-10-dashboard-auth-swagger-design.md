# Dashboard, Auth & Swagger — Design Spec

**Date:** 2026-04-10  
**Status:** Approved  
**Scope:** Add magic-link authentication, an htmx-powered dashboard, and OpenAPI/Swagger documentation to the existing Hono server.

---

## 1. Overview

OG Engine currently operates as an API-only service with a separate Astro/Starlight documentation site. Users register via `POST /register`, receive an API key, and manage billing through Stripe's hosted portal. There is no user-facing dashboard, no login flow, and no OpenAPI spec.

This spec adds three capabilities:

1. **Magic-link authentication** — passwordless login via email (Resend)
2. **Dashboard** — an htmx-powered UI served from the Hono server for managing subscriptions, API keys, render history, and more
3. **OpenAPI/Swagger** — auto-generated spec from Zod schemas with Swagger UI

All three live inside the existing Hono process as new route groups.

---

## 2. Architecture

### Route Namespacing

Existing API endpoints move under `/api/*`:

| Before | After |
|---|---|
| `POST /render` | `POST /api/render` |
| `POST /validate` | `POST /api/validate` |
| `POST /render/from-url` | `POST /api/render/from-url` |
| `POST /render/batch` | `POST /api/render/batch` |
| `GET /health` | `GET /api/health` |
| `POST /register` | `POST /api/register` |
| `GET /usage` | `GET /api/usage` |
| `POST /templates` | `POST /api/templates` |
| `GET /templates/:id` | `GET /api/templates/:id` |
| `POST /triggers` | `POST /api/triggers` |
| `GET /billing/portal` | `GET /api/billing/portal` |
| `POST /webhooks/stripe` | `POST /api/webhooks/stripe` |
| `POST /admin/reset-free-quotas` | `POST /api/admin/reset-free-quotas` |

New route groups:

- **`/auth/*`** — login page, magic link sending, token verification, logout
- **`/dashboard/*`** — all 8 dashboard sections (HTML pages / htmx partials)
- **`/docs`** — Swagger UI
- **`/api/openapi.json`** — raw OpenAPI 3.1 spec

### Single Process

The dashboard, auth, and Swagger routes are added to the existing Hono server. No separate process or deployment. The dashboard accesses the render engine and SQLite database in-process — no internal HTTP calls needed for re-renders or data queries.

---

## 3. Authentication

### Magic Link Flow

1. **`GET /auth/login`** — renders a page with an email input form
2. **`POST /auth/send-link`** — validates email, creates a token in `magic_links` table, sends email via Resend with a verification URL. Returns a "check your email" confirmation page.
3. **`GET /auth/verify?token=<token>`** — validates token (not expired, not used), marks it as used, creates or retrieves the `users` row, creates a session in `sessions` table, sets an `HttpOnly` session cookie, redirects to `/dashboard`
4. **`POST /auth/logout`** — deletes the session from DB, clears the cookie, redirects to `/auth/login`

### Magic Link Tokens

- Generated with `crypto.randomUUID()` (128 bits of entropy)
- Stored as SHA-256 hashes in the database (never plain text)
- Expire after 15 minutes
- Single-use — marked `used = true` after verification
- Rate-limited: max 3 requests per email per 10 minutes

### Session Management

- Session token generated with `crypto.randomUUID()`
- Stored as SHA-256 hash in `sessions` table
- Set as `HttpOnly` / `Secure` / `SameSite=Lax` cookie
- `Secure` flag skipped in development (non-HTTPS)
- 30-day rolling expiry — `expires_at` refreshed on each authenticated request
- Session middleware reads cookie, looks up session in SQLite, attaches user to Hono context

### Account Creation

When a user verifies a magic link for the first time (no existing `users` row for that email):

1. Create a `users` row
2. If an `api_keys` row exists with the same email, link it via `user_id` FK
3. If no `api_keys` row exists, create a free-tier API key automatically

Returning users just get a new session — no account creation.

---

## 4. Dashboard

### Technology

- **htmx** (vendored, ~14kb gzipped) — no build step, no bundler
- **Plain CSS** — single `dashboard.css` file served from `/static/`
- **Template literal functions** — each view is a TypeScript function returning an HTML string. No template engine dependency.

### Shell Pattern

A single full-page load delivers the shell layout:

- Fixed sidebar with navigation links
- Header with page title
- `#main-content` div for page content
- User email and logout link at the bottom of the sidebar

Subsequent navigation uses htmx partial swaps:

```html
<a hx-get="/dashboard/images"
   hx-target="#main-content"
   hx-push-url="true">
  Images
</a>
```

The server detects htmx requests via the `HX-Request` header:
- **htmx request:** returns only the inner content HTML fragment
- **Direct navigation** (bookmark, refresh): returns the full page with shell

### Dashboard Sections

#### 4.1 Overview (`GET /dashboard`)

- Plan name, price, and status
- Usage meter: calls used / calls limit with progress bar
- Average render time (last 7 days)
- Recent renders list (last 10) with "View all" link to Images section

#### 4.2 Images (`GET /dashboard/images`)

- Paginated table of render history entries
- Each row: title (from request payload), format, template, render time, timestamp
- **Re-render button** (`hx-post="/dashboard/images/:id/render"`) — calls the render engine in-process with the stored request payload, returns the image inline or as a download
- **Metadata only** — no images are stored. The `render_history` table holds the request payload (JSON). Thumbnails are generated on demand.
- Infinite scroll via `hx-trigger="revealed"` on the last row
- Filters: format, template, date range

#### 4.3 API Keys (`GET /dashboard/api-keys`)

- List of user's API keys with masked display (show last 8 chars)
- Copy-to-clipboard button (brief full reveal)
- Last used timestamp per key
- **Create new key** (`hx-post="/dashboard/api-keys"`)
- **Revoke key** (`hx-delete="/dashboard/api-keys/:id"` with `hx-confirm`)
- **Regenerate key** (`hx-post="/dashboard/api-keys/:id/regenerate"` with `hx-confirm`)

#### 4.4 Billing (`GET /dashboard/billing`)

- Current plan name, price, and next billing date
- Usage meter (same as overview)
- **"Manage Subscription" button** — regular link (not htmx) to Stripe Customer Portal via `GET /api/billing/portal`. Handles upgrade, downgrade, cancellation, and payment method updates.
- Recent invoices (fetched from Stripe API on page load)

#### 4.5 Usage Analytics (`GET /dashboard/usage`)

- Usage chart: renders per day over the selected period (server-rendered SVG bars or simple HTML/CSS bars)
- Date range picker (`hx-get` with query params swaps the chart area)
- Breakdown by endpoint, format, and template
- Quota warning when usage exceeds 80%

#### 4.6 Custom Templates (`GET /dashboard/templates`)

- List of user's custom templates (Scale tier only)
- **Create template** — JSON editor (textarea) with live preview (`hx-post` on save, preview via debounced `hx-trigger="keyup changed delay:500ms"`)
- **Edit / Delete** — inline editing with `hx-put` / `hx-delete`
- Plan gate: non-Scale users see the list with an upgrade prompt

#### 4.7 Webhooks (`GET /dashboard/webhooks`)

- Table of webhook triggers with status (active/inactive)
- **Create** (`hx-post`), **Edit** (`hx-put`), **Delete** (`hx-delete`)
- **Test button** (`hx-post="/dashboard/webhooks/:id/test"`) — sends a test payload and shows the response inline
- Delivery log: last 10 deliveries with status codes

#### 4.8 Settings (`GET /dashboard/settings`)

- Email display (read-only — changing email requires a new magic link verification)
- Notification preferences (email on quota warning, weekly usage digest)
- **Delete account** (`hx-delete="/dashboard/settings/account"` with `hx-confirm`) — deletes user, revokes all keys, cancels Stripe subscription

### htmx Interaction Summary

| Action | htmx attribute | Pattern |
|---|---|---|
| Navigate sections | `hx-get` + `hx-target="#main-content"` + `hx-push-url` | Partial swap |
| Create / update | `hx-post` / `hx-put` + `hx-target` | Replace element |
| Delete | `hx-delete` + `hx-confirm` + `hx-target` | Remove element |
| Infinite scroll | `hx-trigger="revealed"` | Append rows |
| Live preview | `hx-trigger="keyup changed delay:500ms"` | Debounced swap |
| Redirect (Stripe) | Regular `<a href>` | Full navigation |

---

## 5. OpenAPI / Swagger

### Approach

Use `@hono/zod-openapi` to define API routes with Zod schemas that auto-generate an OpenAPI 3.1 spec.

### Routes

- **`GET /docs`** — Swagger UI served via `@hono/swagger-ui`
- **`GET /api/openapi.json`** — raw OpenAPI 3.1 JSON spec

### Scope

Only `/api/*` endpoints are documented. Dashboard (`/dashboard/*`) and auth (`/auth/*`) routes are internal HTML and excluded from the API spec.

### Migration

Existing route definitions are converted from:

```typescript
app.post('/render', handler)
```

To:

```typescript
const renderRoute = createRoute({
  method: 'post',
  path: '/api/render',
  request: { body: { content: { 'application/json': { schema: renderSchema } } } },
  responses: { 200: { description: 'Rendered image', content: { 'image/png': {} } } },
})
app.openapi(renderRoute, handler)
```

Business logic in handlers remains unchanged. This is a refactor of route wiring, not behavior.

### New Dependencies

- `@hono/zod-openapi` — route definitions with Zod schema integration
- `@hono/swagger-ui` — Swagger UI middleware

---

## 6. Database Schema Changes

### New Tables

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  csrf_token TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE magic_links (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE render_history (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  api_key_id TEXT REFERENCES api_keys(id) ON DELETE SET NULL,
  request_payload TEXT NOT NULL,
  format TEXT NOT NULL,
  template TEXT,
  render_time_ms REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### Modified Tables

```sql
ALTER TABLE api_keys ADD COLUMN user_id TEXT REFERENCES users(id);
```

### Indexes

```sql
CREATE INDEX idx_sessions_token_hash ON sessions(token_hash);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_magic_links_token_hash ON magic_links(token_hash);
CREATE INDEX idx_magic_links_email ON magic_links(email);
CREATE INDEX idx_render_history_user_id ON render_history(user_id);
CREATE INDEX idx_render_history_created_at ON render_history(created_at);
CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
```

### Data Migration

For each existing `api_keys` row:

1. Create a `users` row with the same email (deduplicate by email)
2. Set `api_keys.user_id` to the new user's ID

Existing API key auth continues working unchanged.

---

## 7. Project Structure (New Files)

```
src/
├── auth/
│   ├── magic-link.ts        # Token generation, Resend email sending
│   ├── session.ts           # Session CRUD, validation, rolling expiry
│   └── middleware.ts        # Cookie-based session middleware for /dashboard/*
├── dashboard/
│   ├── routes.ts            # All /dashboard/* route definitions
│   ├── layouts/
│   │   └── shell.ts         # Base HTML (sidebar, <head>, htmx script tag)
│   └── views/
│       ├── overview.ts      # Stats cards, recent renders
│       ├── images.ts        # Render history table, re-render buttons
│       ├── api-keys.ts      # Key list, create/revoke/regenerate
│       ├── billing.ts       # Plan info, Stripe portal link, invoices
│       ├── usage.ts         # Usage charts, breakdown tables
│       ├── templates.ts     # Custom template CRUD with preview
│       ├── webhooks.ts      # Webhook management, test, delivery log
│       └── settings.ts      # Account preferences, delete account
├── openapi/
│   ├── spec.ts              # OpenAPI route definitions via @hono/zod-openapi
│   └── swagger.ts           # Swagger UI route setup
├── db/
│   ├── schema.ts            # ← MODIFIED: add users, sessions, magic_links, render_history tables
│   └── migrate.ts           # NEW: migration logic for existing api_keys data
└── static/
    ├── htmx.min.js          # Vendored htmx (~14kb gzipped)
    └── dashboard.css        # Dashboard styles
```

### HTML Rendering

Views are TypeScript functions returning HTML strings:

```typescript
export function overviewPage(user: User, stats: Stats): string {
  return `
    <div class="stats-grid">
      <div class="stat-card">
        <span class="label">Plan</span>
        <span class="value">${escapeHtml(user.plan)}</span>
      </div>
      ...
    </div>
  `
}
```

No template engine dependency. Fully type-safe via function signatures.

---

## 8. Security

### Token Storage

- Magic link tokens and session tokens are stored as SHA-256 hashes — never plain text
- Generated with `crypto.randomUUID()` (128 bits of entropy)

### Cookie Configuration

| Attribute | Value |
|---|---|
| `HttpOnly` | `true` |
| `Secure` | `true` (skipped in dev) |
| `SameSite` | `Lax` |
| `Max-Age` | 30 days |
| `Path` | `/` |

### CSRF Protection

- A per-session CSRF token is generated with `crypto.randomUUID()` when the session is created and stored in the `sessions` table
- The token is embedded in the shell layout as a `<meta>` tag and injected into every mutating htmx request via `hx-headers='{"X-CSRF-Token": "..."}'` on the `<body>` element
- Server-side middleware validates the `X-CSRF-Token` header against the session's stored token on every `POST`, `PUT`, and `DELETE` request to `/dashboard/*`

### XSS Prevention

- All user-provided content is HTML-escaped via an `escapeHtml()` utility before rendering in template literals
- Handles `<`, `>`, `&`, `"`, `'`

### Rate Limiting

- Magic link requests: max 3 per email per 10 minutes
- Existing API rate limiting remains unchanged

### Data Isolation

- Every dashboard query filters by `user_id` from the authenticated session
- Users can only see/manage their own API keys, render history, templates, and webhooks

---

## 9. New Dependencies

| Package | Purpose |
|---|---|
| `@hono/zod-openapi` | Route definitions with OpenAPI spec generation |
| `@hono/swagger-ui` | Swagger UI middleware |
| `htmx.org` | Vendored static file (no npm runtime dependency) |

---

## 10. Out of Scope

- **OAuth providers** (GitHub, Google) — magic links only for now
- **Multi-user teams / organizations** — single user per account
- **Image storage** (S3, disk) — metadata only, re-render on demand
- **Real-time updates** (WebSocket, SSE) — standard request/response
- **Dashboard theming / customization** — single dark theme matching the docs site
- **Email change flow** — requires a new magic link to a new address (future)
