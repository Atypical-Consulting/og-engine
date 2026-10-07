import type { Plan, UserRecord } from '../db/index';

/**
 * Building a checkout link for an authenticated user.
 *
 * Checkout is started by static Stripe Payment Links, so the only identity that
 * crosses into `checkout.session.completed` is whatever we put on the URL. A
 * bare link means the webhook can only join on the email the buyer typed into
 * Stripe's form — and a developer who signed up as `dev@acme.com` but pays with
 * the company card on `billing@acme.com` then gets a *second* account on the
 * paid plan while the key already deployed in their production stays on `free`.
 *
 * Every authenticated upgrade surface must therefore go through this module.
 * `client_reference_id` comes back verbatim as `session.client_reference_id`,
 * which `src/api/webhooks.ts` prefers over the email join.
 */

/** Plans that can be bought self-serve through a Stripe Payment Link. */
export type PurchasablePlan = Exclude<Plan, 'free'>;

/**
 * Payment Link per purchasable plan. Read from the environment rather than
 * hard-coded so a link can be rotated (or a surface turned off) without a
 * deploy of new code, and so test mode and live mode can differ.
 */
const PAYMENT_LINK_ENV: Record<PurchasablePlan, string> = {
  starter: 'STRIPE_PAYMENT_LINK_STARTER',
  pro: 'STRIPE_PAYMENT_LINK_PRO',
  scale: 'STRIPE_PAYMENT_LINK_SCALE',
};

/**
 * Stripe rejects a `client_reference_id` that is not alphanumeric plus `-`/`_`,
 * or that is longer than 200 characters. Our ids are `crypto.randomUUID()` and
 * always fit; the guard stops a hand-written or migrated id from producing a
 * link Stripe refuses to open — better to lose the attribution than the sale.
 */
const CLIENT_REFERENCE_ID = /^[A-Za-z0-9_-]{1,200}$/;

/** The fields of a user that checkout needs. */
export type CheckoutIdentity = Pick<UserRecord, 'id' | 'email'>;

/**
 * Appends our account identity to a Stripe Payment Link.
 *
 * Throws on a URL that cannot be parsed — callers reading operator-supplied
 * configuration should use {@link checkoutLinkForPlan}, which reports instead.
 */
export function withAccountIdentity(paymentLink: string, user: CheckoutIdentity): string {
  const url = new URL(paymentLink);
  if (CLIENT_REFERENCE_ID.test(user.id)) {
    url.searchParams.set('client_reference_id', user.id);
  }
  url.searchParams.set('prefilled_email', user.email);
  return url.toString();
}

/**
 * The checkout link to show an authenticated user for `plan`, or `null` when no
 * usable Payment Link is configured.
 *
 * `null` is a normal state, not an error: the caller renders no upgrade CTA. An
 * unset env var is how a surface stays off, so it is intentionally quiet; a set
 * but unusable value is logged, because that one is a misconfiguration.
 */
export function checkoutLinkForPlan(plan: PurchasablePlan, user: CheckoutIdentity): string | null {
  const envVar = PAYMENT_LINK_ENV[plan];
  const configured = process.env[envVar];
  if (!configured) return null;

  let link: string;
  try {
    link = withAccountIdentity(configured, user);
  } catch {
    console.error(`[checkout-link] ${envVar} is not a valid URL; no ${plan} checkout link will be shown.`);
    return null;
  }

  // An in-product payment link is a phishing surface if the env var is wrong, so
  // refuse anything that is not plain HTTPS.
  if (!link.startsWith('https://')) {
    console.error(`[checkout-link] ${envVar} is not an https URL; no ${plan} checkout link will be shown.`);
    return null;
  }

  return link;
}
