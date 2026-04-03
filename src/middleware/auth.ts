import type { Context, Next } from 'hono';
import { type ApiKeyRecord, findApiKeyByKey, incrementUsage, logUsage, type Plan } from '../db';

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
 * Checks quota and increments usage.
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

    if (record.calls_used >= record.calls_limit) {
      return c.json(
        {
          error: 'quota_exceeded',
          message: 'Monthly render quota exceeded. Upgrade your plan or wait for reset.',
          details: {
            limit: record.calls_limit,
            used: record.calls_used,
            plan: record.plan,
            periodStart: record.period_start,
            upgradeUrl: 'https://og-engine.com/pricing',
          },
          docs: 'https://og-engine.com/api-reference/errors#quota_exceeded',
        },
        429,
      );
    }

    c.set('apiKey', record);
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
    const record = c.get('apiKey' as never) as ApiKeyRecord | undefined;
    if (record && !canAccessFeature(record.plan as Plan, feature)) {
      return c.json(
        {
          error: 'plan_required',
          message: `This feature requires a higher plan. Your plan: ${record.plan}.`,
          details: {
            feature,
            currentPlan: record.plan,
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

    await next();

    // Only track on successful responses
    if (record && c.res.status >= 200 && c.res.status < 300) {
      incrementUsage(record.id);
      const renderTimeMs = c.res.headers.get('X-Render-Time-Ms');
      logUsage(record.id, endpoint, renderTimeMs ? parseFloat(renderTimeMs) : undefined);
    }
  };
}
