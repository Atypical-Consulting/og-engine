import { Hono } from 'hono';
import { type ApiKeyRecord, getUsageStats, type UserRecord } from '../db';

export const usageRoute = new Hono();

usageRoute.get('/usage', async (c) => {
  const record = c.get('apiKey' as never) as ApiKeyRecord | undefined;
  const user = c.get('user' as never) as UserRecord | undefined;

  if (!record || !user) {
    return c.json(
      {
        error: 'unauthorized',
        message: 'API key required to view usage.',
        docs: 'https://og-engine.com/api-reference/errors#unauthorized',
      },
      401,
    );
  }

  const stats = getUsageStats(user.id);

  return c.json({
    plan: user.plan,
    quota: {
      limit: user.calls_limit,
      used: user.calls_used,
      remaining: Math.max(0, user.calls_limit - user.calls_used),
      periodStart: user.period_start,
    },
    usage: stats,
  });
});
