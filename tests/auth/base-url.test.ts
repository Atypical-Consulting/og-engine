import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CANONICAL_BASE_URL, warnIfBaseUrlUnset } from '../../src/auth/base-url';
import { authRoutes } from '../../src/auth/routes';
import { closeDb } from '../../src/db';

// These tests are the regression guard for ATY-44: a production machine with
// BASE_URL unset used to email `http://localhost:3000/auth/verify?token=...`,
// which nobody can click. Nothing here may ever produce a localhost link while
// NODE_ENV=production.

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
const ORIGINAL_BASE_URL = process.env.BASE_URL;
const ORIGINAL_RESEND_KEY = process.env.RESEND_API_KEY;

let app: Hono;
let emailCounter = 0;

/**
 * Drives the real POST /auth/send-link handler and returns the verify URL that
 * would have been emailed. With RESEND_API_KEY unset, `sendMagicLinkEmail`
 * logs the link instead of sending it — so this asserts on the actual value
 * handed to the mail provider, not on a re-implementation of the logic.
 */
async function capturedVerifyUrl(requestUrl: string, headers: Record<string, string> = {}): Promise<string> {
  const info = vi.spyOn(console, 'info').mockImplementation(() => {});
  try {
    const res = await app.request(requestUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      // A fresh address each call: send-link rate-limits at 3 per email.
      body: JSON.stringify({ email: `aty44-${emailCounter++}@example.com` }),
    });
    expect(res.status).toBe(200);

    const logged = info.mock.calls.map((args) => String(args[0])).find((line) => line.includes('verify URL'));
    if (!logged) throw new Error('no magic link URL was logged');
    return logged.replace('[email] Magic link verify URL: ', '');
  } finally {
    info.mockRestore();
  }
}

/** Asserts the emailed link is a real verify URL on exactly `expectedOrigin`. */
function expectVerifyUrlOn(url: string, expectedOrigin: string): void {
  const parsed = new URL(url);
  expect(parsed.origin).toBe(expectedOrigin);
  expect(parsed.pathname).toBe('/auth/verify');
  expect(parsed.searchParams.get('token')).toBeTruthy();
}

beforeEach(() => {
  closeDb();
  process.env.DATABASE_URL = 'file::memory:';
  delete process.env.RESEND_API_KEY;
  delete process.env.BASE_URL;
  app = new Hono();
  app.route('/', authRoutes);
});

afterEach(() => {
  closeDb();
  delete process.env.DATABASE_URL;
  if (ORIGINAL_NODE_ENV === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = ORIGINAL_NODE_ENV;
  if (ORIGINAL_BASE_URL === undefined) delete process.env.BASE_URL;
  else process.env.BASE_URL = ORIGINAL_BASE_URL;
  if (ORIGINAL_RESEND_KEY === undefined) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = ORIGINAL_RESEND_KEY;
});

describe('magic-link base URL in production', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'production';
  });

  it('never emits a localhost link, even with BASE_URL unset', async () => {
    const url = await capturedVerifyUrl('https://og-engine.com/auth/send-link');
    expect(url).not.toContain('localhost');
    expectVerifyUrlOn(url, 'https://og-engine.com');
  });

  it('derives the origin from an allowlisted request host', async () => {
    const url = await capturedVerifyUrl('https://og-engine.fly.dev/auth/send-link');
    expectVerifyUrlOn(url, 'https://og-engine.fly.dev');
  });

  it('upgrades an allowlisted host to https', async () => {
    const url = await capturedVerifyUrl('http://og-engine.com/auth/send-link');
    expectVerifyUrlOn(url, 'https://og-engine.com');
  });

  it('falls back to the canonical host for a spoofed Host header', async () => {
    // Magic links are bearer credentials — reflecting an attacker-controlled
    // Host would mail a victim's login token to a domain they control.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const url = await capturedVerifyUrl('https://evil.example/auth/send-link');
      expectVerifyUrlOn(url, CANONICAL_BASE_URL);
      expect(url).not.toContain('evil.example');
    } finally {
      warn.mockRestore();
    }
  });

  it('ignores a BASE_URL that points at loopback', async () => {
    process.env.BASE_URL = 'http://localhost:3000';
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const url = await capturedVerifyUrl('https://og-engine.com/auth/send-link');
      expectVerifyUrlOn(url, 'https://og-engine.com');
    } finally {
      warn.mockRestore();
    }
  });

  it('honours an explicitly configured BASE_URL over the request host', async () => {
    process.env.BASE_URL = 'https://og-engine.atypical.consulting';
    const url = await capturedVerifyUrl('https://og-engine.fly.dev/auth/send-link');
    expectVerifyUrlOn(url, 'https://og-engine.atypical.consulting');
  });

  it('strips a trailing slash from BASE_URL', async () => {
    process.env.BASE_URL = 'https://og-engine.com/';
    const url = await capturedVerifyUrl('https://og-engine.com/auth/send-link');
    expectVerifyUrlOn(url, 'https://og-engine.com');
    expect(url).not.toContain('//auth/verify');
  });

  it('warns at startup when BASE_URL is unset', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      warnIfBaseUrlUnset();
      expect(warn).toHaveBeenCalledOnce();
      expect(String(warn.mock.calls[0][0])).toContain('BASE_URL is not set in production');
    } finally {
      warn.mockRestore();
    }
  });

  it('stays quiet at startup when BASE_URL is set', () => {
    process.env.BASE_URL = CANONICAL_BASE_URL;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      warnIfBaseUrlUnset();
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });
});

describe('magic-link base URL outside production', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'development';
  });

  it('keeps working against localhost', async () => {
    const url = await capturedVerifyUrl('http://localhost:3000/auth/send-link');
    expectVerifyUrlOn(url, 'http://localhost:3000');
  });

  it('does not warn at startup', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      warnIfBaseUrlUnset();
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });
});
