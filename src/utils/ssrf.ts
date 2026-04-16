import { lookup } from 'node:dns/promises';

interface CidrBlock {
  base: number;
  mask: number;
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let n = 0;
  for (const part of parts) {
    const byte = parseInt(part, 10);
    if (Number.isNaN(byte) || byte < 0 || byte > 255) return null;
    n = (n << 8) | byte;
  }
  return n >>> 0;
}

function cidr(ip: string, prefix: number): CidrBlock {
  const base = ipv4ToInt(ip)!;
  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
  return { base: base & mask, mask };
}

const BLOCKED_IPV4: CidrBlock[] = [
  cidr('127.0.0.0', 8), // loopback
  cidr('10.0.0.0', 8), // RFC 1918 private
  cidr('172.16.0.0', 12), // RFC 1918 private
  cidr('192.168.0.0', 16), // RFC 1918 private
  cidr('169.254.0.0', 16), // link-local (AWS/Fly metadata)
  cidr('100.64.0.0', 10), // CGNAT shared address space
  cidr('0.0.0.0', 8), // "this" network
];

const BLOCKED_IPV6_PREFIXES = [
  '::1', // loopback
  'fc', // unique local (fc00::/7)
  'fd', // unique local (fd00::/7)
  'fe80', // link-local (fe80::/10)
  '::ffff:', // IPv4-mapped (::ffff:0:0/96)
];

function isBlockedIPv4(ip: string): boolean {
  const n = ipv4ToInt(ip);
  if (n === null) return false;
  return BLOCKED_IPV4.some(({ base, mask }) => (n & mask) === base);
}

function isBlockedIPv6(ip: string): boolean {
  const lower = ip.toLowerCase().replace(/^\[|\]$/g, '');
  return BLOCKED_IPV6_PREFIXES.some((prefix) => lower === prefix || lower.startsWith(prefix));
}

export class SsrfBlockedError extends Error {
  constructor(hostname: string, ip: string) {
    super(`Blocked: "${hostname}" resolves to a private/reserved IP (${ip})`);
    this.name = 'SsrfBlockedError';
  }
}

/**
 * Resolve `hostname` to an IP and throw SsrfBlockedError if it falls in a
 * private or reserved range. Call this before fetching any user-supplied URL.
 */
export async function assertNotPrivateHost(hostname: string): Promise<void> {
  let ip: string;
  try {
    const result = await lookup(hostname, { verbatim: false });
    ip = result.address;
  } catch {
    // DNS failure — let the subsequent fetch() surface the real error
    return;
  }

  const family = ip.includes(':') ? 6 : 4;
  const blocked = family === 4 ? isBlockedIPv4(ip) : isBlockedIPv6(ip);

  if (blocked) {
    throw new SsrfBlockedError(hostname, ip);
  }
}
