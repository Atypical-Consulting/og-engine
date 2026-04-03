import type { Context, Next } from 'hono';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.resetAt <= now) store.delete(key);
  }
}, 60_000);

export interface RateLimitOptions {
  windowMs: number;
  max: number;
}

export function rateLimit(opts?: Partial<RateLimitOptions>) {
  const windowMs = opts?.windowMs ?? Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000);
  const max = opts?.max ?? Number(process.env.RATE_LIMIT_MAX ?? 100);

  return async (c: Context, next: Next) => {
    const ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? c.req.header('x-real-ip') ?? 'unknown';

    const now = Date.now();
    let entry = store.get(ip);

    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      store.set(ip, entry);
    }

    entry.count++;

    c.header('X-RateLimit-Limit', String(max));
    c.header('X-RateLimit-Remaining', String(Math.max(0, max - entry.count)));
    c.header('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));

    if (entry.count > max) {
      return c.json(
        {
          error: 'rate_limit_exceeded',
          message: `Too many requests. Limit: ${max} per ${windowMs / 1000}s.`,
          retryAfterMs: entry.resetAt - now,
          docs: 'https://og-engine.com/api-reference/errors#rate_limit_exceeded',
        },
        429,
      );
    }

    await next();
  };
}
