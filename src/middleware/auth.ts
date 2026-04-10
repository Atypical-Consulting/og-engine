import type { Context, Next } from 'hono';
import {
  type ApiKeyRecord,
  findApiKeyByKey,
  findUserById,
  incrementUsage,
  logUsage,
  type Plan,
  type UserRecord,
} from '../db';

// Plan feature access per DECISIONS.md
const FEATURE_GATES: Record<string, Plan[]> = {
  webp: ['starter', 'pro', 'scale'],
  batch: ['pro', 'scale'],
  cdn: ['pro', 'scale'],
  custom_templates: ['scale'],
};

export function canAccessFeature(plan: Plan, feature: string): boolean {
  const allowed = FEATURE_GATES[feature];
  if (!allowed) return true; // no gate = everyone
  return allowed.includes(plan);
}

/**
 * Required auth middleware — rejects unauthenticated requests.
 * Checks user-level quota and increments usage.
 */
export function authMiddleware() {
  return async (c: Context, next: Next) => {
    const auth = c.req.header('Authorization');
    if (!auth?.startsWith('Bearer ')) {
      return c.json(
        {
          error: 'unauthorized',
          message: 'Missing or malformed API key. Use: Authorization: Bearer oge_sk_...',
          docs: 'https://og-engine.com/api-reference/errors#unauthorized',
        },
        401,
      );
    }

    const key = auth.slice(7);
    const record = findApiKeyByKey(key);

    if (!record?.active) {
      return c.json(
        {
          error: 'unauthorized',
          message: 'Invalid or deactivated API key.',
          docs: 'https://og-engine.com/api-reference/errors#unauthorized',
        },
        401,
      );
    }

    const user = record.user_id ? findUserById(record.user_id) : null;

    if (user && user.calls_used >= user.calls_limit) {
      return c.json(
        {
          error: 'quota_exceeded',
          message: 'Monthly render quota exceeded. Upgrade your plan or wait for reset.',
          details: {
            limit: user.calls_limit,
            used: user.calls_used,
            plan: user.plan,
            periodStart: user.period_start,
            upgradeUrl: 'https://og-engine.com/pricing',
          },
          docs: 'https://og-engine.com/api-reference/errors#quota_exceeded',
        },
        429,
      );
    }

    c.set('apiKey', record);
    if (user) c.set('user', user);
    await next();
  };
}

/**
 * Optional auth middleware — validates key if present, but allows unauthenticated.
 * Per DECISIONS.md Decision 3: /validate accepts auth optionally, never metered.
 */
export function optionalAuthMiddleware() {
  return async (c: Context, next: Next) => {
    const auth = c.req.header('Authorization');
    if (auth?.startsWith('Bearer ')) {
      const key = auth.slice(7);
      const record = findApiKeyByKey(key);
      if (record?.active) {
        c.set('apiKey', record);
        const user = record.user_id ? findUserById(record.user_id) : null;
        if (user) c.set('user', user);
      } else if (record) {
        return c.json(
          {
            error: 'unauthorized',
            message: 'Invalid or deactivated API key.',
            docs: 'https://og-engine.com/api-reference/errors#unauthorized',
          },
          401,
        );
      }
      // If key not found, proceed without auth (per Decision 3)
    }
    await next();
  };
}

/**
 * Plan gate middleware — returns 402 if the user's plan doesn't include a feature.
 * Per DECISIONS.md Decision 8: use 402 Payment Required.
 */
export function planGate(feature: string) {
  return async (c: Context, next: Next) => {
    const user = c.get('user' as never) as UserRecord | undefined;
    if (user && !canAccessFeature(user.plan as Plan, feature)) {
      return c.json(
        {
          error: 'plan_required',
          message: `This feature requires a higher plan. Your plan: ${user.plan}.`,
          details: {
            feature,
            currentPlan: user.plan,
            requiredPlans: FEATURE_GATES[feature],
            upgradeUrl: 'https://og-engine.com/pricing',
          },
          docs: 'https://og-engine.com/api-reference/errors#plan_required',
        },
        402,
      );
    }
    await next();
  };
}

/**
 * Usage tracking middleware — increments counter and logs usage after response.
 * Applied AFTER auth, only on metered endpoints (/render, /render/batch).
 */
export function usageTracking(endpoint: string) {
  return async (c: Context, next: Next) => {
    const record = c.get('apiKey' as never) as ApiKeyRecord | undefined;
    const user = c.get('user' as never) as UserRecord | undefined;

    await next();

    // Only track on successful responses
    if (record && c.res.status >= 200 && c.res.status < 300) {
      if (user) {
        incrementUsage(user.id);
      }
      const renderTimeMs = c.res.headers.get('X-Render-Time-Ms');
      logUsage(record.id, endpoint, renderTimeMs ? parseFloat(renderTimeMs) : undefined);
    }
  };
}
