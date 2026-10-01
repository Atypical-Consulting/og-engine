import { Hono } from 'hono';
import {
  countErrors,
  ERROR_LOG_MAX_ROWS,
  getFunnelStats,
  listErrors,
  purgeExpiredMagicLinks,
  purgeExpiredSessions,
  resetFreeQuotas,
} from '../db';

export const adminRoute = new Hono();

adminRoute.post('/admin/reset-free-quotas', async (c) => {
  const cronSecret = process.env.ADMIN_CRON_SECRET;
  if (!cronSecret) {
    return c.json({ error: 'server_error', message: 'Admin cron secret not configured.' }, 500);
  }

  const auth = c.req.header('Authorization');
  if (!auth?.startsWith('Bearer ') || auth.slice(7) !== cronSecret) {
    return c.json({ error: 'unauthorized', message: 'Invalid admin secret.' }, 401);
  }

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
  const cronSecret = process.env.ADMIN_CRON_SECRET;
  if (!cronSecret) {
    return c.json({ error: 'server_error', message: 'Admin cron secret not configured.' }, 500);
  }

  const auth = c.req.header('Authorization');
  if (!auth?.startsWith('Bearer ') || auth.slice(7) !== cronSecret) {
    return c.json({ error: 'unauthorized', message: 'Invalid admin secret.' }, 401);
  }

  return c.json(getFunnelStats());
});

// Read-only tail of unhandled exceptions (ATY-128).
//
// Authed by ERROR_LOG_TOKEN rather than ADMIN_CRON_SECRET on purpose: the point
// of this endpoint is to be reachable while ADMIN_CRON_SECRET is still
// unresolved (ATY-90 / ATY-15), and the blast radius of the two tokens differs.
adminRoute.get('/admin/errors', async (c) => {
  const errorLogToken = process.env.ERROR_LOG_TOKEN;
  if (!errorLogToken) {
    return c.json({ error: 'server_error', message: 'Error log token not configured.' }, 500);
  }

  const auth = c.req.header('Authorization');
  if (!auth?.startsWith('Bearer ') || auth.slice(7) !== errorLogToken) {
    return c.json({ error: 'unauthorized', message: 'Invalid error log token.' }, 401);
  }

  const requested = Number(c.req.query('limit') ?? 20);
  const limit = Number.isFinite(requested) ? Math.min(Math.max(Math.trunc(requested), 1), ERROR_LOG_MAX_ROWS) : 20;

  return c.json({
    limit,
    stored: countErrors(),
    max_stored: ERROR_LOG_MAX_ROWS,
    errors: listErrors(limit),
    generated_at: new Date().toISOString(),
  });
});
