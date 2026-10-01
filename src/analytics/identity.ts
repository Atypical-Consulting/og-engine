/**
 * First-party, cookieless visitor identity and traffic-source classification.
 *
 * Design constraints (see docs/analysis/ANALYTICS.md):
 *  - No cookie, no localStorage, no third-party script, no consent banner.
 *  - No raw IP and no user-agent string is ever persisted. We store only
 *    HMAC-style hashes salted with a secret that rotates every UTC day, so
 *    yesterday's hashes cannot be re-derived or joined to today's.
 *  - Identity is deliberately short-lived: it exists to join a page read to a
 *    signup minutes later, not to build a profile.
 */

import { createHash } from 'node:crypto';
import type { Context } from 'hono';

/** How a visit arrived. Stable event-schema values — do not rename. */
export type TrafficSource = 'direct' | 'organic_search' | 'ai_assistant' | 'social' | 'referral' | 'campaign';

export interface VisitorIdentity {
  /** Daily-salted hash of IP + user agent. Identifies one browser for one day. */
  visitorHash: string;
  /** Daily-salted hash of IP only. Coarser — joins a browser read to a terminal curl. */
  networkHash: string;
}

const SEARCH_HOSTS = [
  'google.',
  'bing.',
  'duckduckgo.',
  'yahoo.',
  'ecosia.',
  'search.brave.com',
  'yandex.',
  'baidu.',
  'startpage.com',
  'kagi.com',
  'qwant.com',
  'mojeek.com',
];

const AI_HOSTS = [
  'chatgpt.com',
  'chat.openai.com',
  'perplexity.ai',
  'claude.ai',
  'copilot.microsoft.com',
  'gemini.google.com',
];

const SOCIAL_HOSTS = [
  'x.com',
  'twitter.com',
  't.co',
  'reddit.com',
  'news.ycombinator.com',
  'lobste.rs',
  'linkedin.com',
  'lnkd.in',
  'facebook.com',
  'bsky.app',
  'mastodon.social',
  'hachyderm.io',
  'fosstodon.org',
  'dev.to',
];

/**
 * Requests we never count: automated clients, prefetches and speculative loads.
 * An uncounted bot hit is strictly better than a page that looks popular.
 */
const BOT_UA =
  /bot|crawler|spider|crawling|slurp|bingpreview|facebookexternalhit|headlesschrome|lighthouse|pingdom|uptime|monitor|curl\/|wget|python-requests|go-http-client|axios\/|node-fetch|okhttp|java\/|libwww|scrapy|semrush|ahrefs|dotbot|petalbot|gptbot|claudebot|ccbot/i;

export function isAutomatedClient(userAgent: string | undefined): boolean {
  if (!userAgent || userAgent.trim() === '') return true;
  return BOT_UA.test(userAgent);
}

export function isPrefetch(c: Context): boolean {
  const secPurpose = c.req.header('Sec-Purpose') ?? c.req.header('Purpose') ?? '';
  if (secPurpose.toLowerCase().includes('prefetch')) return true;
  return (c.req.header('X-Moz') ?? '').toLowerCase() === 'prefetch';
}

/**
 * Best-effort client IP. Fly.io terminates TLS at the edge and sets
 * Fly-Client-IP; the X-Forwarded-For fallback keeps this working behind any
 * other proxy and in local development.
 */
export function clientIp(c: Context): string {
  const direct = c.req.header('Fly-Client-IP') ?? c.req.header('CF-Connecting-IP');
  if (direct) return direct.trim();
  const forwarded = c.req.header('X-Forwarded-For');
  if (forwarded) return (forwarded.split(',')[0] ?? '').trim();
  return (c.req.header('X-Real-IP') ?? 'unknown').trim();
}

function hash(salt: string, value: string): string {
  return createHash('sha256').update(`${salt}:${value}`).digest('hex').slice(0, 32);
}

/**
 * Derive the two hashed identifiers for a request. `salt` must be the salt for
 * the current UTC day (see getDailySalt in src/db/analytics.ts) so that the
 * same visitor hashes identically across the requests of one day.
 */
export function identifyVisitor(c: Context, salt: string): VisitorIdentity {
  const ip = clientIp(c);
  const ua = c.req.header('User-Agent') ?? '';
  return {
    visitorHash: hash(salt, `v|${ip}|${ua}`),
    networkHash: hash(salt, `n|${ip}`),
  };
}

/** Host of the referring page, lowercased, with no path or query. */
export function referrerHost(referrer: string | undefined): string | null {
  if (!referrer) return null;
  try {
    const host = new URL(referrer).hostname.toLowerCase();
    return host === '' ? null : host.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function matches(host: string, needles: string[]): boolean {
  return needles.some((n) =>
    n.endsWith('.') ? host.startsWith(n) || host.includes(`.${n}`) : host === n || host.endsWith(`.${n}`),
  );
}

export interface SourceInput {
  referrerHost: string | null;
  utmSource: string | null;
  /** Host serving og-engine.com, so internal navigation is not read as a referral. */
  selfHost: string | null;
}

/**
 * Classify where a visit came from. Returns `null` for internal navigation —
 * the caller should inherit the source already recorded for the session.
 */
export function classifySource(input: SourceInput): TrafficSource | null {
  if (input.utmSource) return 'campaign';
  const host = input.referrerHost;
  if (!host) return 'direct';
  if (input.selfHost && (host === input.selfHost || host.endsWith(`.${input.selfHost}`))) return null;
  if (matches(host, SEARCH_HOSTS)) return 'organic_search';
  if (matches(host, AI_HOSTS)) return 'ai_assistant';
  if (matches(host, SOCIAL_HOSTS)) return 'social';
  return 'referral';
}

/**
 * Strip query and fragment, cap length, and settle on one spelling per page.
 * Query strings can carry PII, and `/pricing` vs `/pricing/` reaching the same
 * Starlight page must not split into two rows in the report.
 */
export function normalisePath(rawPath: string): string {
  let path = (rawPath.split('?')[0]?.split('#')[0] ?? '/').slice(0, 512);
  if (path === '') path = '/';
  // Directory-style routes get a trailing slash; real files (index.html,
  // llms.txt, sitemap.xml) keep theirs off.
  const last = path.split('/').pop() ?? '';
  if (path !== '/' && !path.endsWith('/') && !last.includes('.')) path = `${path}/`;
  return path;
}

/**
 * A `src` value supplied by the docs site or a documented curl snippet. Only a
 * conservative slug shape is accepted so an attacker cannot stuff arbitrary
 * text (or PII) into the analytics tables through the public register route.
 */
export function sanitiseSrc(raw: string | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().slice(0, 128);
  if (trimmed === '/') return '/';
  if (!/^\/?[a-zA-Z0-9][a-zA-Z0-9/_.-]*\/?$/.test(trimmed)) return null;
  // Canonicalised the same way as a recorded page view, so the funnel join
  // lines up whether the value came from the form or a pasted curl snippet.
  return normalisePath(trimmed.startsWith('/') ? trimmed : `/${trimmed}`);
}
