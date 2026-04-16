import { lookup } from 'node:dns/promises';
import { isIPv4, isIPv6 } from 'node:net';

// Blocked IPv4 CIDR ranges (RFC 1918, loopback, link-local, special-use)
const BLOCKED_V4_CIDRS: Array<[number, number]> = [
  cidrToRange('10.0.0.0/8'), // RFC 1918
  cidrToRange('172.16.0.0/12'), // RFC 1918
  cidrToRange('192.168.0.0/16'), // RFC 1918
  cidrToRange('127.0.0.0/8'), // Loopback
  cidrToRange('169.254.0.0/16'), // Link-local (AWS/Fly metadata: 169.254.169.254)
  cidrToRange('0.0.0.0/8'), // "This" network
  cidrToRange('100.64.0.0/10'), // Shared address space (RFC 6598)
  cidrToRange('192.0.0.0/24'), // IETF Protocol Assignments
  cidrToRange('240.0.0.0/4'), // Reserved
];

function ipv4ToNum(ip: string): number {
  return ip.split('.').reduce((acc, octet) => ((acc << 8) | parseInt(octet, 10)) >>> 0, 0) >>> 0;
}

function cidrToRange(cidr: string): [number, number] {
  const [base, bits] = cidr.split('/');
  const prefixLen = parseInt(bits, 10);
  const mask = prefixLen === 0 ? 0 : (~0 << (32 - prefixLen)) >>> 0;
  return [ipv4ToNum(base) & mask, mask];
}

function isBlockedIPv4(ip: string): boolean {
  const num = ipv4ToNum(ip);
  return BLOCKED_V4_CIDRS.some(([base, mask]) => (num & mask) === base);
}

function isBlockedIPv6(ip: string): boolean {
  const addr = ip.toLowerCase().replace(/^\[|\]$/g, '');
  if (addr === '::1') return true;
  // IPv4-mapped: ::ffff:x.x.x.x
  if (addr.startsWith('::ffff:')) return true;
  const firstGroup = addr.split(':')[0] ?? '';
  const firstVal = parseInt(firstGroup || '0', 16);
  // fc00::/7 — unique local (fc00–fdff)
  if (firstVal >= 0xfc00 && firstVal <= 0xfdff) return true;
  // fe80::/10 — link-local (fe80–febf)
  if (firstVal >= 0xfe80 && firstVal <= 0xfebf) return true;
  return false;
}

export class SSRFError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SSRFError';
  }
}

/**
 * Resolves the hostname in a URL and throws SSRFError if it maps to a
 * private, loopback, or link-local address. Call this before any
 * user-supplied URL is fetched.
 */
export async function assertNotPrivateUrl(url: string): Promise<void> {
  const { hostname } = new URL(url);
  const bare = hostname.replace(/^\[|\]$/g, '');

  if (isIPv4(bare)) {
    if (isBlockedIPv4(bare)) throw new SSRFError('Requests to private or reserved IP addresses are not allowed.');
    return;
  }

  if (isIPv6(bare)) {
    if (isBlockedIPv6(bare)) throw new SSRFError('Requests to private or reserved IP addresses are not allowed.');
    return;
  }

  // Resolve hostname via DNS and check every returned address
  let addresses: Array<{ address: string; family: number }>;
  try {
    addresses = await lookup(hostname, { all: true });
  } catch {
    // DNS failure — let the subsequent fetch fail naturally
    return;
  }

  for (const { address, family } of addresses) {
    if (family === 4 && isBlockedIPv4(address)) {
      throw new SSRFError('Requests to private or reserved IP addresses are not allowed.');
    }
    if (family === 6 && isBlockedIPv6(address)) {
      throw new SSRFError('Requests to private or reserved IP addresses are not allowed.');
    }
  }
}
