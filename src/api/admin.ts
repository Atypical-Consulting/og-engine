import { Hono } from 'hono';
import { resetFreeQuotas } from '../db';

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

  const count = resetFreeQuotas();

  return c.json({
    reset: count,
    timestamp: new Date().toISOString(),
  });
});
