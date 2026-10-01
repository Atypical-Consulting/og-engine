import type { Context } from 'hono';
import { Hono } from 'hono';
import { getFunnelStats, purgeExpiredMagicLinks, purgeExpiredSessions, resetFreeQuotas } from '../db';

export const adminRoute = new Hono();

/**
 * Bearer gate for an admin route, scoped to the credentials that route accepts.
 *
 * Each route names its own env vars so holding one admin token never carries the
 * authority of another: `/admin/stats` is read-only and takes a stats-only token,
 * while `/admin/reset-free-quotas` mutates quotas and purges sessions and takes the
 * cron secret alone.
 *
 * Returns `null` when the caller is authorised, otherwise the response to send.
 */
function requireAdminBearer(c: Context, acceptedEnvVars: string[]): Response | null {
  // An unset or empty-string env var must never authenticate a caller.
  const accepted = acceptedEnvVars.map((name) => process.env[name]).filter((value) => !!value);
  if (accepted.length === 0) {
    return c.json({ error: 'server_error', message: 'Admin cron secret not configured.' }, 500);
  }

  const auth = c.req.header('Authorization');
  const presented = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!presented || !accepted.includes(presented)) {
    return c.json({ error: 'unauthorized', message: 'Invalid admin secret.' }, 401);
  }

  return null;
}

adminRoute.post('/admin/reset-free-quotas', async (c) => {
  // Destructive: resets every free user's quota and logs out every active session.
  // The stats token must not reach this route.
  const denied = requireAdminBearer(c, ['ADMIN_CRON_SECRET']);
  if (denied) return denied;

  const reset = resetFreeQuotas();
  const sessionsPurged = purgeExpiredSessions();
  const magicLinksPurged = purgeExpiredMagicLinks();

  return c.json({
    reset,
    sessionsPurged,
    magicLinksPurged,
    timestamp: new Date().toISOString(),
  });
});

// Read-only funnel counters: signups, activation, plan mix, time to first value.
adminRoute.get('/admin/stats', async (c) => {
  // Accepts the cron secret too, so the existing caller keeps working while
  // ADMIN_STATS_TOKEN is rolled out.
  const denied = requireAdminBearer(c, ['ADMIN_STATS_TOKEN', 'ADMIN_CRON_SECRET']);
  if (denied) return denied;

  return c.json(getFunnelStats());
});
