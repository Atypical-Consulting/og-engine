import type { Context } from 'hono';
import { Hono } from 'hono';
import { getCookie } from '../auth/middleware';
import { findSessionByToken, findUserById } from '../db/index';
import { buildCheckoutUrl, type CheckoutIdentity, isUpgradePlan, resolvePaymentLink } from '../utils/checkout-link';

export const upgradeRoute = new Hono();

/** Where every unbuyable `/upgrade/...` lands. Trailing slash matches the Astro build. */
const PRICING_PAGE = '/pricing/';

/**
 * `GET /upgrade/:plan` — the one identity-carrying hop in front of Stripe.
 *
 * Every purchase CTA on the marketing site and in the dashboard points here
 * instead of at `buy.stripe.com` directly. The docs site and this API are the
 * same origin in the same Fly app, so a logged-in visitor reading `/pricing/`
 * is already sending us `oge_session` — this route is what stops us throwing
 * that away at the exact moment they click Buy.
 *
 * Deliberate choices:
 *  - **302, not 301.** Payment Links change; a cached permanent redirect to a
 *    retired link would be unfixable from our side.
 *  - **No session required.** Anonymous checkout keeps working untouched.
 *    Forcing login first would add a step to the one funnel step that converts.
 *  - **Never 500 and never 404.** These URLs end up in published content, so an
 *    unknown plan or a plan with no Payment Link yet bounces to `/pricing/`.
 */
upgradeRoute.get('/upgrade/:plan', (c) => {
  const plan = c.req.param('plan').toLowerCase();
  if (!isUpgradePlan(plan)) return c.redirect(PRICING_PAGE, 302);

  const paymentLink = resolvePaymentLink(plan);
  if (!paymentLink) return c.redirect(PRICING_PAGE, 302);

  return c.redirect(buildCheckoutUrl(paymentLink, resolveOptionalUser(c)), 302);
});

/**
 * Resolves `oge_session` to a user, or `null` for an anonymous visitor.
 *
 * Unlike `sessionMiddleware` this never redirects to login — a missing or
 * expired session is the normal case here, not an error. It also swallows
 * lookup failures on purpose: a sick database must degrade this route to
 * anonymous checkout, not break the purchase.
 */
function resolveOptionalUser(c: Context): CheckoutIdentity | null {
  const token = getCookie(c, 'oge_session');
  if (!token) return null;

  try {
    const session = findSessionByToken(token);
    if (!session) return null;
    return findUserById(session.user_id);
  } catch (err) {
    console.warn('[upgrade] session lookup failed — continuing as anonymous', err);
    return null;
  }
}
