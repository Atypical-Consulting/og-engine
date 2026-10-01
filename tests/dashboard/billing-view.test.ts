import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { billingView } from '../../src/dashboard/views/billing';
import type { Plan, UserRecord } from '../../src/db/index';

const SENTINEL_STARTER = 'https://buy.stripe.com/test-starter';
const SENTINEL_PRO = 'https://buy.stripe.com/test-pro';

function user(overrides: Partial<UserRecord> & { plan: Plan }): UserRecord {
  return {
    id: 'b9f0a3d4-1111-4000-8000-000000000001',
    email: 'dev@acme.com',
    stripe_customer_id: null,
    stripe_subscription_id: null,
    calls_limit: 500,
    calls_used: 120,
    period_start: '2026-10-01',
    created_at: '2026-09-01',
    active: 1,
    ...overrides,
  };
}

// The links are set to sentinels on *every* case in this file on purpose. The
// subscriber case below asserts that no `buy.stripe.com` href is rendered; with
// no link configured that assertion would pass because there was nothing to
// render, and would keep passing if the gate were deleted outright. Configuring
// the links is what makes it fail when the gate regresses. The negative case and
// the free-user positive case have to stay under the same `beforeEach` for that
// guarantee to hold — do not split this file.
beforeEach(() => {
  process.env.STRIPE_PAYMENT_LINK_STARTER = SENTINEL_STARTER;
  process.env.STRIPE_PAYMENT_LINK_PRO = SENTINEL_PRO;
  delete process.env.STRIPE_SECRET_KEY;
});

afterEach(() => {
  delete process.env.STRIPE_PAYMENT_LINK_STARTER;
  delete process.env.STRIPE_PAYMENT_LINK_PRO;
});

describe('billingView upgrade CTAs', () => {
  it('offers Starter and Pro to a free user, each carrying account identity', () => {
    const html = billingView(user({ plan: 'free' }), false);

    expect(html).toContain(SENTINEL_STARTER);
    expect(html).toContain(SENTINEL_PRO);
    expect(html).toContain('Upgrade to Starter');
    expect(html).toContain('Upgrade to Pro');

    // `&` is escaped to `&amp;` inside the href, as the rest of this view does.
    expect(html).toContain('client_reference_id=b9f0a3d4-1111-4000-8000-000000000001');
    expect(html).toContain('prefilled_email=dev%40acme.com');
  });

  it('shows the real quota for each offered plan', () => {
    const html = billingView(user({ plan: 'free' }), false);
    expect(html).toContain('10,000 renders/mo');
    expect(html).toContain('50,000 renders/mo');
  });

  it('never offers the plan the user is already on', () => {
    const html = billingView(user({ plan: 'starter', calls_limit: 10_000 }), false);
    expect(html).not.toContain(SENTINEL_STARTER);
    expect(html).toContain(SENTINEL_PRO);
  });

  it('omits Scale while it has no payment link configured', () => {
    // ATY-24 has not produced a Scale link yet; `checkoutLinkForPlan` returns
    // null and no card may be rendered rather than a dead CTA.
    const html = billingView(user({ plan: 'free' }), false);
    expect(html).not.toContain('Upgrade to Scale');
  });

  it('offers nothing to a subscriber even when STRIPE_SECRET_KEY is absent', () => {
    // The load-bearing one. Gating on `portalAvailable` instead of
    // `stripe_customer_id` would render a Starter link to this Pro subscriber,
    // and completing it would bill them for a second concurrent subscription.
    const html = billingView(user({ plan: 'pro', stripe_customer_id: 'cus_x', calls_limit: 50_000 }), false);

    expect(html).not.toContain('buy.stripe.com');
    expect(html).not.toContain('Upgrade to');
  });

  it('offers nothing to a subscriber when the portal is available', () => {
    const html = billingView(
      user({ plan: 'pro', stripe_customer_id: 'cus_x', stripe_subscription_id: 'sub_x', calls_limit: 50_000 }),
      true,
    );

    expect(html).not.toContain('buy.stripe.com');
    expect(html).toContain('Manage Subscription');
    expect(html).toContain('/billing/portal');
  });

  it('keeps the portal link unchanged for a subscriber', () => {
    const html = billingView(user({ plan: 'pro', stripe_customer_id: 'cus_x' }), true);
    expect(html).toContain('<a href="/billing/portal" class="btn btn-primary">Manage Subscription</a>');
  });
});
