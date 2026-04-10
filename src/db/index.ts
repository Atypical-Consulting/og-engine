import { join } from 'node:path';
import { openDatabase, type SqliteDatabase } from './sqlite';

export type Plan = 'free' | 'starter' | 'pro' | 'scale';

export const PLAN_LIMITS: Record<Plan, number> = {
  free: 500,
  starter: 10_000,
  pro: 50_000,
  scale: 200_000,
};

export interface ApiKeyRecord {
  id: string;
  key: string;
  email: string;
  user_id: string | null;
  created_at: string;
  active: number;
}

export interface UserRecord {
  id: string;
  email: string;
  plan: Plan;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  calls_limit: number;
  calls_used: number;
  period_start: string;
  created_at: string;
  active: number;
}

export interface UsageLogRecord {
  id: number;
  api_key_id: string;
  endpoint: string;
  render_time_ms: number | null;
  format: string | null;
  created_at: string;
}

let db: SqliteDatabase | null = null;

export function getDb(): SqliteDatabase {
  if (!db) {
    const raw = process.env.DATABASE_URL?.replace('file:', '') ?? join(process.cwd(), 'data', 'og-engine.db');
    db = openDatabase(raw);
    migrate(db);
  }
  return db;
}

function migrate(d: SqliteDatabase): void {
  d.exec(`
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

    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY,
      key TEXT UNIQUE NOT NULL,
      email TEXT NOT NULL,
      user_id TEXT REFERENCES users(id),
      created_at TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);

    CREATE TABLE IF NOT EXISTS usage_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      api_key_id TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      render_time_ms REAL,
      format TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_api_keys_key ON api_keys(key);
    CREATE INDEX IF NOT EXISTS idx_api_keys_email ON api_keys(email);
    CREATE INDEX IF NOT EXISTS idx_usage_log_api_key ON usage_log(api_key_id);

    CREATE TABLE IF NOT EXISTS custom_templates (
      id TEXT PRIMARY KEY,
      api_key_id TEXT NOT NULL,
      name TEXT NOT NULL,
      definition TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_custom_templates_api_key ON custom_templates(api_key_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_custom_templates_name_owner ON custom_templates(api_key_id, name);

    CREATE TABLE IF NOT EXISTS webhooks (
      id TEXT PRIMARY KEY,
      api_key_id TEXT NOT NULL,
      url TEXT NOT NULL,
      render_config TEXT NOT NULL,
      secret TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_webhooks_api_key ON webhooks(api_key_id);
  `);
}

// ─── User CRUD ───────────────────────────────────────────────

export function createUser(email: string, plan: Plan = 'free'): UserRecord {
  const d = getDb();
  const record: UserRecord = {
    id: crypto.randomUUID(),
    email,
    plan,
    stripe_customer_id: null,
    stripe_subscription_id: null,
    calls_limit: PLAN_LIMITS[plan],
    calls_used: 0,
    period_start: new Date().toISOString(),
    created_at: new Date().toISOString(),
    active: 1,
  };

  d.prepare(`
    INSERT INTO users (id, email, plan, stripe_customer_id, stripe_subscription_id, calls_limit, calls_used, period_start, created_at, active)
    VALUES ($id, $email, $plan, $stripe_customer_id, $stripe_subscription_id, $calls_limit, $calls_used, $period_start, $created_at, $active)
  `).run(record);

  return record;
}

export function findUserByEmail(email: string): UserRecord | null {
  const d = getDb();
  return (d.prepare('SELECT * FROM users WHERE email = ?').get(email) as UserRecord) ?? null;
}

export function findUserById(id: string): UserRecord | null {
  const d = getDb();
  return (d.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRecord) ?? null;
}

// ─── API Key CRUD ────────────────────────────────────────────

export function generateApiKey(): string {
  return `oge_sk_${crypto.randomUUID().replace(/-/g, '')}`;
}

export function createApiKey(userId: string): ApiKeyRecord {
  const d = getDb();
  const user = findUserById(userId);
  if (!user) {
    throw new Error(`User not found: ${userId}`);
  }
  const record: ApiKeyRecord = {
    id: crypto.randomUUID(),
    key: generateApiKey(),
    email: user.email,
    user_id: userId,
    created_at: new Date().toISOString(),
    active: 1,
  };

  d.prepare(`
    INSERT INTO api_keys (id, key, email, user_id, created_at, active)
    VALUES ($id, $key, $email, $user_id, $created_at, $active)
  `).run(record);

  return record;
}

export function findApiKeyByKey(key: string): ApiKeyRecord | null {
  const d = getDb();
  return (d.prepare('SELECT * FROM api_keys WHERE key = ?').get(key) as ApiKeyRecord) ?? null;
}

export function findApiKeyByEmail(email: string): ApiKeyRecord | null {
  const d = getDb();
  return (d.prepare('SELECT * FROM api_keys WHERE email = ? AND active = 1').get(email) as ApiKeyRecord) ?? null;
}

export function findUserByApiKey(apiKeyId: string): UserRecord | null {
  const d = getDb();
  const key = d.prepare('SELECT * FROM api_keys WHERE id = ?').get(apiKeyId) as ApiKeyRecord | null;
  if (!key?.user_id) return null;
  return findUserById(key.user_id);
}

export function findUserByStripeSubscription(subscriptionId: string): UserRecord | null {
  const d = getDb();
  return (
    (d
      .prepare('SELECT * FROM users WHERE stripe_subscription_id = ? AND active = 1')
      .get(subscriptionId) as UserRecord) ?? null
  );
}

export function incrementUsage(userId: string): void {
  const d = getDb();
  d.prepare('UPDATE users SET calls_used = calls_used + 1 WHERE id = ?').run(userId);
}

export function updatePlan(userId: string, plan: Plan): void {
  const d = getDb();
  d.prepare('UPDATE users SET plan = ?, calls_limit = ? WHERE id = ?').run(plan, PLAN_LIMITS[plan], userId);
}

export function resetUsage(userId: string): void {
  const d = getDb();
  d.prepare('UPDATE users SET calls_used = 0, period_start = ? WHERE id = ?').run(new Date().toISOString(), userId);
}

export function resetFreeQuotas(): number {
  const d = getDb();
  const result = d
    .prepare('UPDATE users SET calls_used = 0, period_start = ? WHERE plan = ? AND active = 1')
    .run(new Date().toISOString(), 'free');
  return result.changes;
}

export function updateStripeInfo(userId: string, customerId: string, subscriptionId: string): void {
  const d = getDb();
  d.prepare('UPDATE users SET stripe_customer_id = ?, stripe_subscription_id = ? WHERE id = ?').run(
    customerId,
    subscriptionId,
    userId,
  );
}

// ─── Usage Log ───────────────────────────────────────────────

export function logUsage(apiKeyId: string, endpoint: string, renderTimeMs?: number, format?: string): void {
  const d = getDb();
  d.prepare(`
    INSERT INTO usage_log (api_key_id, endpoint, render_time_ms, format, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(apiKeyId, endpoint, renderTimeMs ?? null, format ?? null, new Date().toISOString());
}

export function getUsageStats(apiKeyId: string): {
  total: number;
  byEndpoint: Record<string, number>;
  byFormat: Record<string, number>;
} {
  const d = getDb();

  const total = (
    d.prepare('SELECT COUNT(*) as count FROM usage_log WHERE api_key_id = ?').get(apiKeyId) as { count: number }
  ).count;

  const byEndpoint = d
    .prepare('SELECT endpoint, COUNT(*) as count FROM usage_log WHERE api_key_id = ? GROUP BY endpoint')
    .all(apiKeyId) as { endpoint: string; count: number }[];

  const byFormat = d
    .prepare(
      'SELECT format, COUNT(*) as count FROM usage_log WHERE api_key_id = ? AND format IS NOT NULL GROUP BY format',
    )
    .all(apiKeyId) as { format: string; count: number }[];

  return {
    total,
    byEndpoint: Object.fromEntries(byEndpoint.map((r) => [r.endpoint, r.count])),
    byFormat: Object.fromEntries(byFormat.map((r) => [r.format, r.count])),
  };
}

// ─── Custom Templates ────────────────────────────────────────

export interface CustomTemplateRecord {
  id: string;
  api_key_id: string;
  name: string;
  definition: string; // JSON string
  created_at: string;
  updated_at: string;
}

export function createCustomTemplate(apiKeyId: string, name: string, definition: object): CustomTemplateRecord {
  const d = getDb();
  const now = new Date().toISOString();
  const record: CustomTemplateRecord = {
    id: crypto.randomUUID(),
    api_key_id: apiKeyId,
    name,
    definition: JSON.stringify(definition),
    created_at: now,
    updated_at: now,
  };

  d.prepare(`
    INSERT INTO custom_templates (id, api_key_id, name, definition, created_at, updated_at)
    VALUES ($id, $api_key_id, $name, $definition, $created_at, $updated_at)
  `).run(record);

  return record;
}

export function findCustomTemplate(apiKeyId: string, name: string): CustomTemplateRecord | null {
  const d = getDb();
  return (
    (d
      .prepare('SELECT * FROM custom_templates WHERE api_key_id = ? AND name = ?')
      .get(apiKeyId, name) as CustomTemplateRecord) ?? null
  );
}

export function listCustomTemplates(apiKeyId: string): CustomTemplateRecord[] {
  const d = getDb();
  return d
    .prepare('SELECT * FROM custom_templates WHERE api_key_id = ? ORDER BY created_at DESC')
    .all(apiKeyId) as CustomTemplateRecord[];
}

export function updateCustomTemplate(id: string, definition: object): void {
  const d = getDb();
  d.prepare('UPDATE custom_templates SET definition = ?, updated_at = ? WHERE id = ?').run(
    JSON.stringify(definition),
    new Date().toISOString(),
    id,
  );
}

export function deleteCustomTemplate(id: string): void {
  const d = getDb();
  d.prepare('DELETE FROM custom_templates WHERE id = ?').run(id);
}

// ─── Webhooks ────────────────────────────────────────────────

export interface WebhookRecord {
  id: string;
  api_key_id: string;
  url: string;
  render_config: string; // JSON string
  secret: string;
  active: number;
  created_at: string;
}

export function createWebhook(apiKeyId: string, url: string, renderConfig: object): WebhookRecord {
  const d = getDb();
  const record: WebhookRecord = {
    id: crypto.randomUUID(),
    api_key_id: apiKeyId,
    url,
    render_config: JSON.stringify(renderConfig),
    secret: `whsec_${crypto.randomUUID().replace(/-/g, '')}`,
    active: 1,
    created_at: new Date().toISOString(),
  };

  d.prepare(`
    INSERT INTO webhooks (id, api_key_id, url, render_config, secret, active, created_at)
    VALUES ($id, $api_key_id, $url, $render_config, $secret, $active, $created_at)
  `).run(record);

  return record;
}

export function findWebhookById(id: string): WebhookRecord | null {
  const d = getDb();
  return (d.prepare('SELECT * FROM webhooks WHERE id = ?').get(id) as WebhookRecord) ?? null;
}

export function listWebhooks(apiKeyId: string): WebhookRecord[] {
  const d = getDb();
  return d
    .prepare('SELECT * FROM webhooks WHERE api_key_id = ? AND active = 1 ORDER BY created_at DESC')
    .all(apiKeyId) as WebhookRecord[];
}

export function deleteWebhook(id: string): void {
  const d = getDb();
  d.prepare('UPDATE webhooks SET active = 0 WHERE id = ?').run(id);
}

// ─── Cleanup (for tests) ────────────────────────────────────

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
