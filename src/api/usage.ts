import { Hono } from 'hono';
import { type ApiKeyRecord, getUsageStats } from '../db';

export const usageRoute = new Hono();

usageRoute.get('/usage', async (c) => {
  const record = c.get('apiKey' as never) as ApiKeyRecord | undefined;

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
    plan: record.plan,
    quota: {
      limit: record.calls_limit,
      used: record.calls_used,
      remaining: Math.max(0, record.calls_limit - record.calls_used),
      periodStart: record.period_start,
    },
    usage: stats,
  });
});
