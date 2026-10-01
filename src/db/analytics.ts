/**
 * First-party docs-site analytics storage.
 *
 * Lives in its own schema block rather than src/db/index.ts so the funnel
 * tables can be dropped in a single revert if they ever stop earning their
 * keep. Nothing here stores personal data: no IP, no user agent, no email,
 * no query strings. See docs/analysis/ANALYTICS.md.
 */

import { getDb } from './index';
import type { SqliteDatabase } from './sqlite';

/** Minutes of inactivity after which the next page view starts a new session. */
export const SESSION_TIMEOUT_MINUTES = 30;
/** How long raw page-view rows are kept before they are purged. */
export const PAGE_VIEW_RETENTION_DAYS = 180;
/** Window in which a terminal signup is still joined to a browser read on the same network. */
export const NETWORK_ATTRIBUTION_WINDOW_MINUTES = 60;
/** Window in which a browser signup is joined back to that browser's last page read. */
export const VISITOR_ATTRIBUTION_WINDOW_MINUTES = 24 * 60;

/** How confident we are that the signup really came from the recorded page. */
export type AttributionConfidence = 'explicit' | 'visitor' | 'network' | 'none';

export interface PageViewRecord {
  id: string;
  path: string;
  visitor_hash: string;
  network_hash: string;
  session_id: string;
  is_entry: number;
  source: string;
  referrer_host: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  created_at: string;
}

export interface SignupAttributionRecord {
  user_id: string;
  api_key_id: string | null;
  last_page: string | null;
  landing_page: string | null;
  session_id: string | null;
  source: string | null;
  referrer_host: string | null;
  confidence: AttributionConfidence;
  created_at: string;
}

const migrated = new WeakSet<SqliteDatabase>();

/**
 * Idempotent schema creation. Memoised per database handle so reopening the
 * database (tests call closeDb) re-runs it, but a hot request path does not.
 */
export function analyticsDb(): SqliteDatabase {
  const d = getDb();
  if (migrated.has(d)) return d;

  d.exec(`
    CREATE TABLE IF NOT EXISTS analytics_salts (
      day TEXT PRIMARY KEY,
      salt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS page_views (
      id TEXT PRIMARY KEY,
      path TEXT NOT NULL,
      visitor_hash TEXT NOT NULL,
      network_hash TEXT NOT NULL,
      session_id TEXT NOT NULL,
      is_entry INTEGER NOT NULL DEFAULT 0,
      source TEXT NOT NULL,
      referrer_host TEXT,
      utm_source TEXT,
      utm_medium TEXT,
      utm_campaign TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_page_views_created_at ON page_views(created_at);
    CREATE INDEX IF NOT EXISTS idx_page_views_path ON page_views(path);
    CREATE INDEX IF NOT EXISTS idx_page_views_visitor ON page_views(visitor_hash, created_at);
    CREATE INDEX IF NOT EXISTS idx_page_views_network ON page_views(network_hash, created_at);
    CREATE INDEX IF NOT EXISTS idx_page_views_session ON page_views(session_id);

    CREATE TABLE IF NOT EXISTS signup_attribution (
      user_id TEXT PRIMARY KEY,
      api_key_id TEXT,
      last_page TEXT,
      landing_page TEXT,
      session_id TEXT,
      source TEXT,
      referrer_host TEXT,
      confidence TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_signup_attribution_last_page ON signup_attribution(last_page);
    CREATE INDEX IF NOT EXISTS idx_signup_attribution_created_at ON signup_attribution(created_at);
  `);

  migrated.add(d);
  return d;
}

function nowIso(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

// ─── Daily salt ──────────────────────────────────────────────

/** UTC day key, e.g. 2026-10-01. */
export function utcDay(at: Date = new Date()): string {
  return at.toISOString().slice(0, 10);
}

/**
 * Salt for the given UTC day, created on first use. Rotating daily means a
 * visitor hash is only ever comparable within one day, which is what makes
 * the scheme cookieless *and* non-identifying.
 */
export function getDailySalt(day: string = utcDay()): string {
  const d = analyticsDb();
  const existing = d.prepare('SELECT salt FROM analytics_salts WHERE day = ?').get(day) as { salt: string } | undefined;
  if (existing) return existing.salt;

  const salt = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
  d.prepare('INSERT OR IGNORE INTO analytics_salts (day, salt) VALUES (?, ?)').run(day, salt);
  const stored = d.prepare('SELECT salt FROM analytics_salts WHERE day = ?').get(day) as { salt: string } | undefined;
  return stored?.salt ?? salt;
}

// ─── Recording ───────────────────────────────────────────────

export interface RecordPageViewInput {
  path: string;
  visitorHash: string;
  networkHash: string;
  /** Classified source, or null for internal navigation (inherits the session's source). */
  source: string | null;
  referrerHost: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
}

/**
 * Append one page view, stitching it into the visitor's current session when
 * the previous view was recent enough.
 */
export function recordPageView(input: RecordPageViewInput): PageViewRecord {
  const d = analyticsDb();

  const previous = d
    .prepare(
      `SELECT * FROM page_views
       WHERE visitor_hash = ? AND created_at >= datetime('now', ?)
       ORDER BY created_at DESC LIMIT 1`,
    )
    .get(input.visitorHash, `-${SESSION_TIMEOUT_MINUTES} minutes`) as PageViewRecord | undefined;

  const isEntry = previous ? 0 : 1;
  const sessionId = previous?.session_id ?? crypto.randomUUID();

  // Internal navigation keeps the source the session arrived with, so a
  // per-page source breakdown answers "where did the people reading this page
  // come from", not "they clicked a link on our own site".
  const source = input.source ?? previous?.source ?? 'direct';
  const refHost = input.source ? input.referrerHost : (previous?.referrer_host ?? null);

  const row: PageViewRecord = {
    id: crypto.randomUUID(),
    path: input.path,
    visitor_hash: input.visitorHash,
    network_hash: input.networkHash,
    session_id: sessionId,
    is_entry: isEntry,
    source,
    referrer_host: refHost,
    utm_source: input.utmSource ?? previous?.utm_source ?? null,
    utm_medium: input.utmMedium ?? previous?.utm_medium ?? null,
    utm_campaign: input.utmCampaign ?? previous?.utm_campaign ?? null,
    created_at: nowIso(),
  };

  d.prepare(`
    INSERT INTO page_views (id, path, visitor_hash, network_hash, session_id, is_entry, source, referrer_host, utm_source, utm_medium, utm_campaign, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    row.id,
    row.path,
    row.visitor_hash,
    row.network_hash,
    row.session_id,
    row.is_entry,
    row.source,
    row.referrer_host,
    row.utm_source,
    row.utm_medium,
    row.utm_campaign,
    row.created_at,
  );

  return row;
}

// ─── Attribution lookups ─────────────────────────────────────

export function findLastPageViewByVisitor(visitorHash: string, withinMinutes = VISITOR_ATTRIBUTION_WINDOW_MINUTES) {
  const d = analyticsDb();
  return (
    (d
      .prepare(
        `SELECT * FROM page_views
         WHERE visitor_hash = ? AND created_at >= datetime('now', ?)
         ORDER BY created_at DESC LIMIT 1`,
      )
      .get(visitorHash, `-${withinMinutes} minutes`) as PageViewRecord | undefined) ?? null
  );
}

export function findLastPageViewByNetwork(networkHash: string, withinMinutes = NETWORK_ATTRIBUTION_WINDOW_MINUTES) {
  const d = analyticsDb();
  return (
    (d
      .prepare(
        `SELECT * FROM page_views
         WHERE network_hash = ? AND created_at >= datetime('now', ?)
         ORDER BY created_at DESC LIMIT 1`,
      )
      .get(networkHash, `-${withinMinutes} minutes`) as PageViewRecord | undefined) ?? null
  );
}

export function findSessionEntry(sessionId: string): PageViewRecord | null {
  const d = analyticsDb();
  return (
    (d.prepare('SELECT * FROM page_views WHERE session_id = ? ORDER BY created_at ASC LIMIT 1').get(sessionId) as
      | PageViewRecord
      | undefined) ?? null
  );
}

export interface RecordSignupAttributionInput {
  userId: string;
  apiKeyId: string | null;
  lastPage: string | null;
  landingPage: string | null;
  sessionId: string | null;
  source: string | null;
  referrerHost: string | null;
  confidence: AttributionConfidence;
}

/**
 * One row per user. Writing is idempotent: a replayed registration for the
 * same user must not create a second attribution or double-count the funnel.
 */
export function recordSignupAttribution(input: RecordSignupAttributionInput): void {
  const d = analyticsDb();
  d.prepare(`
    INSERT OR IGNORE INTO signup_attribution (user_id, api_key_id, last_page, landing_page, session_id, source, referrer_host, confidence, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    input.userId,
    input.apiKeyId,
    input.lastPage,
    input.landingPage,
    input.sessionId,
    input.source,
    input.referrerHost,
    input.confidence,
    nowIso(),
  );
}

export function findSignupAttribution(userId: string): SignupAttributionRecord | null {
  const d = analyticsDb();
  return (
    (d.prepare('SELECT * FROM signup_attribution WHERE user_id = ?').get(userId) as
      | SignupAttributionRecord
      | undefined) ?? null
  );
}

// ─── Reporting ───────────────────────────────────────────────

export interface PageTrafficRow {
  path: string;
  pageviews: number;
  sessions: number;
  entries: number;
  sources: Record<string, number>;
  topReferrers: { host: string; sessions: number }[];
}

/**
 * Question 1: per-page traffic for a window, with source broken out.
 * `sessions` counts distinct sessions that viewed the page at least once.
 */
export function getPageTraffic(days: number): PageTrafficRow[] {
  const d = analyticsDb();
  const since = `-${days} days`;

  const base = d
    .prepare(
      `SELECT path,
              COUNT(*) AS pageviews,
              COUNT(DISTINCT session_id) AS sessions,
              SUM(is_entry) AS entries
       FROM page_views
       WHERE created_at >= datetime('now', ?)
       GROUP BY path
       ORDER BY sessions DESC, pageviews DESC`,
    )
    .all(since) as { path: string; pageviews: number; sessions: number; entries: number | null }[];

  const bySource = d
    .prepare(
      `SELECT path, source, COUNT(DISTINCT session_id) AS sessions
       FROM page_views
       WHERE created_at >= datetime('now', ?)
       GROUP BY path, source`,
    )
    .all(since) as { path: string; source: string; sessions: number }[];

  const byReferrer = d
    .prepare(
      `SELECT path, referrer_host AS host, COUNT(DISTINCT session_id) AS sessions
       FROM page_views
       WHERE created_at >= datetime('now', ?) AND referrer_host IS NOT NULL
       GROUP BY path, referrer_host
       ORDER BY sessions DESC`,
    )
    .all(since) as { path: string; host: string; sessions: number }[];

  return base.map((row) => ({
    path: row.path,
    pageviews: row.pageviews,
    sessions: row.sessions,
    entries: row.entries ?? 0,
    sources: Object.fromEntries(bySource.filter((s) => s.path === row.path).map((s) => [s.source, s.sessions])),
    topReferrers: byReferrer
      .filter((r) => r.path === row.path)
      .slice(0, 5)
      .map((r) => ({ host: r.host, sessions: r.sessions })),
  }));
}

export interface PageFunnelRow {
  path: string;
  sessions: number;
  signups: number;
  conversionRate: number;
}

/**
 * Question 2: sessions → signups, per page. A signup lands on the page the
 * visitor last read before calling POST /auth/register.
 */
export function getPageFunnel(days: number): PageFunnelRow[] {
  const d = analyticsDb();
  const since = `-${days} days`;

  const sessions = d
    .prepare(
      `SELECT path, COUNT(DISTINCT session_id) AS sessions
       FROM page_views
       WHERE created_at >= datetime('now', ?)
       GROUP BY path`,
    )
    .all(since) as { path: string; sessions: number }[];

  const signups = d
    .prepare(
      `SELECT last_page AS path, COUNT(*) AS signups
       FROM signup_attribution
       WHERE created_at >= datetime('now', ?) AND last_page IS NOT NULL
       GROUP BY last_page`,
    )
    .all(since) as { path: string; signups: number }[];

  const paths = new Set<string>([...sessions.map((s) => s.path), ...signups.map((s) => s.path)]);

  return [...paths]
    .map((path) => {
      const s = sessions.find((r) => r.path === path)?.sessions ?? 0;
      const c = signups.find((r) => r.path === path)?.signups ?? 0;
      return { path, sessions: s, signups: c, conversionRate: s === 0 ? 0 : Number(((c / s) * 100).toFixed(2)) };
    })
    .sort((a, b) => b.signups - a.signups || b.sessions - a.sessions);
}

export interface FunnelTotals {
  pageviews: number;
  sessions: number;
  signups: number;
  attributedSignups: number;
  byConfidence: Record<AttributionConfidence, number>;
  bySource: Record<string, number>;
}

export function getFunnelTotals(days: number): FunnelTotals {
  const d = analyticsDb();
  const since = `-${days} days`;

  const views = d
    .prepare(
      `SELECT COUNT(*) AS pageviews, COUNT(DISTINCT session_id) AS sessions
       FROM page_views WHERE created_at >= datetime('now', ?)`,
    )
    .get(since) as { pageviews: number; sessions: number };

  const confidence = d
    .prepare(
      `SELECT confidence, COUNT(*) AS count
       FROM signup_attribution WHERE created_at >= datetime('now', ?)
       GROUP BY confidence`,
    )
    .all(since) as { confidence: AttributionConfidence; count: number }[];

  const source = d
    .prepare(
      `SELECT COALESCE(source, 'unknown') AS source, COUNT(*) AS count
       FROM signup_attribution WHERE created_at >= datetime('now', ?)
       GROUP BY source`,
    )
    .all(since) as { source: string; count: number }[];

  const byConfidence: Record<AttributionConfidence, number> = { explicit: 0, visitor: 0, network: 0, none: 0 };
  for (const row of confidence) byConfidence[row.confidence] = row.count;

  const signups = confidence.reduce((sum, r) => sum + r.count, 0);

  return {
    pageviews: views.pageviews,
    sessions: views.sessions,
    signups,
    attributedSignups: signups - byConfidence.none,
    byConfidence,
    bySource: Object.fromEntries(source.map((r) => [r.source, r.count])),
  };
}

// ─── Retention ───────────────────────────────────────────────

/** Drop page views past the retention window and salts we can no longer use. */
export function purgeOldAnalytics(retentionDays = PAGE_VIEW_RETENTION_DAYS): { pageViews: number; salts: number } {
  const d = analyticsDb();
  const pageViews = d
    .prepare(`DELETE FROM page_views WHERE created_at < datetime('now', ?)`)
    .run(`-${retentionDays} days`).changes;
  const salts = d.prepare(`DELETE FROM analytics_salts WHERE day < date('now', '-2 days')`).run().changes;
  return { pageViews, salts };
}
