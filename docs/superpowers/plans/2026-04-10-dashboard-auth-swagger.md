# Dashboard, Auth & Swagger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add magic-link authentication, an htmx-powered dashboard (8 sections), and OpenAPI/Swagger to the existing Hono server.

**Architecture:** All new functionality lives inside the existing Hono process. Database schema evolves to add `users`, `sessions`, `magic_links`, and `render_history` tables. Quotas move from per-key to per-user. Auth uses HTTP-only cookie sessions. Dashboard uses htmx for partial page swaps. OpenAPI spec is auto-generated from Zod schemas (or hand-written if Zod v4 is incompatible).

**Tech Stack:** Hono, htmx (vendored), SQLite (better-sqlite3), Resend, Stripe, Zod v4, @hono/zod-openapi (pending compat check), @hono/swagger-ui

**Spec:** `docs/superpowers/specs/2026-04-10-dashboard-auth-swagger-design.md`

---

## File Map

### New Files

| File | Responsibility |
|---|---|
| `src/db/migrate.ts` | Data migration: create users from api_keys, consolidate usage_log → render_history |
| `src/utils/html.ts` | `escapeHtml()` utility + HTML helper for template literals |
| `src/auth/magic-link.ts` | Magic link token creation, validation, rate limiting, email sending |
| `src/auth/session.ts` | Session CRUD: create, validate, refresh, delete, cleanup |
| `src/auth/middleware.ts` | Cookie-based session middleware for `/dashboard/*` routes, CSRF validation |
| `src/auth/routes.ts` | `/auth/login`, `/auth/send-link`, `/auth/verify`, `/auth/logout` route handlers |
| `src/dashboard/layouts/shell.ts` | Base HTML layout: `<head>`, sidebar, `#main-content`, htmx script, CSRF header |
| `src/dashboard/routes.ts` | All `/dashboard/*` route definitions, htmx partial vs full page detection |
| `src/dashboard/views/overview.ts` | Overview page: plan card, usage meter, avg render time, recent renders |
| `src/dashboard/views/images.ts` | Render history table, re-render button, infinite scroll, filters |
| `src/dashboard/views/api-keys.ts` | API key list, create/revoke/regenerate |
| `src/dashboard/views/billing.ts` | Plan info, Stripe portal link, invoices |
| `src/dashboard/views/usage.ts` | Usage charts (HTML/CSS bars), date range, breakdown tables |
| `src/dashboard/views/templates.ts` | Custom template CRUD, JSON editor, live preview |
| `src/dashboard/views/webhooks.ts` | Webhook management, test button, delivery log |
| `src/dashboard/views/settings.ts` | Account settings, notification prefs, delete account |
| `src/openapi/spec.ts` | OpenAPI route definitions (or static spec JSON if Zod v4 incompatible) |
| `src/openapi/swagger.ts` | Swagger UI route at `/docs` |
| `src/static/htmx.min.js` | Vendored htmx library |
| `src/static/dashboard.css` | Dashboard styles |
| `tests/auth.test.ts` | Auth flow tests: magic links, sessions, middleware |
| `tests/dashboard.test.ts` | Dashboard route tests: partial/full responses, CRUD operations |
| `tests/db-migration.test.ts` | Migration tests: data integrity, schema correctness |
| `tests/openapi.test.ts` | OpenAPI spec validation, Swagger UI availability |

### Modified Files

| File | Changes |
|---|---|
| `src/db/index.ts` | Add `users`, `sessions`, `magic_links`, `render_history` tables; add user-level CRUD functions; remove quota fields from `api_keys`; replace `usage_log` with `render_history`; update `ApiKeyRecord` type |
| `src/middleware/auth.ts` | Update `authMiddleware()` to look up user via `api_keys.user_id` for quota checks; update `usageTracking()` to write to `render_history` |
| `src/api/usage.ts` | Read from `render_history` instead of `usage_log`; query user-level quotas |
| `src/api/admin.ts` | Extend `reset-free-quotas` to also purge expired sessions and magic links |
| `src/api/register.ts` | Create `users` row alongside `api_keys` row on new registration |
| `src/types.ts` | Add `UserRecord` type; update `AppEnv` to include `user` variable |
| `src/index.ts` | Register new route groups (`/auth/*`, `/dashboard/*`, `/docs`, `/openapi.json`); serve static files from `src/static/`; apply session middleware |
| `src/email/send.ts` | Add `sendMagicLinkEmail()` function |
| `package.json` | Add `@hono/zod-openapi`, `@hono/swagger-ui` dependencies |

---

## Phase 1: Database Schema Evolution

### Task 1: Add `users` table and user-level functions

**Files:**
- Modify: `src/db/index.ts`
- Modify: `src/types.ts`
- Test: `tests/db-migration.test.ts`

- [ ] **Step 1: Write failing test for user creation**

In `tests/db-migration.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { getDb, migrate, createUser, findUserByEmail, findUserById } from '../src/db/index'

describe('users table', () => {
  beforeEach(() => {
    process.env.DATABASE_URL = ':memory:'
    migrate(getDb())
  })

  afterEach(() => {
    const { closeDb } = require('../src/db/index')
    closeDb()
    delete process.env.DATABASE_URL
  })

  it('creates a user and retrieves by email', () => {
    const user = createUser('test@example.com')
    expect(user.id).toBeDefined()
    expect(user.email).toBe('test@example.com')
    expect(user.plan).toBe('free')
    expect(user.calls_limit).toBe(500)
    expect(user.calls_used).toBe(0)
    expect(user.active).toBe(1)

    const found = findUserByEmail('test@example.com')
    expect(found).not.toBeNull()
    expect(found!.id).toBe(user.id)
  })

  it('retrieves user by id', () => {
    const user = createUser('test@example.com')
    const found = findUserById(user.id)
    expect(found).not.toBeNull()
    expect(found!.email).toBe('test@example.com')
  })

  it('returns null for unknown email', () => {
    expect(findUserByEmail('nobody@example.com')).toBeNull()
  })

  it('enforces unique email', () => {
    createUser('dup@example.com')
    expect(() => createUser('dup@example.com')).toThrow()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- tests/db-migration.test.ts`
Expected: FAIL — `createUser` is not exported

- [ ] **Step 3: Add UserRecord type**

In `src/types.ts`, add after existing `AppEnv`:

```typescript
export interface UserRecord {
  id: string
  email: string
  plan: Plan
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  calls_limit: number
  calls_used: number
  period_start: string
  created_at: string
  active: number
}
```

Import `Plan` from `src/db/index.ts` (it's already exported there at line 4).

- [ ] **Step 4: Add users table to schema and implement CRUD**

In `src/db/index.ts`, add the `users` table creation inside `migrate()`, before the `api_keys` table (since `api_keys` will later reference `users`):

```sql
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  plan TEXT NOT NULL DEFAULT 'free',
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  calls_limit INTEGER NOT NULL DEFAULT 500,
  calls_used INTEGER NOT NULL DEFAULT 0,
  period_start TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  active INTEGER NOT NULL DEFAULT 1
);
```

Add index: `CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);`

Add these functions after the existing API key functions:

```typescript
import type { UserRecord } from './types'

export function createUser(email: string, plan: Plan = 'free'): UserRecord {
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const limit = PLAN_LIMITS[plan]
  getDb().prepare(`
    INSERT INTO users (id, email, plan, calls_limit, calls_used, period_start, created_at, active)
    VALUES (?, ?, ?, ?, 0, ?, ?, 1)
  `).run(id, email, plan, limit, now, now)
  return findUserById(id)!
}

export function findUserByEmail(email: string): UserRecord | null {
  return getDb().prepare('SELECT * FROM users WHERE email = ?').get(email) as UserRecord | null
}

export function findUserById(id: string): UserRecord | null {
  return getDb().prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRecord | null
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun run test -- tests/db-migration.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/db/index.ts src/types.ts tests/db-migration.test.ts
git commit -m "feat(db): add users table with CRUD functions"
```

---

### Task 2: Add `user_id` FK to `api_keys` and update quota model

**Files:**
- Modify: `src/db/index.ts`
- Modify: `src/middleware/auth.ts`
- Modify: `src/types.ts`
- Test: `tests/db-migration.test.ts`

- [ ] **Step 1: Write failing test for user-linked API keys and user-level quota**

Append to `tests/db-migration.test.ts`:

```typescript
import { createApiKey, findApiKeyByKey, incrementUsage, createUser, findUserById } from '../src/db/index'

describe('api_keys with user_id', () => {
  beforeEach(() => {
    process.env.DATABASE_URL = ':memory:'
    migrate(getDb())
  })

  afterEach(() => {
    const { closeDb } = require('../src/db/index')
    closeDb()
    delete process.env.DATABASE_URL
  })

  it('creates an API key linked to a user', () => {
    const user = createUser('test@example.com')
    const key = createApiKey(user.id)
    expect(key.user_id).toBe(user.id)

    const found = findApiKeyByKey(key.key)
    expect(found).not.toBeNull()
    expect(found!.user_id).toBe(user.id)
  })

  it('increments usage on the user, not the key', () => {
    const user = createUser('test@example.com')
    const key = createApiKey(user.id)

    incrementUsage(user.id)
    const updated = findUserById(user.id)
    expect(updated!.calls_used).toBe(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- tests/db-migration.test.ts`
Expected: FAIL — `createApiKey` signature doesn't accept `userId`

- [ ] **Step 3: Update `ApiKeyRecord` type**

In `src/types.ts`, update `ApiKeyRecord` (or in `src/db/index.ts` where it's defined at lines 13-25). Remove `plan`, `stripe_customer_id`, `stripe_subscription_id`, `calls_limit`, `calls_used`, `period_start`. Add `user_id`:

```typescript
export interface ApiKeyRecord {
  id: string
  key: string
  email: string
  user_id: string | null
  created_at: string
  active: number
}
```

- [ ] **Step 4: Update `api_keys` table schema and functions**

In `src/db/index.ts`, update the `api_keys` table creation:

```sql
CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  user_id TEXT REFERENCES users(id),
  created_at TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1
);
```

Add index: `CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);`

Update `createApiKey()` to accept `userId` instead of `email, plan`:

```typescript
export function createApiKey(userId: string): ApiKeyRecord {
  const id = crypto.randomUUID()
  const key = generateApiKey()
  const now = new Date().toISOString()
  const user = findUserById(userId)!
  getDb().prepare(`
    INSERT INTO api_keys (id, key, email, user_id, created_at, active)
    VALUES (?, ?, ?, ?, ?, 1)
  `).run(id, key, user.email, userId, now)
  return findApiKeyByKey(key)!
}
```

Update `incrementUsage()` to operate on users:

```typescript
export function incrementUsage(userId: string): void {
  getDb().prepare('UPDATE users SET calls_used = calls_used + 1 WHERE id = ?').run(userId)
}
```

Add `findUserByApiKey()`:

```typescript
export function findUserByApiKey(apiKeyId: string): UserRecord | null {
  const key = getDb().prepare('SELECT * FROM api_keys WHERE id = ?').get(apiKeyId) as ApiKeyRecord | null
  if (!key?.user_id) return null
  return findUserById(key.user_id)
}
```

Update `resetUsage()`, `updatePlan()`, `resetFreeQuotas()`, `updateStripeInfo()` to operate on `users` table instead of `api_keys`.

- [ ] **Step 5: Update auth middleware to check user-level quota**

In `src/middleware/auth.ts`, update `authMiddleware()`:

After finding the API key record (line 68), look up the user:

```typescript
const user = record.user_id ? findUserById(record.user_id) : null
if (user && user.calls_used >= user.calls_limit) {
  return c.json({ error: 'Quota exceeded', limit: user.calls_limit, used: user.calls_used }, 429)
}
c.set('apiKey', record)
if (user) c.set('user', user)
```

Update `usageTracking()` to increment on the user:

```typescript
const user = c.get('user' as never) as UserRecord | undefined
if (user) {
  incrementUsage(user.id)
}
```

- [ ] **Step 6: Update AppEnv type**

In `src/types.ts`:

```typescript
export type AppEnv = {
  Variables: {
    apiKey: ApiKeyRecord
    user: UserRecord
  }
}
```

- [ ] **Step 7: Run tests**

Run: `bun run test -- tests/db-migration.test.ts`
Expected: PASS

- [ ] **Step 8: Run full test suite to check for regressions**

Run: `bun run test`
Expected: Some existing tests may fail due to `createApiKey()` signature change. Fix them: each call to `createApiKey(email, plan)` needs to first `createUser(email, plan)` then `createApiKey(userId)`.

- [ ] **Step 9: Fix any broken tests**

Update all existing test files that call `createApiKey()` to use the new signature. Search for `createApiKey` across all test files and update.

- [ ] **Step 10: Run full test suite again**

Run: `bun run test`
Expected: ALL PASS

- [ ] **Step 11: Commit**

```bash
git add src/db/index.ts src/middleware/auth.ts src/types.ts tests/
git commit -m "feat(db): move quotas to user level, add user_id FK to api_keys"
```

---

### Task 3: Add `sessions` and `magic_links` tables

**Files:**
- Modify: `src/db/index.ts`
- Test: `tests/db-migration.test.ts`

- [ ] **Step 1: Write failing test for sessions**

Append to `tests/db-migration.test.ts`:

```typescript
import { createSession, findSessionByToken, deleteSession, createMagicLink, findMagicLinkByToken, markMagicLinkUsed } from '../src/db/index'
import { createHash } from 'crypto'

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

describe('sessions table', () => {
  beforeEach(() => {
    process.env.DATABASE_URL = ':memory:'
    migrate(getDb())
  })

  afterEach(() => {
    const { closeDb } = require('../src/db/index')
    closeDb()
    delete process.env.DATABASE_URL
  })

  it('creates and retrieves a session by token hash', () => {
    const user = createUser('test@example.com')
    const token = crypto.randomUUID()
    const session = createSession(user.id, token)
    expect(session.user_id).toBe(user.id)
    expect(session.csrf_token).toBeDefined()

    const found = findSessionByToken(token)
    expect(found).not.toBeNull()
    expect(found!.user_id).toBe(user.id)
  })

  it('deletes a session', () => {
    const user = createUser('test@example.com')
    const token = crypto.randomUUID()
    createSession(user.id, token)
    deleteSession(token)
    expect(findSessionByToken(token)).toBeNull()
  })
})

describe('magic_links table', () => {
  beforeEach(() => {
    process.env.DATABASE_URL = ':memory:'
    migrate(getDb())
  })

  afterEach(() => {
    const { closeDb } = require('../src/db/index')
    closeDb()
    delete process.env.DATABASE_URL
  })

  it('creates and retrieves a magic link', () => {
    const token = crypto.randomUUID()
    const link = createMagicLink('test@example.com', token)
    expect(link.email).toBe('test@example.com')
    expect(link.used).toBe(0)

    const found = findMagicLinkByToken(token)
    expect(found).not.toBeNull()
    expect(found!.email).toBe('test@example.com')
  })

  it('marks a magic link as used', () => {
    const token = crypto.randomUUID()
    createMagicLink('test@example.com', token)
    markMagicLinkUsed(token)
    const found = findMagicLinkByToken(token)
    expect(found!.used).toBe(1)
  })

  it('returns null for expired magic link', () => {
    const token = crypto.randomUUID()
    const link = createMagicLink('test@example.com', token, -1) // expired 1 minute ago
    const found = findMagicLinkByToken(token)
    expect(found).toBeNull() // query filters by expires_at > now
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- tests/db-migration.test.ts`
Expected: FAIL — functions not exported

- [ ] **Step 3: Add tables and functions**

In `src/db/index.ts`, add inside `migrate()`:

```sql
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  csrf_token TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);

CREATE TABLE IF NOT EXISTS magic_links (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_magic_links_token_hash ON magic_links(token_hash);
CREATE INDEX IF NOT EXISTS idx_magic_links_email ON magic_links(email);
```

Add functions:

```typescript
import { createHash } from 'crypto'

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export interface SessionRecord {
  id: string
  user_id: string
  token_hash: string
  csrf_token: string
  expires_at: string
  created_at: string
}

export interface MagicLinkRecord {
  id: string
  email: string
  token_hash: string
  expires_at: string
  used: number
  created_at: string
}

export function createSession(userId: string, token: string): SessionRecord {
  const id = crypto.randomUUID()
  const tokenHash = hashToken(token)
  const csrfToken = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  getDb().prepare(`
    INSERT INTO sessions (id, user_id, token_hash, csrf_token, expires_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, userId, tokenHash, csrfToken, expiresAt)
  return getDb().prepare('SELECT * FROM sessions WHERE id = ?').get(id) as SessionRecord
}

export function findSessionByToken(token: string): SessionRecord | null {
  const tokenHash = hashToken(token)
  return getDb().prepare(
    'SELECT * FROM sessions WHERE token_hash = ? AND expires_at > datetime(\'now\')'
  ).get(tokenHash) as SessionRecord | null
}

export function refreshSession(sessionId: string): void {
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  getDb().prepare('UPDATE sessions SET expires_at = ? WHERE id = ?').run(expiresAt, sessionId)
}

export function deleteSession(token: string): void {
  const tokenHash = hashToken(token)
  getDb().prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash)
}

export function deleteSessionById(sessionId: string): void {
  getDb().prepare('DELETE FROM sessions WHERE id = ?').run(sessionId)
}

export function createMagicLink(email: string, token: string, expiresInMinutes: number = 15): MagicLinkRecord {
  const id = crypto.randomUUID()
  const tokenHash = hashToken(token)
  const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000).toISOString()
  getDb().prepare(`
    INSERT INTO magic_links (id, email, token_hash, expires_at)
    VALUES (?, ?, ?, ?)
  `).run(id, email, tokenHash, expiresAt)
  return getDb().prepare('SELECT * FROM magic_links WHERE id = ?').get(id) as MagicLinkRecord
}

export function findMagicLinkByToken(token: string): MagicLinkRecord | null {
  const tokenHash = hashToken(token)
  return getDb().prepare(
    'SELECT * FROM magic_links WHERE token_hash = ? AND expires_at > datetime(\'now\') AND used = 0'
  ).get(tokenHash) as MagicLinkRecord | null
}

export function markMagicLinkUsed(token: string): void {
  const tokenHash = hashToken(token)
  getDb().prepare('UPDATE magic_links SET used = 1 WHERE token_hash = ?').run(tokenHash)
}

export function countRecentMagicLinks(email: string, windowMinutes: number = 10): number {
  const since = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString()
  const result = getDb().prepare(
    'SELECT COUNT(*) as count FROM magic_links WHERE email = ? AND created_at > ?'
  ).get(email, since) as { count: number }
  return result.count
}

export function purgeExpiredSessions(): number {
  const result = getDb().prepare("DELETE FROM sessions WHERE expires_at < datetime('now')").run()
  return result.changes
}

export function purgeExpiredMagicLinks(): number {
  const result = getDb().prepare(
    "DELETE FROM magic_links WHERE expires_at < datetime('now') OR used = 1"
  ).run()
  return result.changes
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test -- tests/db-migration.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/db/index.ts tests/db-migration.test.ts
git commit -m "feat(db): add sessions and magic_links tables with CRUD"
```

---

### Task 4: Replace `usage_log` with `render_history`

**Files:**
- Modify: `src/db/index.ts`
- Modify: `src/middleware/auth.ts`
- Modify: `src/api/usage.ts`
- Test: `tests/db-migration.test.ts`

- [ ] **Step 1: Write failing test for render_history**

Append to `tests/db-migration.test.ts`:

```typescript
import { logRender, getRenderHistory, getUsageStats } from '../src/db/index'

describe('render_history table', () => {
  beforeEach(() => {
    process.env.DATABASE_URL = ':memory:'
    migrate(getDb())
  })

  afterEach(() => {
    const { closeDb } = require('../src/db/index')
    closeDb()
    delete process.env.DATABASE_URL
  })

  it('logs a render and retrieves history', () => {
    const user = createUser('test@example.com')
    const key = createApiKey(user.id)

    logRender({
      userId: user.id,
      apiKeyId: key.id,
      endpoint: '/render',
      requestPayload: { title: 'Test', format: 'og' },
      format: 'og',
      template: 'default',
      renderTimeMs: 18.5,
    })

    const history = getRenderHistory(user.id, { limit: 10, offset: 0 })
    expect(history).toHaveLength(1)
    expect(history[0].format).toBe('og')
    expect(history[0].template).toBe('default')
    expect(history[0].render_time_ms).toBe(18.5)
    expect(JSON.parse(history[0].request_payload)).toEqual({ title: 'Test', format: 'og' })
  })

  it('returns usage stats from render_history', () => {
    const user = createUser('test@example.com')
    const key = createApiKey(user.id)

    logRender({ userId: user.id, apiKeyId: key.id, endpoint: '/render', requestPayload: {}, format: 'og', template: 'default', renderTimeMs: 10 })
    logRender({ userId: user.id, apiKeyId: key.id, endpoint: '/render', requestPayload: {}, format: 'png', template: 'blog-hero', renderTimeMs: 15 })

    const stats = getUsageStats(user.id)
    expect(stats.total).toBe(2)
    expect(stats.byEndpoint['/render']).toBe(2)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- tests/db-migration.test.ts`
Expected: FAIL — `logRender` not exported

- [ ] **Step 3: Add render_history table and functions**

In `src/db/index.ts`, replace the `usage_log` table with:

```sql
CREATE TABLE IF NOT EXISTS render_history (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  api_key_id TEXT REFERENCES api_keys(id) ON DELETE SET NULL,
  endpoint TEXT NOT NULL,
  request_payload TEXT NOT NULL DEFAULT '{}',
  format TEXT NOT NULL,
  template TEXT,
  render_time_ms REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_render_history_user_id ON render_history(user_id);
CREATE INDEX IF NOT EXISTS idx_render_history_created_at ON render_history(created_at);
```

Add the `RenderHistoryRecord` type:

```typescript
export interface RenderHistoryRecord {
  id: string
  user_id: string
  api_key_id: string | null
  endpoint: string
  request_payload: string
  format: string
  template: string | null
  render_time_ms: number | null
  created_at: string
}
```

Replace `logUsage()` with:

```typescript
export function logRender(opts: {
  userId: string
  apiKeyId: string
  endpoint: string
  requestPayload: object
  format: string
  template?: string
  renderTimeMs?: number
}): void {
  const id = crypto.randomUUID()
  getDb().prepare(`
    INSERT INTO render_history (id, user_id, api_key_id, endpoint, request_payload, format, template, render_time_ms)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, opts.userId, opts.apiKeyId, opts.endpoint, JSON.stringify(opts.requestPayload), opts.format, opts.template ?? null, opts.renderTimeMs ?? null)
}
```

Update `getUsageStats()` to query `render_history` and accept `userId`:

```typescript
export function getUsageStats(userId: string): { total: number; byEndpoint: Record<string, number>; byFormat: Record<string, number> } {
  const total = (getDb().prepare('SELECT COUNT(*) as count FROM render_history WHERE user_id = ?').get(userId) as { count: number }).count
  const byEndpoint: Record<string, number> = {}
  const endpointRows = getDb().prepare('SELECT endpoint, COUNT(*) as count FROM render_history WHERE user_id = ? GROUP BY endpoint').all(userId) as { endpoint: string; count: number }[]
  for (const row of endpointRows) byEndpoint[row.endpoint] = row.count
  const byFormat: Record<string, number> = {}
  const formatRows = getDb().prepare('SELECT format, COUNT(*) as count FROM render_history WHERE user_id = ? GROUP BY format').all(userId) as { format: string; count: number }[]
  for (const row of formatRows) byFormat[row.format] = row.count
  return { total, byEndpoint, byFormat }
}

export function getRenderHistory(userId: string, opts: { limit: number; offset: number }): RenderHistoryRecord[] {
  return getDb().prepare(
    'SELECT * FROM render_history WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
  ).all(userId, opts.limit, opts.offset) as RenderHistoryRecord[]
}

export function getRenderHistoryById(id: string): RenderHistoryRecord | null {
  return getDb().prepare('SELECT * FROM render_history WHERE id = ?').get(id) as RenderHistoryRecord | null
}
```

- [ ] **Step 4: Update `usageTracking()` middleware**

In `src/middleware/auth.ts`, update `usageTracking()` to call `logRender()` instead of `logUsage()`, using the `user` from context:

```typescript
export function usageTracking(endpoint: string) {
  return async (c: Context, next: Next) => {
    await next()
    const status = c.res.status
    if (status >= 200 && status < 300) {
      const apiKey = c.get('apiKey' as never) as ApiKeyRecord | undefined
      const user = c.get('user' as never) as UserRecord | undefined
      if (user && apiKey) {
        const renderTimeMs = parseFloat(c.res.headers.get('X-Render-Time-Ms') ?? '0')
        incrementUsage(user.id)
        // Extract request body from context if available for render_history
        const body = c.get('requestBody' as never) as object | undefined
        logRender({
          userId: user.id,
          apiKeyId: apiKey.id,
          endpoint,
          requestPayload: body ?? {},
          format: (body as any)?.format ?? 'unknown',
          template: (body as any)?.template,
          renderTimeMs: renderTimeMs || undefined,
        })
      }
    }
  }
}
```

- [ ] **Step 5: Update usage endpoint**

In `src/api/usage.ts`, update to use user-level data:

```typescript
usageRoute.get('/usage', async (c) => {
  const user = c.get('user' as never) as UserRecord
  const stats = getUsageStats(user.id)
  return c.json({
    plan: user.plan,
    quota: {
      limit: user.calls_limit,
      used: user.calls_used,
      remaining: Math.max(0, user.calls_limit - user.calls_used),
      periodStart: user.period_start,
    },
    usage: stats,
  })
})
```

- [ ] **Step 6: Run tests**

Run: `bun run test`
Expected: PASS (fix any remaining references to old `logUsage` or `usage_log`)

- [ ] **Step 7: Commit**

```bash
git add src/db/index.ts src/middleware/auth.ts src/api/usage.ts tests/db-migration.test.ts
git commit -m "feat(db): replace usage_log with render_history, store request payloads"
```

---

### Task 5: Update `register` endpoint to create users + data migration script

**Files:**
- Modify: `src/api/register.ts`
- Create: `src/db/migrate.ts`
- Modify: `src/api/admin.ts`
- Test: `tests/db-migration.test.ts`

- [ ] **Step 1: Write failing test for register creating a user**

Append to `tests/db-migration.test.ts`:

```typescript
describe('register creates user', () => {
  beforeEach(() => {
    process.env.DATABASE_URL = ':memory:'
    migrate(getDb())
  })

  afterEach(() => {
    const { closeDb } = require('../src/db/index')
    closeDb()
    delete process.env.DATABASE_URL
  })

  it('creates user and api_key together', () => {
    const user = createUser('new@example.com')
    const key = createApiKey(user.id)
    expect(key.user_id).toBe(user.id)
    expect(key.email).toBe('new@example.com')

    const foundUser = findUserByEmail('new@example.com')
    expect(foundUser!.plan).toBe('free')
    expect(foundUser!.calls_limit).toBe(500)
  })
})
```

- [ ] **Step 2: Run test to verify it passes** (this should already pass from Task 2)

Run: `bun run test -- tests/db-migration.test.ts`
Expected: PASS

- [ ] **Step 3: Update register route handler**

In `src/api/register.ts`, update the handler to create a `users` row first:

```typescript
registerRoute.post('/auth/register', async (c) => {
  const body = await c.req.json()
  const parsed = registerSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Invalid email', details: parsed.error.issues }, 400)
  }
  const { email } = parsed.data

  // Check if user already exists
  const existingUser = findUserByEmail(email)
  if (existingUser) {
    // Find their API key
    const existingKey = findApiKeyByEmail(email)
    if (existingKey) {
      return c.json({
        apiKey: existingKey.key,
        plan: existingUser.plan,
        limit: existingUser.calls_limit,
        message: `API key already exists for ${email}. Check your email for the original key.`,
      })
    }
  }

  // Create user (or use existing)
  const user = existingUser ?? createUser(email)
  const record = createApiKey(user.id)
  
  try {
    await sendWelcomeEmail(email, record.key, user.plan)
  } catch {
    // Email send failure is non-fatal
  }

  return c.json({
    apiKey: record.key,
    plan: user.plan,
    limit: user.calls_limit,
    message: `API key created. Check ${email} for your key.`,
  }, 201)
})
```

- [ ] **Step 4: Create data migration script**

Create `src/db/migrate.ts`:

```typescript
import { getDb } from './index'

/**
 * Migrates existing api_keys data to the new schema:
 * 1. Creates users from api_keys (deduplicating by email)
 * 2. Links api_keys to users via user_id
 * 3. Migrates usage_log to render_history
 * 4. Drops usage_log table
 *
 * This is idempotent — safe to run multiple times.
 */
export function migrateToUserModel(): { usersCreated: number; keysLinked: number; logsmigrated: number } {
  const db = getDb()
  let usersCreated = 0
  let keysLinked = 0
  let logsMigrated = 0

  // Check if migration is needed (are there api_keys without user_id?)
  const orphanKeys = db.prepare(
    "SELECT * FROM api_keys WHERE user_id IS NULL"
  ).all() as any[]

  if (orphanKeys.length === 0) {
    return { usersCreated: 0, keysLinked: 0, logsMigrated: 0 }
  }

  // Group by email for deduplication
  const byEmail = new Map<string, any[]>()
  for (const key of orphanKeys) {
    const list = byEmail.get(key.email) ?? []
    list.push(key)
    byEmail.set(key.email, list)
  }

  // Create users and link keys
  for (const [email, keys] of byEmail) {
    // Use the first key's plan/stripe info as the user's
    const primary = keys[0]
    const userId = crypto.randomUUID()
    const now = new Date().toISOString()

    db.prepare(`
      INSERT OR IGNORE INTO users (id, email, plan, stripe_customer_id, stripe_subscription_id, calls_limit, calls_used, period_start, created_at, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `).run(
      userId, email,
      primary.plan ?? 'free',
      primary.stripe_customer_id ?? null,
      primary.stripe_subscription_id ?? null,
      primary.calls_limit ?? 500,
      primary.calls_used ?? 0,
      primary.period_start ?? now,
      primary.created_at ?? now
    )
    usersCreated++

    for (const key of keys) {
      db.prepare('UPDATE api_keys SET user_id = ? WHERE id = ?').run(userId, key.id)
      keysLinked++
    }
  }

  // Migrate usage_log to render_history (if usage_log table exists)
  try {
    const logs = db.prepare('SELECT * FROM usage_log').all() as any[]
    for (const log of logs) {
      const apiKey = db.prepare('SELECT * FROM api_keys WHERE id = ?').get(log.api_key_id) as any
      if (apiKey?.user_id) {
        db.prepare(`
          INSERT INTO render_history (id, user_id, api_key_id, endpoint, request_payload, format, template, render_time_ms, created_at)
          VALUES (?, ?, ?, ?, '{}', ?, NULL, ?, ?)
        `).run(crypto.randomUUID(), apiKey.user_id, log.api_key_id, log.endpoint, log.format ?? 'unknown', log.render_time_ms, log.created_at)
        logsMigrated++
      }
    }
    db.exec('DROP TABLE IF EXISTS usage_log')
  } catch {
    // usage_log may not exist in fresh databases
  }

  return { usersCreated, keysLinked, logsMigrated }
}
```

- [ ] **Step 5: Extend admin reset endpoint to include cleanup**

In `src/api/admin.ts`, add session and magic link purging:

```typescript
import { resetFreeQuotas, purgeExpiredSessions, purgeExpiredMagicLinks } from '../db/index'

adminRoute.post('/admin/reset-free-quotas', async (c) => {
  const secret = process.env.ADMIN_CRON_SECRET
  if (!secret) return c.json({ error: 'ADMIN_CRON_SECRET not configured' }, 500)

  const auth = c.req.header('Authorization')
  if (auth !== `Bearer ${secret}`) return c.json({ error: 'Unauthorized' }, 401)

  const reset = resetFreeQuotas()
  const sessionsPurged = purgeExpiredSessions()
  const magicLinksPurged = purgeExpiredMagicLinks()

  return c.json({
    reset,
    sessionsPurged,
    magicLinksPurged,
    timestamp: new Date().toISOString(),
  })
})
```

- [ ] **Step 6: Run full test suite**

Run: `bun run test`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/api/register.ts src/db/migrate.ts src/api/admin.ts tests/db-migration.test.ts
git commit -m "feat(db): update register to create users, add migration script and session cleanup"
```

---

## Phase 2: Authentication

### Task 6: HTML escape utility

**Files:**
- Create: `src/utils/html.ts`
- Test: `tests/auth.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/auth.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { escapeHtml } from '../src/utils/html'

describe('escapeHtml', () => {
  it('escapes HTML special characters', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;')
  })

  it('escapes ampersand', () => {
    expect(escapeHtml('a & b')).toBe('a &amp; b')
  })

  it('escapes single quotes', () => {
    expect(escapeHtml("it's")).toBe('it&#39;s')
  })

  it('passes through safe strings', () => {
    expect(escapeHtml('Hello World')).toBe('Hello World')
  })

  it('handles empty string', () => {
    expect(escapeHtml('')).toBe('')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- tests/auth.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement**

Create `src/utils/html.ts`:

```typescript
const ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

export function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, (ch) => ESCAPE_MAP[ch])
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test -- tests/auth.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/html.ts tests/auth.test.ts
git commit -m "feat(utils): add escapeHtml utility for XSS prevention"
```

---

### Task 7: Magic link token creation and email sending

**Files:**
- Create: `src/auth/magic-link.ts`
- Modify: `src/email/send.ts`
- Test: `tests/auth.test.ts`

- [ ] **Step 1: Write failing test**

Append to `tests/auth.test.ts`:

```typescript
import { beforeEach, afterEach } from 'vitest'
import { getDb, migrate, findMagicLinkByToken, countRecentMagicLinks } from '../src/db/index'
import { createMagicLinkToken } from '../src/auth/magic-link'

describe('magic link tokens', () => {
  beforeEach(() => {
    process.env.DATABASE_URL = ':memory:'
    migrate(getDb())
  })

  afterEach(() => {
    const { closeDb } = require('../src/db/index')
    closeDb()
    delete process.env.DATABASE_URL
  })

  it('creates a magic link token and stores hash in DB', () => {
    const { token } = createMagicLinkToken('test@example.com')
    expect(token).toBeDefined()
    expect(token.length).toBeGreaterThan(20)

    const found = findMagicLinkByToken(token)
    expect(found).not.toBeNull()
    expect(found!.email).toBe('test@example.com')
    expect(found!.used).toBe(0)
  })

  it('throws when rate limited (>3 in 10 minutes)', () => {
    createMagicLinkToken('spam@example.com')
    createMagicLinkToken('spam@example.com')
    createMagicLinkToken('spam@example.com')
    expect(() => createMagicLinkToken('spam@example.com')).toThrow('Too many login requests')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- tests/auth.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement magic-link.ts**

Create `src/auth/magic-link.ts`:

```typescript
import { createMagicLink, countRecentMagicLinks } from '../db/index'

const MAX_LINKS_PER_WINDOW = 3
const WINDOW_MINUTES = 10

export function createMagicLinkToken(email: string): { token: string } {
  const count = countRecentMagicLinks(email, WINDOW_MINUTES)
  if (count >= MAX_LINKS_PER_WINDOW) {
    throw new Error('Too many login requests. Please wait a few minutes.')
  }

  const token = crypto.randomUUID()
  createMagicLink(email, token)
  return { token }
}
```

- [ ] **Step 4: Add sendMagicLinkEmail to email/send.ts**

In `src/email/send.ts`, add:

```typescript
export async function sendMagicLinkEmail(email: string, verifyUrl: string): Promise<void> {
  const resend = getResend()
  if (!resend) return

  await resend.emails.send({
    from: FROM,
    to: email,
    subject: 'Log in to OG Engine',
    html: `
      <h2>Log in to OG Engine</h2>
      <p>Click the link below to log in to your dashboard:</p>
      <p><a href="${verifyUrl}" style="display:inline-block;padding:12px 24px;background:#38ef7d;color:#000;text-decoration:none;border-radius:6px;font-weight:bold;">Log in to Dashboard</a></p>
      <p>This link expires in 15 minutes and can only be used once.</p>
      <p>If you didn't request this, you can safely ignore this email.</p>
      <p style="color:#888;font-size:12px;">— OG Engine</p>
    `,
  })
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun run test -- tests/auth.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/auth/magic-link.ts src/email/send.ts tests/auth.test.ts
git commit -m "feat(auth): add magic link token creation with rate limiting"
```

---

### Task 8: Session middleware

**Files:**
- Create: `src/auth/session.ts`
- Create: `src/auth/middleware.ts`
- Test: `tests/auth.test.ts`

- [ ] **Step 1: Write failing test for session verification**

Append to `tests/auth.test.ts`:

```typescript
import { createSession, findSessionByToken, findUserById, createUser } from '../src/db/index'
import { verifyMagicLink } from '../src/auth/session'

describe('session verification (verifyMagicLink)', () => {
  beforeEach(() => {
    process.env.DATABASE_URL = ':memory:'
    migrate(getDb())
  })

  afterEach(() => {
    const { closeDb } = require('../src/db/index')
    closeDb()
    delete process.env.DATABASE_URL
  })

  it('creates a user and session for a new email', () => {
    const { token: magicToken } = createMagicLinkToken('new@example.com')
    const { sessionToken, user } = verifyMagicLink(magicToken)

    expect(sessionToken).toBeDefined()
    expect(user.email).toBe('new@example.com')
    expect(user.plan).toBe('free')

    // Session exists in DB
    const session = findSessionByToken(sessionToken)
    expect(session).not.toBeNull()
    expect(session!.user_id).toBe(user.id)

    // Magic link is now used
    expect(findMagicLinkByToken(magicToken)).toBeNull()
  })

  it('reuses existing user for returning email', () => {
    const existing = createUser('returning@example.com')

    const { token: magicToken } = createMagicLinkToken('returning@example.com')
    const { user } = verifyMagicLink(magicToken)

    expect(user.id).toBe(existing.id)
  })

  it('throws for invalid token', () => {
    expect(() => verifyMagicLink('fake-token')).toThrow('Invalid or expired magic link')
  })

  it('throws for already-used token', () => {
    const { token } = createMagicLinkToken('used@example.com')
    verifyMagicLink(token)
    expect(() => verifyMagicLink(token)).toThrow('Invalid or expired magic link')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- tests/auth.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement session.ts**

Create `src/auth/session.ts`:

```typescript
import {
  findMagicLinkByToken,
  markMagicLinkUsed,
  findUserByEmail,
  createUser,
  createSession,
  findApiKeyByEmail,
  createApiKey,
} from '../db/index'
import type { UserRecord } from '../types'

export function verifyMagicLink(token: string): { sessionToken: string; user: UserRecord } {
  const magicLink = findMagicLinkByToken(token)
  if (!magicLink) {
    throw new Error('Invalid or expired magic link')
  }

  markMagicLinkUsed(token)

  // Find or create user
  let user = findUserByEmail(magicLink.email)
  if (!user) {
    user = createUser(magicLink.email)
    // Link existing API key if one exists
    const existingKey = findApiKeyByEmail(magicLink.email)
    if (existingKey && !existingKey.user_id) {
      const { getDb } = require('../db/index')
      getDb().prepare('UPDATE api_keys SET user_id = ? WHERE id = ?').run(user.id, existingKey.id)
    } else if (!existingKey) {
      // Auto-create a free-tier API key
      createApiKey(user.id)
    }
  }

  // Create session
  const sessionToken = crypto.randomUUID()
  createSession(user.id, sessionToken)

  return { sessionToken, user }
}
```

- [ ] **Step 4: Implement session middleware**

Create `src/auth/middleware.ts`:

```typescript
import type { Context, Next } from 'hono'
import { findSessionByToken, refreshSession, findUserById } from '../db/index'
import type { UserRecord } from '../types'

const SESSION_COOKIE = 'oge_session'

export function sessionMiddleware() {
  return async (c: Context, next: Next) => {
    const cookie = getCookie(c, SESSION_COOKIE)
    if (!cookie) {
      return redirectToLogin(c)
    }

    const session = findSessionByToken(cookie)
    if (!session) {
      clearSessionCookie(c)
      return redirectToLogin(c)
    }

    const user = findUserById(session.user_id)
    if (!user || !user.active) {
      clearSessionCookie(c)
      return redirectToLogin(c)
    }

    // Rolling expiry
    refreshSession(session.id)

    c.set('user', user)
    c.set('session', session)
    await next()
  }
}

export function csrfMiddleware() {
  return async (c: Context, next: Next) => {
    const method = c.req.method
    if (method === 'POST' || method === 'PUT' || method === 'DELETE') {
      const session = c.get('session' as never) as { csrf_token: string } | undefined
      const headerToken = c.req.header('X-CSRF-Token')
      if (!session || !headerToken || headerToken !== session.csrf_token) {
        return c.text('CSRF token mismatch', 403)
      }
    }
    await next()
  }
}

export function setSessionCookie(c: Context, token: string): void {
  const secure = process.env.NODE_ENV !== 'development'
  const maxAge = 30 * 24 * 60 * 60 // 30 days in seconds
  c.header('Set-Cookie', `${SESSION_COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure ? '; Secure' : ''}`)
}

export function clearSessionCookie(c: Context): void {
  c.header('Set-Cookie', `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`)
}

function getCookie(c: Context, name: string): string | undefined {
  const cookies = c.req.header('Cookie') ?? ''
  const match = cookies.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`))
  return match?.[1]
}

function redirectToLogin(c: Context): Response {
  const returnTo = encodeURIComponent(c.req.path)
  return c.redirect(`/auth/login?returnTo=${returnTo}`, 302)
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun run test -- tests/auth.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/auth/session.ts src/auth/middleware.ts tests/auth.test.ts
git commit -m "feat(auth): add session verification, session middleware, CSRF middleware"
```

---

### Task 9: Auth route handlers

**Files:**
- Create: `src/auth/routes.ts`
- Modify: `src/index.ts`
- Test: `tests/auth.test.ts`

- [ ] **Step 1: Write failing test for auth routes**

Append to `tests/auth.test.ts`:

```typescript
import { Hono } from 'hono'

describe('auth routes', () => {
  let app: Hono

  beforeEach(async () => {
    process.env.DATABASE_URL = ':memory:'
    migrate(getDb())
    const { authRoutes } = await import('../src/auth/routes')
    app = new Hono()
    app.route('/', authRoutes)
  })

  afterEach(() => {
    const { closeDb } = require('../src/db/index')
    closeDb()
    delete process.env.DATABASE_URL
  })

  it('GET /auth/login returns login page HTML', async () => {
    const res = await app.request('/auth/login')
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toContain('text/html')
    const html = await res.text()
    expect(html).toContain('<form')
    expect(html).toContain('email')
  })

  it('POST /auth/send-link with valid email returns check-email page', async () => {
    const res = await app.request('/auth/send-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com' }),
    })
    expect(res.status).toBe(200)
    const html = await res.text()
    expect(html).toContain('Check your email')
  })

  it('POST /auth/send-link with invalid email returns 400', async () => {
    const res = await app.request('/auth/send-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'notanemail' }),
    })
    expect(res.status).toBe(400)
  })

  it('GET /auth/verify with valid token sets cookie and redirects', async () => {
    const { token } = createMagicLinkToken('test@example.com')
    const res = await app.request(`/auth/verify?token=${token}`)
    expect(res.status).toBe(302)
    expect(res.headers.get('Location')).toBe('/dashboard')
    expect(res.headers.get('Set-Cookie')).toContain('oge_session=')
  })

  it('GET /auth/verify with invalid token returns 400', async () => {
    const res = await app.request('/auth/verify?token=fake')
    expect(res.status).toBe(400)
    const html = await res.text()
    expect(html).toContain('Invalid or expired')
  })

  it('GET /auth/verify respects returnTo parameter', async () => {
    const { token } = createMagicLinkToken('test@example.com')
    const res = await app.request(`/auth/verify?token=${token}&returnTo=%2Fdashboard%2Fbilling`)
    expect(res.status).toBe(302)
    expect(res.headers.get('Location')).toBe('/dashboard/billing')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- tests/auth.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement auth routes**

Create `src/auth/routes.ts`:

```typescript
import { Hono } from 'hono'
import { z } from 'zod'
import { createMagicLinkToken } from './magic-link'
import { verifyMagicLink } from './session'
import { setSessionCookie, clearSessionCookie } from './middleware'
import { sendMagicLinkEmail } from '../email/send'
import { deleteSession } from '../db/index'
import { escapeHtml } from '../utils/html'

export const authRoutes = new Hono()

const emailSchema = z.object({ email: z.string().email() })

authRoutes.get('/auth/login', (c) => {
  const returnTo = c.req.query('returnTo') ?? ''
  return c.html(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Log in — OG Engine</title>
      <style>
        body { font-family: system-ui, sans-serif; background: #0a0a0a; color: #fff; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
        .card { background: #111; border: 1px solid #333; border-radius: 12px; padding: 40px; max-width: 400px; width: 100%; }
        h1 { font-size: 24px; margin: 0 0 8px; }
        p { color: #888; margin: 0 0 24px; font-size: 14px; }
        label { display: block; font-size: 13px; color: #aaa; margin-bottom: 6px; }
        input[type="email"] { width: 100%; padding: 10px 12px; background: #1a1a1a; border: 1px solid #333; border-radius: 6px; color: #fff; font-size: 14px; box-sizing: border-box; }
        button { width: 100%; padding: 10px; background: #38ef7d; color: #000; border: none; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer; margin-top: 16px; }
        button:hover { background: #2dd66b; }
        .logo { color: #38ef7d; font-weight: bold; font-size: 18px; margin-bottom: 24px; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="logo">⚡ OG Engine</div>
        <h1>Log in</h1>
        <p>Enter your email and we'll send you a magic link.</p>
        <form method="POST" action="/auth/send-link">
          <input type="hidden" name="returnTo" value="${escapeHtml(returnTo)}">
          <label for="email">Email</label>
          <input type="email" id="email" name="email" placeholder="you@example.com" required autofocus>
          <button type="submit">Send magic link</button>
        </form>
      </div>
    </body>
    </html>
  `)
})

authRoutes.post('/auth/send-link', async (c) => {
  let email: string
  let returnTo = ''

  const contentType = c.req.header('Content-Type') ?? ''
  if (contentType.includes('application/json')) {
    const body = await c.req.json()
    const parsed = emailSchema.safeParse(body)
    if (!parsed.success) return c.json({ error: 'Invalid email' }, 400)
    email = parsed.data.email
    returnTo = (body as any).returnTo ?? ''
  } else {
    const form = await c.req.parseBody()
    const parsed = emailSchema.safeParse({ email: form.email })
    if (!parsed.success) {
      return c.html('<p>Invalid email address. <a href="/auth/login">Try again</a></p>', 400)
    }
    email = parsed.data.email
    returnTo = (form.returnTo as string) ?? ''
  }

  try {
    const { token } = createMagicLinkToken(email)
    const baseUrl = new URL(c.req.url).origin
    const returnToParam = returnTo ? `&returnTo=${encodeURIComponent(returnTo)}` : ''
    const verifyUrl = `${baseUrl}/auth/verify?token=${token}${returnToParam}`
    await sendMagicLinkEmail(email, verifyUrl)
  } catch (err: any) {
    if (err.message?.includes('Too many')) {
      return c.html(`
        <!DOCTYPE html><html><head><title>Too many requests</title>
        <style>body{font-family:system-ui;background:#0a0a0a;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}.card{background:#111;border:1px solid #333;border-radius:12px;padding:40px;max-width:400px;text-align:center}a{color:#38ef7d}</style>
        </head><body><div class="card"><h2>Too many requests</h2><p>Please wait a few minutes before requesting another magic link.</p><p><a href="/auth/login">Back to login</a></p></div></body></html>
      `, 429)
    }
    // For other errors, still show success to prevent email enumeration
  }

  return c.html(`
    <!DOCTYPE html><html><head><title>Check your email</title>
    <style>body{font-family:system-ui;background:#0a0a0a;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}.card{background:#111;border:1px solid #333;border-radius:12px;padding:40px;max-width:400px;text-align:center}a{color:#38ef7d}</style>
    </head><body><div class="card"><h2>Check your email</h2><p style="color:#888">We sent a magic link to <strong>${escapeHtml(email)}</strong>. Click it to log in.</p><p style="color:#666;font-size:13px;margin-top:16px">Link expires in 15 minutes.</p></div></body></html>
  `)
})

authRoutes.get('/auth/verify', (c) => {
  const token = c.req.query('token')
  const returnTo = c.req.query('returnTo') ?? '/dashboard'

  if (!token) {
    return c.html('<p>Missing token. <a href="/auth/login">Request a new link</a></p>', 400)
  }

  try {
    const { sessionToken } = verifyMagicLink(token)
    setSessionCookie(c, sessionToken)
    // Validate returnTo is a relative path to prevent open redirect
    const safePath = returnTo.startsWith('/dashboard') ? returnTo : '/dashboard'
    return c.redirect(safePath, 302)
  } catch {
    return c.html(`
      <!DOCTYPE html><html><head><title>Invalid link</title>
      <style>body{font-family:system-ui;background:#0a0a0a;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}.card{background:#111;border:1px solid #333;border-radius:12px;padding:40px;max-width:400px;text-align:center}a{color:#38ef7d}</style>
      </head><body><div class="card"><h2>Invalid or expired link</h2><p style="color:#888">This magic link has expired or already been used.</p><p><a href="/auth/login">Request a new link</a></p></div></body></html>
    `, 400)
  }
})

authRoutes.post('/auth/logout', (c) => {
  const cookie = c.req.header('Cookie') ?? ''
  const match = cookie.match(/oge_session=([^;]*)/)
  if (match?.[1]) {
    deleteSession(match[1])
  }
  clearSessionCookie(c)
  return c.redirect('/auth/login', 302)
})
```

- [ ] **Step 4: Register auth routes in index.ts**

In `src/index.ts`, add after existing route registrations:

```typescript
import { authRoutes } from './auth/routes'
app.route('/', authRoutes)
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun run test -- tests/auth.test.ts`
Expected: PASS

- [ ] **Step 6: Run full test suite**

Run: `bun run test`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/auth/routes.ts src/index.ts tests/auth.test.ts
git commit -m "feat(auth): add magic link auth routes (login, send-link, verify, logout)"
```

---

## Phase 3: Dashboard

### Task 10: Vendor htmx and create dashboard CSS

**Files:**
- Create: `src/static/htmx.min.js`
- Create: `src/static/dashboard.css`
- Modify: `src/index.ts`

- [ ] **Step 1: Download htmx**

Run: `curl -o src/static/htmx.min.js https://unpkg.com/htmx.org@2.0.4/dist/htmx.min.js`

- [ ] **Step 2: Create dashboard.css**

Create `src/static/dashboard.css`:

```css
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: system-ui, -apple-system, sans-serif; background: #0a0a0a; color: #e0e0e0; }

/* Layout */
.dashboard { display: flex; min-height: 100vh; }
.sidebar { width: 220px; background: #0d1117; border-right: 1px solid #222; padding: 16px 0; flex-shrink: 0; position: fixed; top: 0; bottom: 0; overflow-y: auto; }
.main { flex: 1; margin-left: 220px; padding: 32px; min-height: 100vh; }

/* Sidebar */
.sidebar-logo { padding: 0 16px 20px; border-bottom: 1px solid #222; margin-bottom: 12px; }
.sidebar-logo span { color: #38ef7d; font-weight: bold; font-size: 15px; }
.sidebar-logo small { color: #666; font-size: 11px; display: block; margin-top: 2px; }
.sidebar-nav { padding: 0 8px; }
.sidebar-nav a { display: block; color: #999; padding: 8px 12px; border-radius: 6px; font-size: 13px; text-decoration: none; margin-bottom: 2px; transition: background 0.15s; }
.sidebar-nav a:hover { background: #1a1a2e; color: #ccc; }
.sidebar-nav a.active { background: #1a2332; color: #58a6ff; }
.sidebar-footer { position: absolute; bottom: 0; left: 0; width: 220px; padding: 12px 16px; border-top: 1px solid #222; }
.sidebar-footer .email { color: #666; font-size: 12px; margin-bottom: 8px; overflow: hidden; text-overflow: ellipsis; }
.sidebar-footer a { color: #888; font-size: 13px; text-decoration: none; }

/* Page header */
.page-header h1 { font-size: 20px; color: #fff; margin-bottom: 4px; }
.page-header p { color: #666; font-size: 13px; }
.page-header { margin-bottom: 24px; }

/* Stat cards */
.stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px; }
.stat-card { background: #1a1a2e; border: 1px solid #333; border-radius: 8px; padding: 16px; }
.stat-card .label { color: #888; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
.stat-card .value { color: #fff; font-size: 22px; font-weight: bold; margin-top: 4px; display: block; }
.stat-card .value.accent { color: #38ef7d; }
.stat-card .sub { color: #666; font-size: 12px; margin-top: 2px; }

/* Progress bar */
.progress { background: #333; border-radius: 4px; height: 4px; margin-top: 8px; }
.progress-fill { background: #38ef7d; border-radius: 4px; height: 4px; transition: width 0.3s; }
.progress-fill.warning { background: #f0c040; }
.progress-fill.danger { background: #ff6b6b; }

/* Tables */
.table-card { background: #1a1a2e; border: 1px solid #333; border-radius: 8px; overflow: hidden; }
.table-card .table-header { display: flex; justify-content: space-between; align-items: center; padding: 16px; border-bottom: 1px solid #333; }
.table-card .table-header h2 { font-size: 14px; color: #fff; }
.table-card .table-header a { color: #58a6ff; font-size: 12px; text-decoration: none; }
table { width: 100%; border-collapse: collapse; }
th { text-align: left; padding: 10px 16px; font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #333; }
td { padding: 10px 16px; font-size: 13px; border-bottom: 1px solid #222; color: #ccc; }
tr:last-child td { border-bottom: none; }
tr:hover td { background: #1c1c2e; }

/* Buttons */
.btn { display: inline-block; padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 500; text-decoration: none; cursor: pointer; border: none; transition: background 0.15s; }
.btn-primary { background: #38ef7d; color: #000; }
.btn-primary:hover { background: #2dd66b; }
.btn-secondary { background: #1a1a2e; color: #ccc; border: 1px solid #333; }
.btn-secondary:hover { background: #252540; }
.btn-danger { background: #3a1010; color: #ff6b6b; border: 1px solid #5a2020; }
.btn-danger:hover { background: #4a1515; }
.btn-sm { padding: 4px 10px; font-size: 12px; }

/* Forms */
.form-group { margin-bottom: 16px; }
.form-group label { display: block; font-size: 13px; color: #aaa; margin-bottom: 6px; }
.form-group input, .form-group textarea, .form-group select { width: 100%; padding: 8px 12px; background: #1a1a1a; border: 1px solid #333; border-radius: 6px; color: #fff; font-size: 13px; }
.form-group textarea { min-height: 120px; font-family: monospace; resize: vertical; }

/* Badges */
.badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 500; }
.badge-green { background: #0d2818; color: #38ef7d; }
.badge-yellow { background: #2d2200; color: #f0c040; }
.badge-red { background: #2d0a0a; color: #ff6b6b; }
.badge-blue { background: #0a1a2d; color: #58a6ff; }

/* Empty state */
.empty-state { text-align: center; padding: 48px 24px; color: #666; }
.empty-state h3 { color: #888; margin-bottom: 8px; }

/* Alerts */
.alert { padding: 12px 16px; border-radius: 6px; font-size: 13px; margin-bottom: 16px; }
.alert-warning { background: #2d2200; border: 1px solid #554400; color: #f0c040; }
.alert-info { background: #0a1a2d; border: 1px solid #1a3a5d; color: #58a6ff; }

/* Code / key display */
.key-display { font-family: monospace; background: #1a1a1a; padding: 8px 12px; border-radius: 6px; border: 1px solid #333; font-size: 13px; color: #ccc; }

/* htmx loading indicator */
.htmx-indicator { display: none; }
.htmx-request .htmx-indicator { display: inline; }
```

- [ ] **Step 3: Serve static files from src/static/**

In `src/index.ts`, add static file serving before the route registrations:

```typescript
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

const STATIC_DIR = join(import.meta.dir ?? __dirname, 'static')
const MIME_TYPES: Record<string, string> = {
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.html': 'text/html',
}

app.get('/static/:file', (c) => {
  const file = c.req.param('file')
  const filePath = join(STATIC_DIR, file)
  if (!existsSync(filePath)) return c.notFound()
  const ext = '.' + file.split('.').pop()
  const content = readFileSync(filePath)
  return new Response(content, {
    headers: {
      'Content-Type': MIME_TYPES[ext] ?? 'application/octet-stream',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
})
```

- [ ] **Step 4: Verify static serving works**

Run: `bun run dev` and manually verify `http://localhost:3000/static/dashboard.css` returns CSS.

- [ ] **Step 5: Commit**

```bash
git add src/static/htmx.min.js src/static/dashboard.css src/index.ts
git commit -m "feat(dashboard): vendor htmx, add dashboard CSS, serve static files"
```

---

### Task 11: Dashboard shell layout

**Files:**
- Create: `src/dashboard/layouts/shell.ts`

- [ ] **Step 1: Create the shell layout**

Create `src/dashboard/layouts/shell.ts`:

```typescript
import { escapeHtml } from '../../utils/html'
import type { UserRecord } from '../../types'
import type { SessionRecord } from '../../db/index'

interface ShellOptions {
  user: UserRecord
  session: SessionRecord
  title: string
  activePath: string
  content: string
}

const NAV_ITEMS = [
  { path: '/dashboard', label: 'Overview', icon: '📊' },
  { path: '/dashboard/images', label: 'Images', icon: '🖼️' },
  { path: '/dashboard/api-keys', label: 'API Keys', icon: '🔑' },
  { path: '/dashboard/billing', label: 'Billing', icon: '💳' },
  { path: '/dashboard/usage', label: 'Usage', icon: '📈' },
  { path: '/dashboard/templates', label: 'Templates', icon: '🎨' },
  { path: '/dashboard/webhooks', label: 'Webhooks', icon: '🔗' },
  { path: '/dashboard/settings', label: 'Settings', icon: '⚙️' },
]

export function renderShell(opts: ShellOptions): string {
  const { user, session, title, activePath, content } = opts

  const navHtml = NAV_ITEMS.map((item) => {
    const isActive = activePath === item.path || (item.path !== '/dashboard' && activePath.startsWith(item.path))
    return `<a href="${item.path}" hx-get="${item.path}" hx-target="#main-content" hx-push-url="true" class="${isActive ? 'active' : ''}">${item.icon} ${item.label}</a>`
  }).join('\n')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="csrf-token" content="${escapeHtml(session.csrf_token)}">
  <title>${escapeHtml(title)} — OG Engine</title>
  <link rel="stylesheet" href="/static/dashboard.css">
</head>
<body hx-headers='{"X-CSRF-Token": "${escapeHtml(session.csrf_token)}"}'>
  <div class="dashboard">
    <aside class="sidebar">
      <div class="sidebar-logo">
        <span>⚡ OG Engine</span>
        <small>Dashboard</small>
      </div>
      <nav class="sidebar-nav">
        ${navHtml}
      </nav>
      <div class="sidebar-footer">
        <div class="email">${escapeHtml(user.email)}</div>
        <form method="POST" action="/auth/logout" style="display:inline">
          <button type="submit" style="background:none;border:none;color:#888;font-size:13px;cursor:pointer;padding:0">🚪 Log out</button>
        </form>
      </div>
    </aside>
    <main class="main">
      <div id="main-content">
        ${content}
      </div>
    </main>
  </div>
  <script src="/static/htmx.min.js"></script>
</body>
</html>`
}
```

- [ ] **Step 2: Commit**

```bash
git add src/dashboard/layouts/shell.ts
git commit -m "feat(dashboard): add shell layout with sidebar navigation"
```

---

### Task 12: Dashboard routes + Overview page

**Files:**
- Create: `src/dashboard/routes.ts`
- Create: `src/dashboard/views/overview.ts`
- Modify: `src/index.ts`
- Test: `tests/dashboard.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/dashboard.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Hono } from 'hono'
import { getDb, migrate, createUser, createApiKey, createSession } from '../src/db/index'

describe('dashboard routes', () => {
  let app: Hono
  let sessionToken: string

  beforeEach(async () => {
    process.env.DATABASE_URL = ':memory:'
    migrate(getDb())

    const user = createUser('dash@example.com')
    createApiKey(user.id)
    sessionToken = crypto.randomUUID()
    createSession(user.id, sessionToken)

    const { dashboardRoutes } = await import('../src/dashboard/routes')
    const { sessionMiddleware, csrfMiddleware } = await import('../src/auth/middleware')
    app = new Hono()
    app.use('/dashboard/*', sessionMiddleware())
    app.use('/dashboard/*', csrfMiddleware())
    app.route('/', dashboardRoutes)
  })

  afterEach(() => {
    const { closeDb } = require('../src/db/index')
    closeDb()
    delete process.env.DATABASE_URL
  })

  it('GET /dashboard returns full page with shell', async () => {
    const res = await app.request('/dashboard', {
      headers: { Cookie: `oge_session=${sessionToken}` },
    })
    expect(res.status).toBe(200)
    const html = await res.text()
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('Overview')
    expect(html).toContain('sidebar')
    expect(html).toContain('dash@example.com')
  })

  it('GET /dashboard with HX-Request returns partial', async () => {
    const res = await app.request('/dashboard', {
      headers: {
        Cookie: `oge_session=${sessionToken}`,
        'HX-Request': 'true',
      },
    })
    expect(res.status).toBe(200)
    const html = await res.text()
    expect(html).not.toContain('<!DOCTYPE html>')
    expect(html).toContain('Overview')
  })

  it('GET /dashboard without session redirects to login', async () => {
    const res = await app.request('/dashboard')
    expect(res.status).toBe(302)
    expect(res.headers.get('Location')).toContain('/auth/login')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- tests/dashboard.test.ts`
Expected: FAIL

- [ ] **Step 3: Create overview view**

Create `src/dashboard/views/overview.ts`:

```typescript
import { escapeHtml } from '../../utils/html'
import type { UserRecord } from '../../types'
import type { RenderHistoryRecord } from '../../db/index'
import { PLAN_LIMITS } from '../../db/index'

interface OverviewData {
  user: UserRecord
  avgRenderTime: number
  recentRenders: RenderHistoryRecord[]
}

const PLAN_PRICES: Record<string, string> = {
  free: 'Free',
  starter: '€10/mo',
  pro: '€39/mo',
  scale: '€99/mo',
}

export function overviewView(data: OverviewData): string {
  const { user, avgRenderTime, recentRenders } = data
  const usagePercent = user.calls_limit > 0 ? (user.calls_used / user.calls_limit) * 100 : 0
  const progressClass = usagePercent >= 90 ? 'danger' : usagePercent >= 80 ? 'warning' : ''

  const rendersHtml = recentRenders.length === 0
    ? '<div class="empty-state"><h3>No renders yet</h3><p>Start using the API to see your render history here.</p></div>'
    : recentRenders.map((r) => {
        const payload = JSON.parse(r.request_payload || '{}')
        const title = payload.title ?? '(untitled)'
        return `<tr>
          <td>${escapeHtml(title)}</td>
          <td><span class="badge badge-blue">${escapeHtml(r.format)}</span></td>
          <td>${escapeHtml(r.template ?? 'default')}</td>
          <td>${r.render_time_ms?.toFixed(1) ?? '—'}ms</td>
          <td style="color:#666">${new Date(r.created_at).toLocaleString()}</td>
        </tr>`
      }).join('')

  return `
    <div class="page-header">
      <h1>Overview</h1>
      <p>Welcome back</p>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <span class="label">Plan</span>
        <span class="value accent">${escapeHtml(user.plan.charAt(0).toUpperCase() + user.plan.slice(1))}</span>
        <span class="sub">${PLAN_PRICES[user.plan] ?? ''}</span>
      </div>
      <div class="stat-card">
        <span class="label">Usage This Period</span>
        <span class="value">${user.calls_used.toLocaleString()}</span>
        <span class="sub">of ${user.calls_limit.toLocaleString()} renders</span>
        <div class="progress"><div class="progress-fill ${progressClass}" style="width:${Math.min(usagePercent, 100)}%"></div></div>
      </div>
      <div class="stat-card">
        <span class="label">Avg Render Time</span>
        <span class="value">${avgRenderTime.toFixed(1)}ms</span>
        <span class="sub">last 7 days</span>
      </div>
    </div>

    <div class="table-card">
      <div class="table-header">
        <h2>Recent Renders</h2>
        <a href="/dashboard/images" hx-get="/dashboard/images" hx-target="#main-content" hx-push-url="true">View all →</a>
      </div>
      ${recentRenders.length > 0 ? `
      <table>
        <thead><tr><th>Title</th><th>Format</th><th>Template</th><th>Time</th><th>Date</th></tr></thead>
        <tbody>${rendersHtml}</tbody>
      </table>` : rendersHtml}
    </div>
  `
}
```

- [ ] **Step 4: Create dashboard routes**

Create `src/dashboard/routes.ts`:

```typescript
import { Hono } from 'hono'
import type { UserRecord } from '../types'
import type { SessionRecord } from '../db/index'
import { getRenderHistory, getDb } from '../db/index'
import { renderShell } from './layouts/shell'
import { overviewView } from './views/overview'

export const dashboardRoutes = new Hono()

function isHtmx(c: any): boolean {
  return c.req.header('HX-Request') === 'true'
}

function respond(c: any, title: string, path: string, content: string): Response {
  if (isHtmx(c)) {
    return c.html(content)
  }
  const user = c.get('user' as never) as UserRecord
  const session = c.get('session' as never) as SessionRecord
  return c.html(renderShell({ user, session, title, activePath: path, content }))
}

dashboardRoutes.get('/dashboard', (c) => {
  const user = c.get('user' as never) as UserRecord
  const recentRenders = getRenderHistory(user.id, { limit: 10, offset: 0 })

  // Calculate avg render time for last 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const avgResult = getDb().prepare(
    'SELECT AVG(render_time_ms) as avg FROM render_history WHERE user_id = ? AND created_at > ? AND render_time_ms IS NOT NULL'
  ).get(user.id, sevenDaysAgo) as { avg: number | null }

  const content = overviewView({
    user,
    avgRenderTime: avgResult.avg ?? 0,
    recentRenders,
  })

  return respond(c, 'Overview', '/dashboard', content)
})
```

- [ ] **Step 5: Register dashboard routes in index.ts**

In `src/index.ts`, add:

```typescript
import { dashboardRoutes } from './dashboard/routes'
import { sessionMiddleware, csrfMiddleware } from './auth/middleware'

// Apply session middleware to dashboard routes
app.use('/dashboard/*', sessionMiddleware())
app.use('/dashboard/*', csrfMiddleware())
app.route('/', dashboardRoutes)
```

- [ ] **Step 6: Run test to verify it passes**

Run: `bun run test -- tests/dashboard.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/dashboard/ tests/dashboard.test.ts src/index.ts
git commit -m "feat(dashboard): add routes, shell layout, and overview page"
```

---

### Task 13: Images view (render history + re-render)

**Files:**
- Create: `src/dashboard/views/images.ts`
- Modify: `src/dashboard/routes.ts`
- Test: `tests/dashboard.test.ts`

- [ ] **Step 1: Write failing test**

Append to `tests/dashboard.test.ts`:

```typescript
import { logRender } from '../src/db/index'

describe('images section', () => {
  let app: Hono
  let sessionToken: string
  let userId: string

  beforeEach(async () => {
    process.env.DATABASE_URL = ':memory:'
    migrate(getDb())
    const user = createUser('img@example.com')
    userId = user.id
    const key = createApiKey(user.id)
    sessionToken = crypto.randomUUID()
    createSession(user.id, sessionToken)

    logRender({ userId: user.id, apiKeyId: key.id, endpoint: '/render', requestPayload: { title: 'Test Image', format: 'og', template: 'default' }, format: 'og', template: 'default', renderTimeMs: 15 })

    const { dashboardRoutes } = await import('../src/dashboard/routes')
    const { sessionMiddleware, csrfMiddleware } = await import('../src/auth/middleware')
    app = new Hono()
    app.use('/dashboard/*', sessionMiddleware())
    app.use('/dashboard/*', csrfMiddleware())
    app.route('/', dashboardRoutes)
  })

  afterEach(() => {
    const { closeDb } = require('../src/db/index')
    closeDb()
    delete process.env.DATABASE_URL
  })

  it('GET /dashboard/images returns render history', async () => {
    const res = await app.request('/dashboard/images', {
      headers: { Cookie: `oge_session=${sessionToken}` },
    })
    expect(res.status).toBe(200)
    const html = await res.text()
    expect(html).toContain('Test Image')
    expect(html).toContain('og')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- tests/dashboard.test.ts`
Expected: FAIL

- [ ] **Step 3: Create images view**

Create `src/dashboard/views/images.ts`:

```typescript
import { escapeHtml } from '../../utils/html'
import type { RenderHistoryRecord } from '../../db/index'

interface ImagesData {
  renders: RenderHistoryRecord[]
  hasMore: boolean
  offset: number
}

export function imagesView(data: ImagesData): string {
  const { renders, hasMore, offset } = data

  if (renders.length === 0 && offset === 0) {
    return `
      <div class="page-header"><h1>Images</h1><p>Your render history</p></div>
      <div class="empty-state"><h3>No renders yet</h3><p>Images you generate via the API will appear here.</p></div>
    `
  }

  const rowsHtml = renders.map((r, i) => {
    const payload = JSON.parse(r.request_payload || '{}')
    const title = payload.title ?? '(untitled)'
    const isLast = i === renders.length - 1 && hasMore
    const loadMore = isLast
      ? ` hx-get="/dashboard/images?offset=${offset + renders.length}" hx-trigger="revealed" hx-swap="afterend" hx-target="this"`
      : ''
    return `<tr${loadMore}>
      <td>${escapeHtml(title)}</td>
      <td><span class="badge badge-blue">${escapeHtml(r.format)}</span></td>
      <td>${escapeHtml(r.template ?? 'default')}</td>
      <td>${r.render_time_ms?.toFixed(1) ?? '—'}ms</td>
      <td style="color:#666">${new Date(r.created_at).toLocaleString()}</td>
      <td>
        <button class="btn btn-sm btn-secondary" hx-post="/dashboard/images/${r.id}/render" hx-target="#re-render-result-${r.id}" hx-swap="innerHTML">Re-render</button>
        <span id="re-render-result-${r.id}"></span>
      </td>
    </tr>`
  }).join('')

  const header = offset === 0 ? `<div class="page-header"><h1>Images</h1><p>Your render history</p></div>` : ''

  return `${header}
    ${offset === 0 ? `<div class="table-card"><table>
      <thead><tr><th>Title</th><th>Format</th><th>Template</th><th>Time</th><th>Date</th><th></th></tr></thead>
      <tbody>` : ''}${rowsHtml}${offset === 0 ? '</tbody></table></div>' : ''}`
}
```

- [ ] **Step 4: Add route to dashboard/routes.ts**

In `src/dashboard/routes.ts`, add:

```typescript
import { imagesView } from './views/images'
import { getRenderHistoryById } from '../db/index'
import { renderCard } from '../engine/renderer'

dashboardRoutes.get('/dashboard/images', (c) => {
  const user = c.get('user' as never) as UserRecord
  const offset = parseInt(c.req.query('offset') ?? '0', 10)
  const limit = 20
  const renders = getRenderHistory(user.id, { limit: limit + 1, offset })
  const hasMore = renders.length > limit
  if (hasMore) renders.pop()

  const content = imagesView({ renders, hasMore, offset })
  return respond(c, 'Images', '/dashboard/images', content)
})

dashboardRoutes.post('/dashboard/images/:id/render', async (c) => {
  const user = c.get('user' as never) as UserRecord
  const id = c.req.param('id')
  const record = getRenderHistoryById(id)
  if (!record || record.user_id !== user.id) {
    return c.text('Not found', 404)
  }

  const payload = JSON.parse(record.request_payload || '{}')
  try {
    const result = await renderCard({
      title: payload.title ?? '',
      description: payload.description ?? '',
      author: payload.author ?? '',
      tag: payload.tag ?? '',
      format: payload.format ?? 'og',
      template: payload.template ?? 'default',
      accent: payload.style?.accent ?? '#38ef7d',
      layout: payload.style?.layout ?? 'left',
      titleSize: payload.style?.titleSize ?? 48,
      descSize: payload.style?.descSize ?? 22,
      fontName: payload.style?.font ?? 'Outfit',
      gradient: payload.style?.gradient ?? 'void',
      overlayOpacity: payload.style?.overlayOpacity ?? 0.65,
      autoFit: payload.style?.autoFit ?? false,
      outputFormat: payload.output?.format ?? 'png',
      outputQuality: payload.output?.quality ?? 90,
      variables: payload.variables ?? {},
      namedImages: {},
    })
    return new Response(result.buffer, {
      headers: {
        'Content-Type': result.contentType,
        'Content-Disposition': `attachment; filename="og-${id}.${payload.output?.format ?? 'png'}"`,
      },
    })
  } catch {
    return c.html('<span class="badge badge-red">Render failed</span>')
  }
})
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun run test -- tests/dashboard.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/dashboard/views/images.ts src/dashboard/routes.ts tests/dashboard.test.ts
git commit -m "feat(dashboard): add images view with render history and re-render"
```

---

### Task 14: API Keys view

**Files:**
- Create: `src/dashboard/views/api-keys.ts`
- Modify: `src/dashboard/routes.ts`
- Modify: `src/db/index.ts`
- Test: `tests/dashboard.test.ts`

- [ ] **Step 1: Write failing test**

Append to `tests/dashboard.test.ts`:

```typescript
describe('api-keys section', () => {
  let app: Hono
  let sessionToken: string
  let csrfToken: string

  beforeEach(async () => {
    process.env.DATABASE_URL = ':memory:'
    migrate(getDb())
    const user = createUser('keys@example.com')
    createApiKey(user.id)
    sessionToken = crypto.randomUUID()
    const session = createSession(user.id, sessionToken)
    csrfToken = session.csrf_token

    const { dashboardRoutes } = await import('../src/dashboard/routes')
    const { sessionMiddleware, csrfMiddleware } = await import('../src/auth/middleware')
    app = new Hono()
    app.use('/dashboard/*', sessionMiddleware())
    app.use('/dashboard/*', csrfMiddleware())
    app.route('/', dashboardRoutes)
  })

  afterEach(() => {
    const { closeDb } = require('../src/db/index')
    closeDb()
    delete process.env.DATABASE_URL
  })

  it('GET /dashboard/api-keys lists user keys', async () => {
    const res = await app.request('/dashboard/api-keys', {
      headers: { Cookie: `oge_session=${sessionToken}` },
    })
    expect(res.status).toBe(200)
    const html = await res.text()
    expect(html).toContain('oge_sk_')
    expect(html).toContain('API Keys')
  })

  it('POST /dashboard/api-keys creates a new key', async () => {
    const res = await app.request('/dashboard/api-keys', {
      method: 'POST',
      headers: {
        Cookie: `oge_session=${sessionToken}`,
        'X-CSRF-Token': csrfToken,
        'HX-Request': 'true',
      },
    })
    expect(res.status).toBe(200)
    const html = await res.text()
    expect(html).toContain('oge_sk_')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- tests/dashboard.test.ts`
Expected: FAIL

- [ ] **Step 3: Add listApiKeysByUserId to db**

In `src/db/index.ts`, add:

```typescript
export function listApiKeysByUserId(userId: string): ApiKeyRecord[] {
  return getDb().prepare('SELECT * FROM api_keys WHERE user_id = ? AND active = 1 ORDER BY created_at DESC').all(userId) as ApiKeyRecord[]
}

export function deactivateApiKey(id: string): void {
  getDb().prepare('UPDATE api_keys SET active = 0 WHERE id = ?').run(id)
}

export function regenerateApiKey(id: string): ApiKeyRecord {
  const newKey = generateApiKey()
  getDb().prepare('UPDATE api_keys SET key = ? WHERE id = ?').run(newKey, id)
  return getDb().prepare('SELECT * FROM api_keys WHERE id = ?').get(id) as ApiKeyRecord
}
```

- [ ] **Step 4: Create api-keys view**

Create `src/dashboard/views/api-keys.ts`:

```typescript
import { escapeHtml } from '../../utils/html'
import type { ApiKeyRecord } from '../../types'

export function apiKeysView(keys: ApiKeyRecord[]): string {
  const rowsHtml = keys.map((k) => {
    const masked = '••••••••' + k.key.slice(-8)
    return `<tr id="key-row-${k.id}">
      <td><span class="key-display">${escapeHtml(masked)}</span></td>
      <td style="color:#666">${new Date(k.created_at).toLocaleString()}</td>
      <td>
        <button class="btn btn-sm btn-secondary" onclick="navigator.clipboard.writeText('${escapeHtml(k.key)}')">Copy</button>
        <button class="btn btn-sm btn-secondary" hx-post="/dashboard/api-keys/${k.id}/regenerate" hx-target="#key-row-${k.id}" hx-swap="outerHTML" hx-confirm="Regenerate this key? The old key will stop working immediately.">Regenerate</button>
        <button class="btn btn-sm btn-danger" hx-delete="/dashboard/api-keys/${k.id}" hx-target="#key-row-${k.id}" hx-swap="outerHTML" hx-confirm="Revoke this key? This cannot be undone.">Revoke</button>
      </td>
    </tr>`
  }).join('')

  return `
    <div class="page-header">
      <h1>API Keys</h1>
      <p>Manage your API keys</p>
    </div>

    <div style="margin-bottom:16px">
      <button class="btn btn-primary" hx-post="/dashboard/api-keys" hx-target="#keys-table tbody" hx-swap="afterbegin">Create new key</button>
    </div>

    <div class="table-card" id="keys-table">
      <table>
        <thead><tr><th>Key</th><th>Created</th><th>Actions</th></tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>
  `
}

export function apiKeyRow(key: ApiKeyRecord): string {
  const masked = '••••••••' + key.key.slice(-8)
  return `<tr id="key-row-${key.id}">
    <td><span class="key-display">${escapeHtml(masked)}</span></td>
    <td style="color:#666">${new Date(key.created_at).toLocaleString()}</td>
    <td>
      <button class="btn btn-sm btn-secondary" onclick="navigator.clipboard.writeText('${escapeHtml(key.key)}')">Copy</button>
      <button class="btn btn-sm btn-secondary" hx-post="/dashboard/api-keys/${key.id}/regenerate" hx-target="#key-row-${key.id}" hx-swap="outerHTML" hx-confirm="Regenerate this key? The old key will stop working immediately.">Regenerate</button>
      <button class="btn btn-sm btn-danger" hx-delete="/dashboard/api-keys/${key.id}" hx-target="#key-row-${key.id}" hx-swap="outerHTML" hx-confirm="Revoke this key? This cannot be undone.">Revoke</button>
    </td>
  </tr>`
}
```

- [ ] **Step 5: Add routes**

In `src/dashboard/routes.ts`, add:

```typescript
import { listApiKeysByUserId, createApiKey, deactivateApiKey, regenerateApiKey } from '../db/index'
import { apiKeysView, apiKeyRow } from './views/api-keys'

dashboardRoutes.get('/dashboard/api-keys', (c) => {
  const user = c.get('user' as never) as UserRecord
  const keys = listApiKeysByUserId(user.id)
  return respond(c, 'API Keys', '/dashboard/api-keys', apiKeysView(keys))
})

dashboardRoutes.post('/dashboard/api-keys', (c) => {
  const user = c.get('user' as never) as UserRecord
  const key = createApiKey(user.id)
  return c.html(apiKeyRow(key))
})

dashboardRoutes.post('/dashboard/api-keys/:id/regenerate', (c) => {
  const user = c.get('user' as never) as UserRecord
  const id = c.req.param('id')
  const keys = listApiKeysByUserId(user.id)
  if (!keys.find((k) => k.id === id)) return c.text('Not found', 404)
  const updated = regenerateApiKey(id)
  return c.html(apiKeyRow(updated))
})

dashboardRoutes.delete('/dashboard/api-keys/:id', (c) => {
  const user = c.get('user' as never) as UserRecord
  const id = c.req.param('id')
  const keys = listApiKeysByUserId(user.id)
  if (!keys.find((k) => k.id === id)) return c.text('Not found', 404)
  deactivateApiKey(id)
  return c.text('') // empty response removes the row via hx-swap="outerHTML"
})
```

- [ ] **Step 6: Run tests**

Run: `bun run test -- tests/dashboard.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/dashboard/views/api-keys.ts src/dashboard/routes.ts src/db/index.ts tests/dashboard.test.ts
git commit -m "feat(dashboard): add API keys view with create/revoke/regenerate"
```

---

### Task 15: Billing view

**Files:**
- Create: `src/dashboard/views/billing.ts`
- Modify: `src/dashboard/routes.ts`

- [ ] **Step 1: Create billing view**

Create `src/dashboard/views/billing.ts`:

```typescript
import { escapeHtml } from '../../utils/html'
import type { UserRecord } from '../../types'

const PLAN_PRICES: Record<string, string> = {
  free: 'Free',
  starter: '€10/mo',
  pro: '€39/mo',
  scale: '€99/mo',
}

export function billingView(user: UserRecord, portalAvailable: boolean): string {
  const usagePercent = user.calls_limit > 0 ? (user.calls_used / user.calls_limit) * 100 : 0
  const progressClass = usagePercent >= 90 ? 'danger' : usagePercent >= 80 ? 'warning' : ''

  const manageButton = user.stripe_customer_id && portalAvailable
    ? `<a href="/billing/portal" class="btn btn-primary">Manage Subscription</a>`
    : user.plan === 'free'
    ? `<div class="alert alert-info">Upgrade your plan to unlock more renders and features.</div>`
    : ''

  return `
    <div class="page-header">
      <h1>Billing</h1>
      <p>Manage your subscription and billing</p>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <span class="label">Current Plan</span>
        <span class="value accent">${escapeHtml(user.plan.charAt(0).toUpperCase() + user.plan.slice(1))}</span>
        <span class="sub">${PLAN_PRICES[user.plan] ?? ''}</span>
      </div>
      <div class="stat-card">
        <span class="label">Usage</span>
        <span class="value">${user.calls_used.toLocaleString()} / ${user.calls_limit.toLocaleString()}</span>
        <div class="progress"><div class="progress-fill ${progressClass}" style="width:${Math.min(usagePercent, 100)}%"></div></div>
      </div>
      <div class="stat-card">
        <span class="label">Period Start</span>
        <span class="value" style="font-size:16px">${new Date(user.period_start).toLocaleDateString()}</span>
      </div>
    </div>

    ${manageButton}
  `
}
```

- [ ] **Step 2: Add route**

In `src/dashboard/routes.ts`, add:

```typescript
import { billingView } from './views/billing'

dashboardRoutes.get('/dashboard/billing', (c) => {
  const user = c.get('user' as never) as UserRecord
  const portalAvailable = !!process.env.STRIPE_SECRET_KEY
  return respond(c, 'Billing', '/dashboard/billing', billingView(user, portalAvailable))
})
```

- [ ] **Step 3: Commit**

```bash
git add src/dashboard/views/billing.ts src/dashboard/routes.ts
git commit -m "feat(dashboard): add billing view with plan info and Stripe portal link"
```

---

### Task 16: Usage analytics view

**Files:**
- Create: `src/dashboard/views/usage.ts`
- Modify: `src/dashboard/routes.ts`
- Modify: `src/db/index.ts`

- [ ] **Step 1: Add daily usage query to db**

In `src/db/index.ts`, add:

```typescript
export function getDailyUsage(userId: string, days: number = 30): { date: string; count: number }[] {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  return getDb().prepare(`
    SELECT DATE(created_at) as date, COUNT(*) as count
    FROM render_history WHERE user_id = ? AND created_at > ?
    GROUP BY DATE(created_at) ORDER BY date
  `).all(userId, since) as { date: string; count: number }[]
}
```

- [ ] **Step 2: Create usage view**

Create `src/dashboard/views/usage.ts`:

```typescript
import type { UserRecord } from '../../types'

interface UsageData {
  user: UserRecord
  daily: { date: string; count: number }[]
  byEndpoint: Record<string, number>
  byFormat: Record<string, number>
  total: number
}

export function usageView(data: UsageData): string {
  const { user, daily, byEndpoint, byFormat, total } = data
  const usagePercent = user.calls_limit > 0 ? (user.calls_used / user.calls_limit) * 100 : 0
  const warning = usagePercent >= 80
    ? `<div class="alert alert-warning">You've used ${usagePercent.toFixed(0)}% of your quota this period.</div>`
    : ''

  const maxDaily = Math.max(...daily.map((d) => d.count), 1)
  const barsHtml = daily.map((d) => {
    const height = Math.max((d.count / maxDaily) * 120, 2)
    return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;min-width:12px">
      <div style="background:#38ef7d;width:100%;height:${height}px;border-radius:2px 2px 0 0;max-width:20px" title="${d.date}: ${d.count} renders"></div>
    </div>`
  }).join('')

  const endpointRows = Object.entries(byEndpoint).map(([ep, count]) =>
    `<tr><td>${ep}</td><td>${count}</td></tr>`
  ).join('')

  const formatRows = Object.entries(byFormat).map(([fmt, count]) =>
    `<tr><td>${fmt}</td><td>${count}</td></tr>`
  ).join('')

  return `
    <div class="page-header">
      <h1>Usage Analytics</h1>
      <p>Total renders: ${total.toLocaleString()}</p>
    </div>

    ${warning}

    <div class="table-card" style="margin-bottom:24px">
      <div class="table-header">
        <h2>Renders per Day</h2>
        <div>
          <button class="btn btn-sm btn-secondary" hx-get="/dashboard/usage?days=7" hx-target="#main-content" hx-push-url="false">7d</button>
          <button class="btn btn-sm btn-secondary" hx-get="/dashboard/usage?days=30" hx-target="#main-content" hx-push-url="false">30d</button>
          <button class="btn btn-sm btn-secondary" hx-get="/dashboard/usage?days=90" hx-target="#main-content" hx-push-url="false">90d</button>
        </div>
      </div>
      <div style="padding:16px;display:flex;align-items:flex-end;height:160px;gap:2px">
        ${daily.length > 0 ? barsHtml : '<div class="empty-state" style="width:100%"><p>No usage data yet</p></div>'}
      </div>
    </div>

    <div class="stats-grid">
      <div class="table-card">
        <div class="table-header"><h2>By Endpoint</h2></div>
        <table><thead><tr><th>Endpoint</th><th>Count</th></tr></thead><tbody>${endpointRows || '<tr><td colspan="2" style="color:#666">No data</td></tr>'}</tbody></table>
      </div>
      <div class="table-card">
        <div class="table-header"><h2>By Format</h2></div>
        <table><thead><tr><th>Format</th><th>Count</th></tr></thead><tbody>${formatRows || '<tr><td colspan="2" style="color:#666">No data</td></tr>'}</tbody></table>
      </div>
    </div>
  `
}
```

- [ ] **Step 3: Add route**

In `src/dashboard/routes.ts`, add:

```typescript
import { getDailyUsage, getUsageStats } from '../db/index'
import { usageView } from './views/usage'

dashboardRoutes.get('/dashboard/usage', (c) => {
  const user = c.get('user' as never) as UserRecord
  const days = parseInt(c.req.query('days') ?? '30', 10)
  const daily = getDailyUsage(user.id, days)
  const stats = getUsageStats(user.id)
  const content = usageView({ user, daily, byEndpoint: stats.byEndpoint, byFormat: stats.byFormat, total: stats.total })
  return respond(c, 'Usage', '/dashboard/usage', content)
})
```

- [ ] **Step 4: Commit**

```bash
git add src/dashboard/views/usage.ts src/dashboard/routes.ts src/db/index.ts
git commit -m "feat(dashboard): add usage analytics view with daily chart and breakdowns"
```

---

### Task 17: Templates, Webhooks, and Settings views

**Files:**
- Create: `src/dashboard/views/templates.ts`
- Create: `src/dashboard/views/webhooks.ts`
- Create: `src/dashboard/views/settings.ts`
- Modify: `src/dashboard/routes.ts`

- [ ] **Step 1: Create templates view**

Create `src/dashboard/views/templates.ts`:

```typescript
import { escapeHtml } from '../../utils/html'
import type { UserRecord } from '../../types'
import type { CustomTemplateRecord } from '../../db/index'

export function templatesView(user: UserRecord, templates: CustomTemplateRecord[]): string {
  if (user.plan !== 'scale') {
    return `
      <div class="page-header"><h1>Custom Templates</h1><p>Create your own JSON templates</p></div>
      <div class="alert alert-info">Custom templates are available on the Scale plan. <a href="/dashboard/billing" hx-get="/dashboard/billing" hx-target="#main-content" hx-push-url="true">Upgrade your plan</a></div>
    `
  }

  const listHtml = templates.length === 0
    ? '<div class="empty-state"><h3>No custom templates</h3><p>Create your first template below.</p></div>'
    : templates.map((t) => `
        <tr id="template-row-${t.id}">
          <td>${escapeHtml(t.name)}</td>
          <td style="color:#666">${new Date(t.updated_at).toLocaleString()}</td>
          <td>
            <button class="btn btn-sm btn-danger" hx-delete="/dashboard/templates/${t.id}" hx-target="#template-row-${t.id}" hx-swap="outerHTML" hx-confirm="Delete template '${escapeHtml(t.name)}'?">Delete</button>
          </td>
        </tr>
      `).join('')

  return `
    <div class="page-header"><h1>Custom Templates</h1><p>Create and manage JSON templates</p></div>

    <div class="table-card" style="margin-bottom:24px">
      <table><thead><tr><th>Name</th><th>Updated</th><th>Actions</th></tr></thead>
      <tbody>${listHtml}</tbody></table>
    </div>

    <div class="table-card">
      <div class="table-header"><h2>Create Template</h2></div>
      <form hx-post="/dashboard/templates" hx-target="#main-content" hx-swap="innerHTML" style="padding:16px">
        <div class="form-group">
          <label for="template-name">Name</label>
          <input type="text" id="template-name" name="name" placeholder="my-template" required>
        </div>
        <div class="form-group">
          <label for="template-def">Definition (JSON)</label>
          <textarea id="template-def" name="definition" placeholder='{"layout": "...", "elements": [...]}'></textarea>
        </div>
        <button type="submit" class="btn btn-primary">Create Template</button>
      </form>
    </div>
  `
}
```

- [ ] **Step 2: Create webhooks view**

Create `src/dashboard/views/webhooks.ts`:

```typescript
import { escapeHtml } from '../../utils/html'
import type { WebhookRecord } from '../../db/index'

export function webhooksView(webhooks: WebhookRecord[]): string {
  const listHtml = webhooks.length === 0
    ? '<div class="empty-state"><h3>No webhooks</h3><p>Create a webhook to trigger renders automatically.</p></div>'
    : webhooks.map((w) => `
        <tr id="webhook-row-${w.id}">
          <td>${escapeHtml(w.url)}</td>
          <td><span class="badge ${w.active ? 'badge-green' : 'badge-red'}">${w.active ? 'Active' : 'Inactive'}</span></td>
          <td style="color:#666">${new Date(w.created_at).toLocaleString()}</td>
          <td>
            <button class="btn btn-sm btn-secondary" hx-post="/dashboard/webhooks/${w.id}/test" hx-target="#webhook-result-${w.id}" hx-swap="innerHTML">Test</button>
            <span id="webhook-result-${w.id}"></span>
            <button class="btn btn-sm btn-danger" hx-delete="/dashboard/webhooks/${w.id}" hx-target="#webhook-row-${w.id}" hx-swap="outerHTML" hx-confirm="Delete this webhook?">Delete</button>
          </td>
        </tr>
      `).join('')

  return `
    <div class="page-header"><h1>Webhooks</h1><p>Manage webhook triggers</p></div>

    <div class="table-card" style="margin-bottom:24px">
      <table><thead><tr><th>URL</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead>
      <tbody>${listHtml}</tbody></table>
    </div>

    <div class="table-card">
      <div class="table-header"><h2>Create Webhook</h2></div>
      <form hx-post="/dashboard/webhooks" hx-target="#main-content" hx-swap="innerHTML" style="padding:16px">
        <div class="form-group">
          <label for="webhook-url">URL</label>
          <input type="url" id="webhook-url" name="url" placeholder="https://example.com/webhook" required>
        </div>
        <button type="submit" class="btn btn-primary">Create Webhook</button>
      </form>
    </div>
  `
}
```

- [ ] **Step 3: Create settings view**

Create `src/dashboard/views/settings.ts`:

```typescript
import { escapeHtml } from '../../utils/html'
import type { UserRecord } from '../../types'

export function settingsView(user: UserRecord): string {
  return `
    <div class="page-header"><h1>Settings</h1><p>Account settings</p></div>

    <div class="table-card" style="margin-bottom:24px">
      <div style="padding:16px">
        <div class="form-group">
          <label>Email</label>
          <div class="key-display">${escapeHtml(user.email)}</div>
          <small style="color:#666;display:block;margin-top:4px">To change your email, log in with a different address.</small>
        </div>

        <div class="form-group">
          <label>Account ID</label>
          <div class="key-display" style="color:#666">${escapeHtml(user.id)}</div>
        </div>

        <div class="form-group">
          <label>Member Since</label>
          <div style="color:#ccc">${new Date(user.created_at).toLocaleDateString()}</div>
        </div>
      </div>
    </div>

    <div class="table-card">
      <div class="table-header"><h2>Danger Zone</h2></div>
      <div style="padding:16px">
        <p style="color:#888;margin-bottom:12px;font-size:13px">Permanently delete your account, all API keys, and render history. This cannot be undone.</p>
        <button class="btn btn-danger" hx-delete="/dashboard/settings/account" hx-confirm="Are you sure you want to delete your account? This will revoke all API keys and cannot be undone.">Delete Account</button>
      </div>
    </div>
  `
}
```

- [ ] **Step 4: Add routes for all three**

In `src/dashboard/routes.ts`, add:

```typescript
import { listCustomTemplatesByUser, createCustomTemplate, deleteCustomTemplate } from '../db/index'
import { listWebhooksByUser, createWebhook, deleteWebhook } from '../db/index'
import { templatesView } from './views/templates'
import { webhooksView } from './views/webhooks'
import { settingsView } from './views/settings'

// Templates
dashboardRoutes.get('/dashboard/templates', (c) => {
  const user = c.get('user' as never) as UserRecord
  const templates = user.plan === 'scale' ? listCustomTemplatesByUser(user.id) : []
  return respond(c, 'Templates', '/dashboard/templates', templatesView(user, templates))
})

dashboardRoutes.post('/dashboard/templates', async (c) => {
  const user = c.get('user' as never) as UserRecord
  if (user.plan !== 'scale') return c.text('Upgrade required', 402)
  const form = await c.req.parseBody()
  const name = form.name as string
  const definition = form.definition as string
  try {
    const parsed = JSON.parse(definition)
    createCustomTemplate(user.id, name, parsed)
  } catch {
    return c.html('<div class="alert alert-warning">Invalid JSON</div>', 400)
  }
  const templates = listCustomTemplates(user.id)
  return c.html(templatesView(user, templates))
})

dashboardRoutes.delete('/dashboard/templates/:id', (c) => {
  const user = c.get('user' as never) as UserRecord
  const id = c.req.param('id')
  deleteCustomTemplate(id)
  return c.text('')
})

// Webhooks
dashboardRoutes.get('/dashboard/webhooks', (c) => {
  const user = c.get('user' as never) as UserRecord
  const webhooks = listWebhooksByUser(user.id)
  return respond(c, 'Webhooks', '/dashboard/webhooks', webhooksView(webhooks))
})

dashboardRoutes.post('/dashboard/webhooks', async (c) => {
  const user = c.get('user' as never) as UserRecord
  const form = await c.req.parseBody()
  const url = form.url as string
  createWebhook(user.id, url, {})
  const webhooks = listWebhooksByUser(user.id)
  return c.html(webhooksView(webhooks))
})

dashboardRoutes.delete('/dashboard/webhooks/:id', (c) => {
  const id = c.req.param('id')
  deleteWebhook(id)
  return c.text('')
})

dashboardRoutes.post('/dashboard/webhooks/:id/test', async (c) => {
  const id = c.req.param('id')
  try {
    const webhook = (await import('../db/index')).findWebhookById(id)
    if (!webhook) return c.html('<span class="badge badge-red">Not found</span>')
    const res = await fetch(webhook.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test: true, timestamp: new Date().toISOString() }),
    })
    return c.html(`<span class="badge ${res.ok ? 'badge-green' : 'badge-red'}">${res.status}</span>`)
  } catch {
    return c.html('<span class="badge badge-red">Failed</span>')
  }
})

// Settings
dashboardRoutes.get('/dashboard/settings', (c) => {
  const user = c.get('user' as never) as UserRecord
  return respond(c, 'Settings', '/dashboard/settings', settingsView(user))
})

dashboardRoutes.delete('/dashboard/settings/account', async (c) => {
  const user = c.get('user' as never) as UserRecord
  // Cancel Stripe subscription if exists
  if (user.stripe_subscription_id && process.env.STRIPE_SECRET_KEY) {
    try {
      const stripe = new (await import('stripe')).default(process.env.STRIPE_SECRET_KEY)
      await stripe.subscriptions.cancel(user.stripe_subscription_id)
    } catch {
      // Best effort
    }
  }
  // Deactivate user and all keys
  getDb().prepare('UPDATE api_keys SET active = 0 WHERE user_id = ?').run(user.id)
  getDb().prepare('UPDATE users SET active = 0 WHERE id = ?').run(user.id)
  getDb().prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id)
  // Clear cookie and redirect
  const { clearSessionCookie } = await import('../auth/middleware')
  clearSessionCookie(c)
  return c.redirect('/auth/login', 302)
})
```

- [ ] **Step 5: Note on listCustomTemplates/listWebhooks**

The existing `listCustomTemplates(apiKeyId)` and `listWebhooks(apiKeyId)` take an `apiKeyId`. These need to be updated to accept `userId` instead, since a user may have multiple keys. Update the WHERE clause from `api_key_id = ?` to `api_key_id IN (SELECT id FROM api_keys WHERE user_id = ?)` — or better, add a `user_id` column to `custom_templates` and `webhooks` tables during the migration task.

For now, the simplest approach is to query by looking up all the user's key IDs first:

```typescript
export function listCustomTemplatesByUser(userId: string): CustomTemplateRecord[] {
  return getDb().prepare(`
    SELECT ct.* FROM custom_templates ct
    JOIN api_keys ak ON ct.api_key_id = ak.id
    WHERE ak.user_id = ?
    ORDER BY ct.updated_at DESC
  `).all(userId) as CustomTemplateRecord[]
}

export function listWebhooksByUser(userId: string): WebhookRecord[] {
  return getDb().prepare(`
    SELECT w.* FROM webhooks w
    JOIN api_keys ak ON w.api_key_id = ak.id
    WHERE ak.user_id = ?
    ORDER BY w.created_at DESC
  `).all(userId) as WebhookRecord[]
}
```

Update the route handlers to use these new functions.

- [ ] **Step 6: Run full test suite**

Run: `bun run test`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/dashboard/views/ src/dashboard/routes.ts src/db/index.ts
git commit -m "feat(dashboard): add templates, webhooks, and settings views"
```

---

## Phase 4: OpenAPI / Swagger

### Task 18: Verify Zod v4 compatibility and set up OpenAPI

**Files:**
- Modify: `package.json`
- Create: `src/openapi/spec.ts`
- Create: `src/openapi/swagger.ts`
- Modify: `src/index.ts`
- Test: `tests/openapi.test.ts`

- [ ] **Step 1: Test Zod v4 compatibility**

Run: `bun add @hono/zod-openapi @hono/swagger-ui`

Then create a quick test to check if it works with Zod v4:

```typescript
// Quick check — run this in a temp file
import { z } from 'zod'
import { createRoute } from '@hono/zod-openapi'

const testRoute = createRoute({
  method: 'get',
  path: '/test',
  responses: {
    200: {
      description: 'OK',
      content: { 'application/json': { schema: z.object({ ok: z.boolean() }) } },
    },
  },
})
console.log('Zod v4 + @hono/zod-openapi: compatible')
```

Run: `bun run /tmp/test-zod-compat.ts`

If this fails, fall back to a static OpenAPI spec. See step 3b.

- [ ] **Step 2: Write failing test**

Create `tests/openapi.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Hono } from 'hono'

describe('OpenAPI', () => {
  let app: Hono

  beforeEach(async () => {
    process.env.DATABASE_URL = ':memory:'
    const { getDb, migrate } = await import('../src/db/index')
    migrate(getDb())

    // Use the full app for this test
    const mod = await import('../src/index')
    app = (mod as any).app ?? new Hono()
  })

  afterEach(() => {
    const { closeDb } = require('../src/db/index')
    closeDb()
    delete process.env.DATABASE_URL
  })

  it('GET /openapi.json returns valid OpenAPI spec', async () => {
    const res = await app.request('/openapi.json')
    expect(res.status).toBe(200)
    const spec = await res.json()
    expect(spec.openapi).toMatch(/^3\./)
    expect(spec.info.title).toBe('OG Engine API')
    expect(spec.paths['/render']).toBeDefined()
    expect(spec.paths['/validate']).toBeDefined()
    expect(spec.paths['/health']).toBeDefined()
  })

  it('GET /docs returns Swagger UI HTML', async () => {
    const res = await app.request('/docs')
    expect(res.status).toBe(200)
    const html = await res.text()
    expect(html).toContain('swagger')
  })
})
```

- [ ] **Step 3a: Implement with @hono/zod-openapi (if compatible)**

Create `src/openapi/spec.ts`:

```typescript
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { renderSchema, validateSchema, batchSchema } from '../schemas/request'

export function createOpenApiSpec() {
  const spec = {
    openapi: '3.1.0',
    info: {
      title: 'OG Engine API',
      description: 'Server-side image generation API. Send JSON, get back PNG/WebP.',
      version: '0.1.0',
    },
    servers: [{ url: '/' }],
    paths: {
      '/render': {
        post: {
          summary: 'Generate an image',
          description: 'Generate an OG image from text + configuration.',
          tags: ['Render'],
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/RenderRequest' } } },
          },
          responses: {
            200: { description: 'Rendered image', content: { 'image/png': {} } },
            400: { description: 'Invalid request' },
            401: { description: 'Unauthorized' },
            429: { description: 'Quota exceeded' },
          },
        },
      },
      '/validate': {
        post: {
          summary: 'Check if text fits',
          description: 'Check if text fits a given layout without generating an image.',
          tags: ['Validate'],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ValidateRequest' } } },
          },
          responses: {
            200: { description: 'Validation result', content: { 'application/json': {} } },
          },
        },
      },
      '/render/from-url': {
        post: {
          summary: 'Render from URL',
          description: 'Fetch OG tags from a URL and render a card automatically.',
          tags: ['Render'],
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { type: 'object', properties: { url: { type: 'string', format: 'uri' }, format: { type: 'string' }, style: { type: 'object' }, overrides: { type: 'object' } }, required: ['url'] } } },
          },
          responses: { 200: { description: 'Rendered image' } },
        },
      },
      '/render/batch': {
        post: {
          summary: 'Batch render',
          description: 'Render multiple images in one request (Pro+ only).',
          tags: ['Render'],
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/BatchRequest' } } },
          },
          responses: { 200: { description: 'ZIP archive of images' }, 402: { description: 'Plan upgrade required' } },
        },
      },
      '/health': {
        get: {
          summary: 'Health check',
          description: 'Service discovery — available fonts, formats, templates.',
          tags: ['System'],
          responses: { 200: { description: 'Service status', content: { 'application/json': {} } } },
        },
      },
      '/auth/register': {
        post: {
          summary: 'Register for an API key',
          description: 'Create a free API key. Returns the key immediately and sends it via email.',
          tags: ['Auth'],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { type: 'object', properties: { email: { type: 'string', format: 'email' } }, required: ['email'] } } },
          },
          responses: { 201: { description: 'API key created' }, 200: { description: 'Key already exists' } },
        },
      },
      '/usage': {
        get: {
          summary: 'Get usage stats',
          description: 'View current quota usage and statistics.',
          tags: ['Account'],
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: 'Usage statistics' } },
        },
      },
      '/billing/portal': {
        get: {
          summary: 'Billing portal',
          description: 'Get a link to the Stripe Customer Portal.',
          tags: ['Account'],
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: 'Portal URL' } },
        },
      },
    },
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', description: 'API key (oge_sk_...)' },
      },
      schemas: {
        RenderRequest: { type: 'object', description: 'See /docs for full schema' },
        ValidateRequest: { type: 'object', description: 'See /docs for full schema' },
        BatchRequest: { type: 'object', description: 'See /docs for full schema' },
      },
    },
  }
  return spec
}
```

Note: If `@hono/zod-openapi` works with Zod v4, convert this to use `createRoute()` with proper Zod schema references for auto-generation. If not, this static spec is the fallback.

- [ ] **Step 3b: Create Swagger UI route**

Create `src/openapi/swagger.ts`:

```typescript
import { Hono } from 'hono'
import { createOpenApiSpec } from './spec'

export const openapiRoutes = new Hono()

openapiRoutes.get('/openapi.json', (c) => {
  return c.json(createOpenApiSpec())
})

openapiRoutes.get('/docs', (c) => {
  return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>OG Engine API — Swagger</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      url: '/openapi.json',
      dom_id: '#swagger-ui',
      deepLinking: true,
      presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
      layout: 'BaseLayout',
    })
  </script>
</body>
</html>`)
})
```

- [ ] **Step 4: Register in index.ts**

In `src/index.ts`, add:

```typescript
import { openapiRoutes } from './openapi/swagger'
app.route('/', openapiRoutes)
```

- [ ] **Step 5: Run test**

Run: `bun run test -- tests/openapi.test.ts`
Expected: PASS

- [ ] **Step 6: Run full test suite**

Run: `bun run test`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/openapi/ tests/openapi.test.ts src/index.ts package.json bun.lockb
git commit -m "feat(openapi): add OpenAPI spec and Swagger UI at /docs"
```

---

## Phase 5: Integration & Polish

### Task 19: End-to-end smoke test

**Files:**
- Test: `tests/e2e.test.ts`

- [ ] **Step 1: Write full flow test**

Create `tests/e2e.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { getDb, migrate, findMagicLinkByToken, createMagicLinkToken } from '../src/db/index'

describe('end-to-end: register → login → dashboard', () => {
  beforeEach(() => {
    process.env.DATABASE_URL = ':memory:'
    process.env.AUTH_ENABLED = 'true'
    migrate(getDb())
  })

  afterEach(() => {
    const { closeDb } = require('../src/db/index')
    closeDb()
    delete process.env.DATABASE_URL
  })

  it('full auth flow: register → magic link → dashboard → logout', async () => {
    // Dynamically import to get a fresh app instance
    const { authRoutes } = await import('../src/auth/routes')
    const { dashboardRoutes } = await import('../src/dashboard/routes')
    const { sessionMiddleware, csrfMiddleware } = await import('../src/auth/middleware')
    const { Hono } = await import('hono')

    const app = new Hono()
    app.route('/', authRoutes)
    app.use('/dashboard/*', sessionMiddleware())
    app.use('/dashboard/*', csrfMiddleware())
    app.route('/', dashboardRoutes)

    // 1. Login page renders
    const loginRes = await app.request('/auth/login')
    expect(loginRes.status).toBe(200)

    // 2. Send magic link
    const sendRes = await app.request('/auth/send-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'e2e@example.com' }),
    })
    expect(sendRes.status).toBe(200)

    // 3. Simulate clicking magic link (get token from DB since email is mocked)
    const { createMagicLinkToken: _ } = await import('../src/auth/magic-link')
    // The token was created via createMagicLinkToken in the route handler
    // We need to find it — query the DB directly
    const db = getDb()
    const link = db.prepare('SELECT * FROM magic_links ORDER BY created_at DESC LIMIT 1').get() as any
    expect(link).not.toBeNull()

    // We can't easily get the raw token from the DB (it's hashed)
    // So let's create a fresh magic link for the test
    const { token } = (await import('../src/auth/magic-link')).createMagicLinkToken('e2e@example.com')

    const verifyRes = await app.request(`/auth/verify?token=${token}`)
    expect(verifyRes.status).toBe(302)
    expect(verifyRes.headers.get('Location')).toBe('/dashboard')
    const setCookie = verifyRes.headers.get('Set-Cookie')!
    expect(setCookie).toContain('oge_session=')

    // Extract session token from cookie
    const sessionToken = setCookie.match(/oge_session=([^;]+)/)![1]

    // 4. Dashboard loads with session
    const dashRes = await app.request('/dashboard', {
      headers: { Cookie: `oge_session=${sessionToken}` },
    })
    expect(dashRes.status).toBe(200)
    const html = await dashRes.text()
    expect(html).toContain('Overview')
    expect(html).toContain('e2e@example.com')

    // 5. Logout
    const logoutRes = await app.request('/auth/logout', {
      method: 'POST',
      headers: { Cookie: `oge_session=${sessionToken}` },
    })
    expect(logoutRes.status).toBe(302)

    // 6. Dashboard now redirects to login
    const afterLogoutRes = await app.request('/dashboard', {
      headers: { Cookie: `oge_session=${sessionToken}` },
    })
    expect(afterLogoutRes.status).toBe(302)
    expect(afterLogoutRes.headers.get('Location')).toContain('/auth/login')
  })
})
```

- [ ] **Step 2: Run test**

Run: `bun run test -- tests/e2e.test.ts`
Expected: PASS

- [ ] **Step 3: Run full test suite**

Run: `bun run test`
Expected: ALL PASS

- [ ] **Step 4: Commit**

```bash
git add tests/e2e.test.ts
git commit -m "test: add end-to-end smoke test for auth → dashboard flow"
```

---

### Task 20: Final integration in index.ts and type-check

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Verify all routes are registered**

Review `src/index.ts` and ensure these route groups are all registered:

1. CORS middleware (existing)
2. Rate limiting (existing)
3. Auth middleware for API routes (existing)
4. Static file serving (`/static/*`)
5. Auth routes (`/auth/*`)
6. Session + CSRF middleware for dashboard (`/dashboard/*`)
7. Dashboard routes (`/dashboard/*`)
8. OpenAPI routes (`/openapi.json`, `/docs`)
9. Existing API routes (unchanged)

- [ ] **Step 2: Export app for testing**

Make sure `src/index.ts` exports the `app` instance for test use:

```typescript
export { app }
```

- [ ] **Step 3: Run type-check**

Run: `bun run type-check`
Expected: No errors

- [ ] **Step 4: Run linter**

Run: `bun run lint`
Fix any issues.

- [ ] **Step 5: Run full test suite**

Run: `bun run test`
Expected: ALL PASS

- [ ] **Step 6: Final commit**

```bash
git add .
git commit -m "feat: complete dashboard, auth, and swagger integration"
```

---

## Summary

| Phase | Tasks | What it delivers |
|---|---|---|
| Phase 1: Database | Tasks 1-5 | Users table, per-user quotas, sessions, magic_links, render_history, migration script |
| Phase 2: Auth | Tasks 6-9 | Magic link flow, session middleware, CSRF protection, auth routes |
| Phase 3: Dashboard | Tasks 10-17 | htmx shell, all 8 dashboard sections, static assets |
| Phase 4: OpenAPI | Task 18 | OpenAPI spec at `/openapi.json`, Swagger UI at `/docs` |
| Phase 5: Integration | Tasks 19-20 | E2E test, final wiring, type-check |
