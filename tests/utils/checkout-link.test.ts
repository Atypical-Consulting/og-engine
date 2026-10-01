import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkoutLinkForPlan, withAccountIdentity } from '../../src/utils/checkout-link';

const USER = { id: 'b9f0a3d4-1111-4000-8000-000000000001', email: 'dev+tag@acme.com' };
const LINK = 'https://buy.stripe.com/7sY5kDcH26sI73IafFfAc01';

beforeEach(() => {
  process.env.STRIPE_PAYMENT_LINK_PRO = LINK;
});

afterEach(() => {
  delete process.env.STRIPE_PAYMENT_LINK_PRO;
  delete process.env.STRIPE_PAYMENT_LINK_STARTER;
  delete process.env.STRIPE_PAYMENT_LINK_SCALE;
});

describe('withAccountIdentity', () => {
  it('carries the account id and email onto the payment link', () => {
    const url = new URL(withAccountIdentity(LINK, USER));
    expect(url.origin + url.pathname).toBe(LINK);
    expect(url.searchParams.get('client_reference_id')).toBe(USER.id);
    expect(url.searchParams.get('prefilled_email')).toBe(USER.email);
  });

  it('percent-encodes an email that needs it', () => {
    // A bare `+` in a query string decodes to a space, which would make Stripe
    // prefill the wrong address.
    expect(withAccountIdentity(LINK, USER)).toContain('prefilled_email=dev%2Btag%40acme.com');
  });

  it('preserves a query string already on the link', () => {
    const url = new URL(withAccountIdentity(`${LINK}?locale=fr`, USER));
    expect(url.searchParams.get('locale')).toBe('fr');
    expect(url.searchParams.get('client_reference_id')).toBe(USER.id);
  });

  it('omits an id Stripe would reject rather than producing an unopenable link', () => {
    const url = new URL(withAccountIdentity(LINK, { id: 'has spaces & punctuation', email: USER.email }));
    expect(url.searchParams.has('client_reference_id')).toBe(false);
    expect(url.searchParams.get('prefilled_email')).toBe(USER.email);
  });
});

describe('checkoutLinkForPlan', () => {
  it('builds the link for a configured plan', () => {
    const link = checkoutLinkForPlan('pro', USER);
    expect(link).not.toBeNull();
    expect(new URL(link as string).searchParams.get('client_reference_id')).toBe(USER.id);
  });

  it('returns null for a plan with no payment link configured', () => {
    // How an upgrade surface stays off: no env var, no CTA, no deploy needed.
    expect(checkoutLinkForPlan('scale', USER)).toBeNull();
  });

  it('refuses a misconfigured link instead of rendering it', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    process.env.STRIPE_PAYMENT_LINK_STARTER = 'not a url';
    expect(checkoutLinkForPlan('starter', USER)).toBeNull();

    process.env.STRIPE_PAYMENT_LINK_STARTER = 'http://buy.stripe.com/insecure';
    expect(checkoutLinkForPlan('starter', USER)).toBeNull();

    expect(errSpy).toHaveBeenCalledTimes(2);
    errSpy.mockRestore();
  });
});
