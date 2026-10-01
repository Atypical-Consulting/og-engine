import type { Plan } from '../db';

/**
 * The single place that knows how a Stripe Price id becomes an entitlement.
 *
 * The charging side of the money path lives in the Stripe dashboard (Payment
 * Links) and the provisioning side lives in the `STRIPE_PRICE_*` env vars on
 * Fly. Nothing links them. Either can change without the other, and until
 * ATY-40 the only symptom was a charged card and no account.
 *
 * So this module exists to make the mapping inspectable: at boot
 * (`reportStripePriceConfig`), on an inbound webhook (`getPlanFromPriceId`),
 * and against Stripe itself (`GET /admin/stripe-price-check`).
 */

/** Paid tiers, in price order. `free` is never sold, so it has no Price id. */
export const PAID_PLANS = ['starter', 'pro', 'scale'] as const;

export type PaidPlan = (typeof PAID_PLANS)[number];

/**
 * What each tier is actually sold for, per docs/analysis/DECISIONS.md.
 * The admin diagnostic asserts Stripe agrees; a Price that resolves but costs
 * the wrong amount is a worse bug than one that does not resolve at all.
 */
export const PAID_PLAN_SPECS: Record<PaidPlan, { envVar: string; unitAmount: number; currency: string }> = {
  starter: { envVar: 'STRIPE_PRICE_STARTER', unitAmount: 1000, currency: 'eur' },
  pro: { envVar: 'STRIPE_PRICE_PRO', unitAmount: 3900, currency: 'eur' },
  scale: { envVar: 'STRIPE_PRICE_SCALE', unitAmount: 9900, currency: 'eur' },
};

/** The configured Price id for a tier, or null when the env var is unset/blank. */
export function configuredPriceId(plan: PaidPlan): string | null {
  const raw = process.env[PAID_PLAN_SPECS[plan].envVar]?.trim();
  return raw ? raw : null;
}

/**
 * Maps a Stripe Price id to the plan it entitles, or null when it is not one
 * of ours.
 *
 * Note the empty-string guard. Building the lookup table directly from the env
 * vars used to insert a `''` key for every unset var, so an event that somehow
 * carried an empty price id matched whichever tier was declared last —
 * and, worse, an unset var was indistinguishable from a wrong one.
 */
export function getPlanFromPriceId(priceId: string): Plan | null {
  if (!priceId) return null;
  for (const plan of PAID_PLANS) {
    if (configuredPriceId(plan) === priceId) return plan;
  }
  return null;
}

/** Env var names for tiers whose Price id is unset or blank. */
export function missingPriceEnvVars(): string[] {
  return PAID_PLANS.filter((plan) => configuredPriceId(plan) === null).map((plan) => PAID_PLAN_SPECS[plan].envVar);
}

/**
 * Logs a loud startup error when the money path cannot provision anybody.
 *
 * Deliberately an error log and not a hard exit, for the same reason
 * `warnIfBaseUrlUnset` is a warning: refusing to boot would turn a billing
 * misconfiguration into a total outage of the render API, which is what the
 * paying customers who *did* get provisioned are using. The failure is instead
 * made loud in three places that are cheap to check — this log, the Stripe
 * dashboard (unmapped checkouts now fail their delivery), and
 * `GET /admin/stripe-price-check`.
 *
 * Returns the missing env var names so callers can assert on them.
 */
export function reportStripePriceConfig(): string[] {
  const missing = missingPriceEnvVars();
  if (missing.length > 0) {
    console.error(
      `[billing] ${missing.join(', ')} ${missing.length === 1 ? 'is' : 'are'} not set — ` +
        `checkouts for ${missing.length === PAID_PLANS.length ? 'every paid tier' : 'the affected tier(s)'} ` +
        `cannot be provisioned and their Stripe webhook deliveries will fail. ` +
        `Set them: ${missing.map((v) => `fly secrets set ${v}=price_...`).join(' && ')}`,
    );
  }
  if (!process.env.EMAIL_FROM?.trim()) {
    console.warn(
      '[billing] EMAIL_FROM is not set — welcome emails will be sent from the shared Resend sandbox ' +
        'sender (delivered@resend.dev), which is not deliverable to real customers. ' +
        'Set it: fly secrets set EMAIL_FROM="OG Engine <hello@og-engine.com>"',
    );
  }
  return missing;
}
