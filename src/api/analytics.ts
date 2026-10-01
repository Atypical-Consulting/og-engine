/**
 * Read-only funnel reporting for the docs site.
 *
 * Protected with the same ADMIN_CRON_SECRET bearer token as the other /admin
 * routes — no new secret, no new dependency, no new recurring cost. Output is
 * aggregate only: these endpoints never return a visitor hash, an email or a
 * single user's row.
 */

import type { Context } from 'hono';
import { Hono } from 'hono';
import {
  getFunnelTotals,
  getPageFunnel,
  getPageTraffic,
  NETWORK_ATTRIBUTION_WINDOW_MINUTES,
  SESSION_TIMEOUT_MINUTES,
} from '../db/analytics';

export const analyticsRoute = new Hono();

const MAX_WINDOW_DAYS = 365;

/** Returns a 401/500 Response when the caller is not the admin, else null. */
function denyUnlessAdmin(c: Context): Response | null {
  const cronSecret = process.env.ADMIN_CRON_SECRET;
  if (!cronSecret) {
    return c.json({ error: 'server_error', message: 'Admin cron secret not configured.' }, 500);
  }
  const auth = c.req.header('Authorization');
  if (!auth?.startsWith('Bearer ') || auth.slice(7) !== cronSecret) {
    return c.json({ error: 'unauthorized', message: 'Invalid admin secret.' }, 401);
  }
  return null;
}

function windowDays(c: Context): number {
  const raw = Number(c.req.query('days') ?? 30);
  if (!Number.isFinite(raw) || raw < 1) return 30;
  return Math.min(Math.floor(raw), MAX_WINDOW_DAYS);
}

function windowMeta(days: number) {
  const to = new Date();
  const from = new Date(to.getTime() - days * 86_400_000);
  return { days, from: from.toISOString(), to: to.toISOString() };
}

/** Question 1 — per-page traffic with source/referrer broken out. */
analyticsRoute.get('/admin/analytics/pages', (c) => {
  const denied = denyUnlessAdmin(c);
  if (denied) return denied;

  const days = windowDays(c);
  const rows = getPageTraffic(days);

  return c.json({
    window: windowMeta(days),
    sessionTimeoutMinutes: SESSION_TIMEOUT_MINUTES,
    pages: rows.length,
    rows,
  });
});

/** Question 2 — sessions → signups per page, plus attribution confidence. */
analyticsRoute.get('/admin/analytics/funnel', (c) => {
  const denied = denyUnlessAdmin(c);
  if (denied) return denied;

  const days = windowDays(c);

  return c.json({
    window: windowMeta(days),
    networkAttributionWindowMinutes: NETWORK_ATTRIBUTION_WINDOW_MINUTES,
    totals: getFunnelTotals(days),
    rows: getPageFunnel(days),
  });
});
