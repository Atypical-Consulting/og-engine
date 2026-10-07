import type { Context } from 'hono';

/**
 * Canonical production origin. This is the last-resort fallback when
 * NODE_ENV=production, so a magic link can never be built against
 * `http://localhost:3000` on a production machine — a link nobody can click.
 */
export const CANONICAL_BASE_URL = 'https://og-engine.com';

/** Origin used when nothing better is available outside production. */
export const DEV_BASE_URL = 'http://localhost:3000';

/**
 * Hosts we are willing to build a magic-link URL for.
 *
 * A magic link is a bearer credential. If we reflected an attacker-supplied
 * `Host` header straight back into the email, anyone could POST
 * /auth/send-link with `Host: evil.example` and have a victim's login token
 * delivered to a domain they control. So the request-derived path is an
 * allowlist, never a passthrough.
 */
const ALLOWED_PRODUCTION_HOSTS = new Set([
  'og-engine.com',
  'www.og-engine.com',
  // Fly's default hostname — still serves the app, so a link built from it works.
  'og-engine.fly.dev',
  // Pre-allowlisted for the ATY-42 subdomain move; harmless until DNS exists.
  'og-engine.atypical.consulting',
]);

/** Loopback hostnames, allowed only outside production. */
const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/** Strips trailing slashes so callers can append `/auth/verify` safely. */
function normalizeOrigin(origin: string): string {
  return origin.replace(/\/+$/, '');
}

function hostnameOf(host: string): string {
  // Strip the port. IPv6 literals arrive bracketed (`[::1]:3000`).
  if (host.startsWith('[')) return host.slice(0, host.indexOf(']') + 1);
  const colon = host.lastIndexOf(':');
  return colon === -1 ? host : host.slice(0, colon);
}

function isLoopback(host: string): boolean {
  return LOOPBACK_HOSTNAMES.has(hostnameOf(host).toLowerCase());
}

/**
 * Validates an explicitly configured BASE_URL. Returns the normalized origin,
 * or null when it is unusable and we should fall back to the request host.
 */
function originFromEnv(): string | null {
  const raw = process.env.BASE_URL?.trim();
  if (!raw) return null;

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    console.warn(`[auth] BASE_URL is not a valid absolute URL (${raw}) — deriving from the request host instead`);
    return null;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    console.warn(`[auth] BASE_URL must be http(s) (got ${parsed.protocol}) — deriving from the request host instead`);
    return null;
  }

  // The bug this guard exists for: a production machine with BASE_URL unset (or
  // copied from a .env.example) emailing everyone a localhost login link.
  if (isProduction() && isLoopback(parsed.host)) {
    console.warn(`[auth] BASE_URL points at loopback (${raw}) but NODE_ENV=production — ignoring it`);
    return null;
  }

  return normalizeOrigin(parsed.origin);
}

/**
 * Resolves the origin to use when building absolute links we email to users.
 *
 * Order of preference:
 *  1. An explicit, valid `BASE_URL` (not loopback in production).
 *  2. The incoming request's own origin, if its host is allowlisted.
 *  3. `https://og-engine.com` in production, `http://localhost:3000` otherwise.
 */
export function resolveBaseUrl(c: Context): string {
  const configured = originFromEnv();
  if (configured) return configured;

  const host = new URL(c.req.url).host;
  const allowed = isProduction()
    ? ALLOWED_PRODUCTION_HOSTS.has(hostnameOf(host).toLowerCase())
    : ALLOWED_PRODUCTION_HOSTS.has(hostnameOf(host).toLowerCase()) || isLoopback(host);

  if (!allowed) {
    const fallback = isProduction() ? CANONICAL_BASE_URL : DEV_BASE_URL;
    console.warn(`[auth] request host "${host}" is not allowlisted for login links — using ${fallback}`);
    return fallback;
  }

  // Fly terminates TLS and forwards the original scheme; trust it for the
  // scheme only (the host is allowlisted above). Production is always https.
  const forwardedProto = c.req.header('x-forwarded-proto')?.split(',')[0]?.trim();
  const proto = isProduction() ? 'https' : (forwardedProto ?? new URL(c.req.url).protocol.replace(':', ''));

  return normalizeOrigin(`${proto}://${host}`);
}

/**
 * Logs a loud startup warning when production is missing an explicit BASE_URL.
 *
 * Deliberately a warning and not a hard exit: `resolveBaseUrl` already
 * guarantees production can never emit a localhost link, so crash-looping the
 * whole service (render API included) over a missing optional override would
 * turn a signup bug into a total outage.
 */
export function warnIfBaseUrlUnset(): void {
  if (!isProduction()) return;
  if (originFromEnv()) return;

  console.warn(
    `[auth] BASE_URL is not set in production — login links will be derived from the request host, ` +
      `falling back to ${CANONICAL_BASE_URL}. Set it explicitly: fly secrets set BASE_URL=${CANONICAL_BASE_URL}`,
  );
}
