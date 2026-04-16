import { describe, expect, it } from 'vitest';
import { renderFromUrlSchema } from '../../src/api/render-from-url';
import { assertNotPrivateHost, SsrfBlockedError } from '../../src/utils/ssrf';

describe('renderFromUrlSchema', () => {
  it('accepts a valid URL request', () => {
    const result = renderFromUrlSchema.safeParse({
      url: 'https://example.com/blog/my-post',
    });
    expect(result.success).toBe(true);
  });

  it('accepts URL with format and template overrides', () => {
    const result = renderFromUrlSchema.safeParse({
      url: 'https://example.com/blog/my-post',
      format: 'twitter',
      template: 'social-card',
      style: { accent: '#fb7185' },
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing URL', () => {
    const result = renderFromUrlSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects invalid URL', () => {
    const result = renderFromUrlSchema.safeParse({ url: 'not-a-url' });
    expect(result.success).toBe(false);
  });

  it('defaults format to og and template to default', () => {
    const result = renderFromUrlSchema.safeParse({
      url: 'https://example.com',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.format).toBe('og');
      expect(result.data.template).toBe('default');
      expect(result.data.style.autoFit).toBe(true);
    }
  });
});

describe('assertNotPrivateHost (SSRF protection)', () => {
  it('throws SsrfBlockedError for loopback 127.0.0.1', async () => {
    await expect(assertNotPrivateHost('127.0.0.1')).rejects.toThrow(SsrfBlockedError);
  });

  it('throws SsrfBlockedError for localhost resolving to 127.0.0.1', async () => {
    // localhost always resolves to 127.0.0.1 or ::1 — both are blocked
    await expect(assertNotPrivateHost('localhost')).rejects.toThrow(SsrfBlockedError);
  });

  it('throws SsrfBlockedError for RFC 1918 range 10.0.0.1', async () => {
    await expect(assertNotPrivateHost('10.0.0.1')).rejects.toThrow(SsrfBlockedError);
  });

  it('throws SsrfBlockedError for RFC 1918 range 172.16.0.1', async () => {
    await expect(assertNotPrivateHost('172.16.0.1')).rejects.toThrow(SsrfBlockedError);
  });

  it('throws SsrfBlockedError for RFC 1918 range 192.168.1.1', async () => {
    await expect(assertNotPrivateHost('192.168.1.1')).rejects.toThrow(SsrfBlockedError);
  });

  it('throws SsrfBlockedError for link-local / metadata endpoint 169.254.169.254', async () => {
    await expect(assertNotPrivateHost('169.254.169.254')).rejects.toThrow(SsrfBlockedError);
  });

  it('throws SsrfBlockedError for IPv6 loopback ::1', async () => {
    await expect(assertNotPrivateHost('::1')).rejects.toThrow(SsrfBlockedError);
  });

  it('does not throw for a public IP (8.8.8.8)', async () => {
    await expect(assertNotPrivateHost('8.8.8.8')).resolves.toBeUndefined();
  });
});
