import { Hono } from 'hono';
import { type ApiKeyRecord, getUsageStats, type UserRecord } from '../db';

export const usageRoute = new Hono();

usageRoute.get('/usage', async (c) => {
  const record = c.get('apiKey' as never) as ApiKeyRecord | undefined;
  const user = c.get('user' as never) as UserRecord | undefined;

  if (!record) {
    return c.json(
      {
        error: 'unauthorized',
        message: 'API key required to view usage.',
        docs: 'https://og-engine.com/api-reference/errors#unauthorized',
      },
      401,
    );
  }

  const stats = getUsageStats(record.id);

  return c.json({
    plan: user?.plan ?? 'free',
    quota: {
      limit: user?.calls_limit ?? 500,
      used: user?.calls_used ?? 0,
      remaining: Math.max(0, (user?.calls_limit ?? 500) - (user?.calls_used ?? 0)),
      periodStart: user?.period_start ?? null,
    },
    usage: stats,
  });
});
