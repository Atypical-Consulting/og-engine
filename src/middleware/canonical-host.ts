import type { Context, Next } from 'hono';

export interface CanonicalHostOptions {
  /** Hostname the public site should be served from, e.g. `og-engine.com`. */
  canonical: string;
  /** Hostnames that serve the same content and must redirect, e.g. `og-engine.fly.dev`. */
  aliases: string[];
}

function normalizeHost(value: string | undefined): string {
  // Strip the port — `og-engine.fly.dev` and `og-engine.fly.dev:443` are the same host.
  return (value ?? '').trim().toLowerCase().split(':')[0] ?? '';
}

/**
 * Redirects the docs site from alias hostnames to the canonical one so search
 * engines see a single indexable copy of every page.
 *
 * The same Fly app answers on `og-engine.com` and `og-engine.fly.dev`, which
 * splits ranking signals across two hosts. `rel=canonical` is only a hint, so
 * this issues a 301 instead.
 *
 * Two deliberate constraints:
 *
 * - **Only GET/HEAD.** A 301 drops the request body, and Stripe does not follow
 *   redirects, so a webhook pointed at the alias host must never be redirected.
 * - **Only listed aliases.** Redirecting "any host that is not canonical" would
 *   loop forever if the proxy ever passed an unexpected `Host`, and would break
 *   local/private access. The alias list is explicit and cannot contain the
 *   canonical host.
 *
 * Register this *after* the API routes and *before* the static docs handler:
 * Hono runs matching handlers in registration order, so API routes answer first
 * and only requests bound for the docs site reach this middleware.
 */
export function canonicalHost(opts?: Partial<CanonicalHostOptions>) {
  const canonical = normalizeHost(opts?.canonical ?? process.env.CANONICAL_HOST);
  const aliases = new Set(
    (opts?.aliases ?? (process.env.CANONICAL_HOST_ALIASES ?? '').split(','))
      .map((host) => normalizeHost(host))
      .filter((host) => host.length > 0 && host !== canonical),
  );

  // Flag off: no canonical host or nothing to redirect. Unset either env var to
  // turn the redirect off without touching code.
  if (!canonical || aliases.size === 0) {
    return async (_c: Context, next: Next) => {
      await next();
    };
  }

  return async (c: Context, next: Next) => {
    if (c.req.method !== 'GET' && c.req.method !== 'HEAD') return next();
    if (!aliases.has(normalizeHost(c.req.header('host')))) return next();

    const target = new URL(c.req.url);
    target.host = canonical;
    target.protocol = 'https:';
    return c.redirect(target.toString(), 301);
  };
}
