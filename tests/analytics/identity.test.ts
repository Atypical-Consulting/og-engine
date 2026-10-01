import { describe, expect, it } from 'vitest';
import {
  classifySource,
  isAutomatedClient,
  normalisePath,
  referrerHost,
  sanitiseSrc,
} from '../../src/analytics/identity';

const self = 'og-engine.com';

describe('classifySource', () => {
  const cases: [string | null, string | null, string | null][] = [
    // referrerHost, utmSource, expected
    [null, null, 'direct'],
    ['www.google.com', null, 'organic_search'],
    ['google.co.uk', null, 'organic_search'],
    ['duckduckgo.com', null, 'organic_search'],
    ['search.brave.com', null, 'organic_search'],
    ['chatgpt.com', null, 'ai_assistant'],
    ['perplexity.ai', null, 'ai_assistant'],
    ['news.ycombinator.com', null, 'social'],
    ['x.com', null, 'social'],
    ['reddit.com', null, 'social'],
    ['github.com', null, 'referral'],
    ['some-blog.dev', null, 'referral'],
    [null, 'newsletter', 'campaign'],
    ['www.google.com', 'newsletter', 'campaign'],
  ];

  for (const [host, utm, expected] of cases) {
    it(`${host ?? 'no referrer'}${utm ? ` + utm=${utm}` : ''} → ${expected}`, () => {
      expect(classifySource({ referrerHost: host, utmSource: utm, selfHost: self })).toBe(expected);
    });
  }

  it('returns null for internal navigation so the session source is inherited', () => {
    expect(classifySource({ referrerHost: 'og-engine.com', utmSource: null, selfHost: self })).toBeNull();
    expect(classifySource({ referrerHost: 'docs.og-engine.com', utmSource: null, selfHost: self })).toBeNull();
  });
});

describe('referrerHost', () => {
  it('keeps the host only — never the path or query', () => {
    expect(referrerHost('https://www.google.com/search?q=puppeteer+alternative')).toBe('google.com');
  });

  it('is null for a missing or unparseable referrer', () => {
    expect(referrerHost(undefined)).toBeNull();
    expect(referrerHost('not a url')).toBeNull();
  });
});

describe('normalisePath', () => {
  it('drops the query string, which can carry personal data', () => {
    expect(normalisePath('/pricing/?email=someone@example.com')).toBe('/pricing/');
  });

  it('settles on one spelling per page', () => {
    expect(normalisePath('/pricing')).toBe('/pricing/');
    expect(normalisePath('/pricing/')).toBe('/pricing/');
    expect(normalisePath('/')).toBe('/');
  });

  it('leaves real files alone', () => {
    expect(normalisePath('/llms.txt')).toBe('/llms.txt');
  });
});

describe('sanitiseSrc', () => {
  it('accepts a page path and canonicalises it like a page view', () => {
    expect(sanitiseSrc('quick-start')).toBe('/quick-start/');
    expect(sanitiseSrc('/compare/puppeteer/')).toBe('/compare/puppeteer/');
    expect(sanitiseSrc('/')).toBe('/');
  });

  it('rejects anything that is not a plain slug path', () => {
    expect(sanitiseSrc(undefined)).toBeNull();
    expect(sanitiseSrc('')).toBeNull();
    expect(sanitiseSrc('mailto:someone@example.com')).toBeNull();
    expect(sanitiseSrc('/page?utm=<script>')).toBeNull();
    expect(sanitiseSrc('someone@example.com')).toBeNull();
  });
});

describe('isAutomatedClient', () => {
  it('skips crawlers, monitors and scripted clients', () => {
    expect(isAutomatedClient('Mozilla/5.0 (compatible; Googlebot/2.1)')).toBe(true);
    expect(isAutomatedClient('curl/8.4.0')).toBe(true);
    expect(isAutomatedClient('python-requests/2.31.0')).toBe(true);
    expect(isAutomatedClient(undefined)).toBe(true);
  });

  it('counts a real browser', () => {
    expect(
      isAutomatedClient(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36',
      ),
    ).toBe(false);
  });
});
