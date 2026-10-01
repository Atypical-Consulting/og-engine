/**
 * Self-serve checkout links — the single source of truth.
 *
 * Two separate problems live here on purpose:
 *
 *  1. **Where the Payment Links are.** Before this module they existed only as
 *     literal hrefs inside `docs/site/src/content/docs/*.mdx`, which meant the
 *     only way to change a checkout target was to rebuild the Docker image.
 *     `buy.stripe.com` now appears in exactly one place in the repo: here.
 *
 *  2. **Who is clicking.** `pricing.mdx` is static Astro markdown rendered at
 *     image build time — there is no user at build time, so a markdown href
 *     can never carry identity. Every marketing CTA therefore points at
 *     `GET /upgrade/:plan` (see `src/api/upgrade.ts`), which runs per request
 *     on the same origin as the docs site and so still has the `oge_session`
 *     cookie in hand. That is the only moment we can attach identity to an
 *     outbound checkout.
 *
 * `client_reference_id` is what the Stripe webhook resolves back to a
 * `users.id` on the return leg; `prefilled_email` just saves the buyer a typed
 * field. Both are plain Payment Link query params — Stripe ignores params it
 * does not recognise, so adding them can never break an anonymous purchase.
 */

/** The plans a visitor can buy without talking to sales. */
export const UPGRADE_PLANS = ['starter', 'pro', 'scale'] as const;

export type UpgradePlan = (typeof UPGRADE_PLANS)[number];

/**
 * Built-in Payment Link per plan, overridable by env (see `PAYMENT_LINK_ENV_KEYS`).
 *
 * `scale` is deliberately `null`: the €99 Payment Link does not exist yet, it
 * arrives with the Scale tier work. A `null` link makes `/upgrade/scale` bounce
 * to the pricing page instead of shipping a dead checkout, and flipping it on
 * later needs a config value — `STRIPE_PAYMENT_LINK_SCALE` — not a code change.
 */
const DEFAULT_PAYMENT_LINKS: Record<UpgradePlan, string | null> = {
  starter: 'https://buy.stripe.com/8x2cN56iE9EU9bQ0F5fAc00',
  pro: 'https://buy.stripe.com/7sY5kDcH26sI73IafFfAc01',
  scale: null,
};

/** Env var that overrides (or, for `scale`, supplies) each plan's Payment Link. */
export const PAYMENT_LINK_ENV_KEYS: Record<UpgradePlan, string> = {
  starter: 'STRIPE_PAYMENT_LINK_STARTER',
  pro: 'STRIPE_PAYMENT_LINK_PRO',
  scale: 'STRIPE_PAYMENT_LINK_SCALE',
};

/** The minimum of a user we need to carry identity into checkout. */
export interface CheckoutIdentity {
  id: string;
  email: string;
}

/** Narrows an arbitrary path segment to a known plan. */
export function isUpgradePlan(value: string): value is UpgradePlan {
  return (UPGRADE_PLANS as readonly string[]).includes(value);
}

/**
 * Returns the Payment Link for a plan, or `null` when none is configured.
 *
 * A malformed override is ignored rather than honoured: redirecting a buyer to
 * a typo'd env value is worse than redirecting them to the built-in link.
 */
export function resolvePaymentLink(plan: UpgradePlan): string | null {
  const envKey = PAYMENT_LINK_ENV_KEYS[plan];
  const override = process.env[envKey]?.trim();

  if (override) {
    if (isUsableCheckoutUrl(override)) return override;
    console.warn(`[checkout] ${envKey} is not a valid http(s) URL (${override}) — ignoring it`);
  }

  return DEFAULT_PAYMENT_LINKS[plan];
}

function isUsableCheckoutUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === 'https:' || protocol === 'http:';
  } catch {
    return false;
  }
}

/**
 * Attaches a signed-in user's identity to a Payment Link.
 *
 * With no user we return the link untouched, byte for byte — anonymous
 * purchase has to keep working exactly as it did, and it still falls back to
 * matching the Stripe customer by email on the webhook side.
 *
 * `URLSearchParams` percent-encodes the value, so `a+tag@example.com` arrives
 * as `a%2Btag%40example.com` — the same shape `encodeURIComponent` produces.
 */
export function buildCheckoutUrl(paymentLink: string, user?: CheckoutIdentity | null): string {
  if (!user) return paymentLink;

  const url = new URL(paymentLink);
  url.searchParams.set('client_reference_id', user.id);
  url.searchParams.set('prefilled_email', user.email);
  return url.toString();
}
