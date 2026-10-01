import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  configuredPriceId,
  getPlanFromPriceId,
  missingPriceEnvVars,
  reportStripePriceConfig,
} from '../../src/billing/prices';

const PRICE_VARS = ['STRIPE_PRICE_STARTER', 'STRIPE_PRICE_PRO', 'STRIPE_PRICE_SCALE'] as const;

beforeEach(() => {
  process.env.STRIPE_PRICE_STARTER = 'price_starter_monthly';
  process.env.STRIPE_PRICE_PRO = 'price_pro_monthly';
  process.env.STRIPE_PRICE_SCALE = 'price_scale_monthly';
  process.env.EMAIL_FROM = 'OG Engine <hello@og-engine.com>';
});

afterEach(() => {
  for (const v of PRICE_VARS) delete process.env[v];
  delete process.env.EMAIL_FROM;
});

describe('getPlanFromPriceId', () => {
  it('maps each configured price id to its tier', () => {
    expect(getPlanFromPriceId('price_starter_monthly')).toBe('starter');
    expect(getPlanFromPriceId('price_pro_monthly')).toBe('pro');
    expect(getPlanFromPriceId('price_scale_monthly')).toBe('scale');
  });

  it('returns null for a price id we do not sell', () => {
    expect(getPlanFromPriceId('price_from_some_other_account')).toBeNull();
  });

  // The original mapping was built as an object literal keyed on
  // `process.env.X ?? ''`, so every unset var contributed a `''` key and the
  // last one declared won. An unset var was then indistinguishable from a
  // wrong one, which is the whole reason this issue exists.
  it('never matches the empty price id, even with every env var unset', () => {
    for (const v of PRICE_VARS) delete process.env[v];
    expect(getPlanFromPriceId('')).toBeNull();
  });

  it('ignores a var set to whitespace', () => {
    process.env.STRIPE_PRICE_SCALE = '   ';
    expect(configuredPriceId('scale')).toBeNull();
    expect(getPlanFromPriceId('   ')).toBeNull();
  });
});

describe('reportStripePriceConfig', () => {
  it('reports nothing when every tier is configured', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(reportStripePriceConfig()).toEqual([]);
    expect(errSpy).not.toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it('names each missing env var in a startup error', () => {
    delete process.env.STRIPE_PRICE_SCALE;
    delete process.env.STRIPE_PRICE_STARTER;
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(reportStripePriceConfig()).toEqual(['STRIPE_PRICE_STARTER', 'STRIPE_PRICE_SCALE']);
    expect(missingPriceEnvVars()).toEqual(['STRIPE_PRICE_STARTER', 'STRIPE_PRICE_SCALE']);

    const logged = errSpy.mock.calls.map((args) => args.join(' ')).join('\n');
    expect(logged).toContain('STRIPE_PRICE_STARTER');
    expect(logged).toContain('STRIPE_PRICE_SCALE');
    expect(logged).not.toContain('STRIPE_PRICE_PRO');
    errSpy.mockRestore();
  });

  it('warns when EMAIL_FROM is unset, since the fallback sender is undeliverable', () => {
    delete process.env.EMAIL_FROM;
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    reportStripePriceConfig();

    expect(warnSpy.mock.calls.map((args) => args.join(' ')).join('\n')).toContain('EMAIL_FROM');
    warnSpy.mockRestore();
  });
});
