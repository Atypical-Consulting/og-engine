import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderFromUrlSchema } from '../../src/api/render-from-url';

// ---------------------------------------------------------------------------
// Schema validation tests
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// SSRF protection tests (route-level)
// ---------------------------------------------------------------------------

async function createApp() {
  const { renderFromUrlRoute } = await import('../../src/api/render-from-url');
  const app = new Hono();
  app.route('/', renderFromUrlRoute);
  return app;
}

function postRenderFromUrl(app: Hono, body: object) {
  return app.request('/render/from-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /render/from-url — SSRF protection', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('blocks requests to loopback 127.0.0.1', async () => {
    const app = await createApp();
    const res = await postRenderFromUrl(app, { url: 'http://127.0.0.1/secret' });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('ssrf_blocked');
  });

  it('blocks requests to AWS/Fly metadata endpoint 169.254.169.254', async () => {
    const app = await createApp();
    const res = await postRenderFromUrl(app, {
      url: 'http://169.254.169.254/latest/meta-data/',
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('ssrf_blocked');
  });

  it('blocks requests to RFC 1918 private range 10.0.0.1', async () => {
    const app = await createApp();
    const res = await postRenderFromUrl(app, { url: 'http://10.0.0.1/internal' });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('ssrf_blocked');
  });

  it('blocks requests to RFC 1918 private range 172.16.0.1', async () => {
    const app = await createApp();
    const res = await postRenderFromUrl(app, { url: 'http://172.16.0.1/admin' });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('ssrf_blocked');
  });

  it('blocks requests to RFC 1918 private range 192.168.1.1', async () => {
    const app = await createApp();
    const res = await postRenderFromUrl(app, {
      url: 'http://192.168.1.1/router',
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('ssrf_blocked');
  });

  it('blocks IPv6 loopback ::1', async () => {
    const app = await createApp();
    const res = await postRenderFromUrl(app, { url: 'http://[::1]/secret' });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('ssrf_blocked');
  });

  it('does not block a normal public URL (passes SSRF check)', async () => {
    // Mock fetch so the request does not actually hit the network.
    // We only care that SSRF check passes (status must not be 400 ssrf_blocked).
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('<html><head><title>Example</title></head><body></body></html>', {
          status: 200,
          headers: { 'Content-Type': 'text/html' },
        }),
      ),
    );

    const app = await createApp();
    const res = await postRenderFromUrl(app, {
      url: 'https://example.com/blog/post',
    });

    // Must not be SSRF-blocked
    expect(res.status).not.toBe(400);
    const body = await res.json().catch(() => null);
    if (body?.error) {
      expect(body.error).not.toBe('ssrf_blocked');
    }
  });
});

// ---------------------------------------------------------------------------
// SSRF utility unit tests (direct)
// ---------------------------------------------------------------------------

describe('assertNotPrivateUrl — unit tests', () => {
  it('throws SSRFError for 127.0.0.1', async () => {
    const { assertNotPrivateUrl, SSRFError } = await import('../../src/utils/ssrf');
    await expect(assertNotPrivateUrl('http://127.0.0.1/')).rejects.toBeInstanceOf(SSRFError);
  });

  it('throws SSRFError for 169.254.169.254', async () => {
    const { assertNotPrivateUrl, SSRFError } = await import('../../src/utils/ssrf');
    await expect(assertNotPrivateUrl('http://169.254.169.254/')).rejects.toBeInstanceOf(SSRFError);
  });

  it('throws SSRFError for 10.0.0.1', async () => {
    const { assertNotPrivateUrl, SSRFError } = await import('../../src/utils/ssrf');
    await expect(assertNotPrivateUrl('http://10.0.0.1/')).rejects.toBeInstanceOf(SSRFError);
  });

  it('throws SSRFError for 172.31.255.255 (inside 172.16.0.0/12)', async () => {
    const { assertNotPrivateUrl, SSRFError } = await import('../../src/utils/ssrf');
    await expect(assertNotPrivateUrl('http://172.31.255.255/')).rejects.toBeInstanceOf(SSRFError);
  });

  it('throws SSRFError for IPv6 loopback [::1]', async () => {
    const { assertNotPrivateUrl, SSRFError } = await import('../../src/utils/ssrf');
    await expect(assertNotPrivateUrl('http://[::1]/')).rejects.toBeInstanceOf(SSRFError);
  });

  it('does not throw for a public IP (1.1.1.1)', async () => {
    const { assertNotPrivateUrl } = await import('../../src/utils/ssrf');
    await expect(assertNotPrivateUrl('https://1.1.1.1/')).resolves.toBeUndefined();
  });
});
