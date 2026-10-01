import { type Context, Hono } from 'hono';
import Stripe from 'stripe';
import { configuredPriceId, PAID_PLAN_SPECS, PAID_PLANS } from '../billing/prices';
import { getFunnelStats, purgeExpiredMagicLinks, purgeExpiredSessions, resetFreeQuotas } from '../db';

export const adminRoute = new Hono();

/**
 * Shared bearer check for the admin endpoints. Returns a response to send when
 * the caller is not authorised, or null when they are.
 */
function rejectUnlessAdmin(c: Context) {
  const cronSecret = process.env.ADMIN_CRON_SECRET;
  if (!cronSecret) {
    return c.json({ error: 'server_error', message: 'Admin cron secret not configured.' }, 500);
  }

  const auth = c.req.header('Authorization');
  if (!auth?.startsWith('Bearer ') || auth.slice(7) !== cronSecret) {
    return c.json({ error: 'unauthorized', message: 'Invalid admin secret.' }, 401);
  }

  return null;
}

adminRoute.post('/admin/reset-free-quotas', async (c) => {
  const denied = rejectUnlessAdmin(c);
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
  const denied = rejectUnlessAdmin(c);
  if (denied) return denied;

  return c.json(getFunnelStats());
});

type PriceCheck = {
  plan: string;
  envVar: string;
  /** The configured id. A Stripe Price id is not a secret — printing it is the point. */
  priceId: string | null;
  status: 'ok' | 'not_configured' | 'not_found' | 'mismatch' | 'error';
  problems: string[];
  stripe: { active: boolean; recurring: boolean; unitAmount: number | null; currency: string | null } | null;
};

/**
 * Resolves each configured `STRIPE_PRICE_*` against Stripe and reports whether
 * it is a real, active, recurring Price at the amount the tier is sold for.
 *
 * This is the check nobody could run during the ATY-29 audit without handing
 * out a credential. It needs only the live secret key already on the box, and
 * it discloses no secret: the response contains Price ids and amounts, never
 * the key. It covers Scale, which has no Payment Link and therefore cannot be
 * verified from the pricing page at all.
 */
adminRoute.get('/admin/stripe-price-check', async (c) => {
  const denied = rejectUnlessAdmin(c);
  if (denied) return denied;

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    return c.json({ error: 'server_error', message: 'Stripe is not configured.' }, 500);
  }
  const stripe = new Stripe(stripeSecretKey);

  const checks: PriceCheck[] = [];
  for (const plan of PAID_PLANS) {
    const spec = PAID_PLAN_SPECS[plan];
    const priceId = configuredPriceId(plan);

    if (!priceId) {
      checks.push({
        plan,
        envVar: spec.envVar,
        priceId: null,
        status: 'not_configured',
        problems: [`${spec.envVar} is not set, so no checkout for this tier can ever be provisioned.`],
        stripe: null,
      });
      continue;
    }

    try {
      const price = await stripe.prices.retrieve(priceId);
      const problems: string[] = [];
      if (!price.active) problems.push('Price is archived in Stripe.');
      if (price.type !== 'recurring') problems.push(`Price is ${price.type}, not recurring.`);
      if (price.unit_amount !== spec.unitAmount) {
        problems.push(`Price is ${price.unit_amount} minor units, expected ${spec.unitAmount}.`);
      }
      if (price.currency !== spec.currency) {
        problems.push(`Price is in ${price.currency}, expected ${spec.currency}.`);
      }

      checks.push({
        plan,
        envVar: spec.envVar,
        priceId,
        status: problems.length === 0 ? 'ok' : 'mismatch',
        problems,
        stripe: {
          active: price.active,
          recurring: price.type === 'recurring',
          unitAmount: price.unit_amount,
          currency: price.currency,
        },
      });
    } catch (err) {
      // Stripe returns 404 `resource_missing` for an id that does not exist on
      // this account — the drift we are actually hunting. Anything else (auth,
      // network) is reported separately so a bad key is not read as bad config.
      //
      // Only the error's type/code is echoed, never its message: Stripe's
      // authentication error quotes the key back (partially masked, but the
      // last four characters are real) and this response does not need it.
      const stripeErr = err instanceof Stripe.errors.StripeError ? err : null;
      const missing = stripeErr?.code === 'resource_missing';
      checks.push({
        plan,
        envVar: spec.envVar,
        priceId,
        status: missing ? 'not_found' : 'error',
        problems: [
          missing
            ? 'Stripe has no Price with this id on this account.'
            : `Could not resolve this Price (${stripeErr ? (stripeErr.code ?? stripeErr.type) : 'request failed'}).`,
        ],
        stripe: null,
      });
    }
  }

  const ok = checks.every((check) => check.status === 'ok');
  return c.json(
    {
      ok,
      checks,
      timestamp: new Date().toISOString(),
    },
    ok ? 200 : 503,
  );
});
