import { Hono } from 'hono';
import { getFunnelStats, purgeExpiredMagicLinks, purgeExpiredSessions, resetFreeQuotas } from '../db';

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

// Read-only funnel counters: signups, activation, plan mix, time to first value,
// plus the plan x output-format breakdown and its attribution cross-check.
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
