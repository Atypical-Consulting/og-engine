import { PLAN_LIMITS, type Plan, type UserRecord } from '../../db/index';
import { checkoutLinkForPlan, type PurchasablePlan } from '../../utils/checkout-link';
import { escapeHtml } from '../../utils/html';

/** Cheapest first, so the cards read as a ladder. */
const PURCHASABLE_PLANS: readonly PurchasablePlan[] = ['starter', 'pro', 'scale'];

const PLAN_PRICES: Record<Plan, string> = {
  free: 'Free',
  starter: '\u20AC10/mo',
  pro: '\u20AC39/mo',
  scale: '\u20AC99/mo',
};

const PLAN_NAMES: Record<Plan, string> = {
  free: 'Free',
  starter: 'Starter',
  pro: 'Pro',
  scale: 'Scale',
};

function usagePercent(user: UserRecord): number {
  if (user.calls_limit === 0) return 0;
  return Math.min(100, Math.round((user.calls_used / user.calls_limit) * 100));
}

function progressClass(pct: number): string {
  if (pct >= 90) return 'progress-fill danger';
  if (pct >= 80) return 'progress-fill warning';
  return 'progress-fill';
}

/**
 * The buy CTAs, or `''` for a user who already has a Stripe customer.
 *
 * Gated on `stripe_customer_id` alone — deliberately *not* on the caller's
 * `portalAvailable`, which is `stripe_customer_id && STRIPE_SECRET_KEY`. That
 * conjunction is right for the portal (it needs the key) and wrong here: it is
 * false for a real subscriber whenever the key is unset, which is every local
 * run, every test, and any boot where the Fly secret failed to attach. Offering
 * a Payment Link there would start a *second* subscription — a Payment Link
 * cannot modify an existing one — and the webhook would then overwrite
 * `stripe_subscription_id`, orphaning the subscription still being charged.
 *
 * Changing plan from a paid plan therefore goes through the portal, which Stripe
 * handles as a prorated swap. ATY-64 replaces these links with a server-side
 * `checkout.sessions.create` so a paid-to-paid upgrade stops depending on a
 * portal setting we cannot read.
 */
function upgradeCards(user: UserRecord): string {
  if (user.stripe_customer_id) return '';

  const cards = PURCHASABLE_PLANS.filter((plan) => plan !== user.plan)
    .map((plan) => ({ plan, link: checkoutLinkForPlan(plan, user) }))
    // No configured link, no card: that is how Scale stays absent until ATY-24.
    .filter((card): card is { plan: PurchasablePlan; link: string } => card.link !== null)
    .map(
      ({ plan, link }) => `  <div class="stat-card">
    <div class="label">${escapeHtml(PLAN_NAMES[plan])}</div>
    <div class="value">${PLAN_PRICES[plan]}</div>
    <div class="sub">${PLAN_LIMITS[plan].toLocaleString()} renders/mo</div>
    <p style="margin-top:0.75rem"><a href="${escapeHtml(link)}" class="btn btn-primary">Upgrade to ${escapeHtml(PLAN_NAMES[plan])}</a></p>
  </div>`,
    );

  if (cards.length === 0) return '';

  return `<div class="table-card" style="padding:1.5rem">
  <div class="table-header">Upgrade</div>
  <div class="stats-grid">
${cards.join('\n\n')}
  </div>
</div>

`;
}

export function billingView(user: UserRecord, portalAvailable: boolean): string {
  const pct = usagePercent(user);

  const portalLink = portalAvailable
    ? `<a href="/billing/portal" class="btn btn-primary">Manage Subscription</a>`
    : `<p style="color:var(--text-muted)">Subscribe to a paid plan to manage billing.</p>`;

  return `<div class="page-header">
  <h1>Billing</h1>
</div>

<div class="stats-grid">
  <div class="stat-card">
    <div class="label">Current plan</div>
    <div class="value">${escapeHtml(PLAN_NAMES[user.plan])}</div>
    <div class="sub">${PLAN_PRICES[user.plan]}</div>
  </div>

  <div class="stat-card">
    <div class="label">Usage this period</div>
    <div class="value">${user.calls_used.toLocaleString()} / ${user.calls_limit.toLocaleString()}</div>
    <div class="progress">
      <div class="${progressClass(pct)}" style="width: ${pct}%"></div>
    </div>
    <div class="sub">${pct}% used</div>
  </div>

  <div class="stat-card">
    <div class="label">Period started</div>
    <div class="value">${escapeHtml(user.period_start)}</div>
  </div>
</div>

${upgradeCards(user)}<div class="table-card" style="padding:1.5rem">
  <div class="table-header">Subscription management</div>
  ${portalLink}
</div>`;
}
