import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Hono } from 'hono';
import { beforeAll, describe, expect, it } from 'vitest';
import { renderRoute } from '../../src/api/render';
import { registerFonts } from '../../src/engine/fonts';
import { renderSchema } from '../../src/schemas/request';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = new Hono();
app.route('/', renderRoute);

beforeAll(async () => {
  await registerFonts(join(__dirname, '..', '..', 'fonts'));
});

function post(body: unknown) {
  return app.request('/render', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /render', () => {
  it('returns a PNG image with correct Content-Type', async () => {
    const res = await post({ format: 'og', title: 'Hello, OG Engine' });
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/png');
  });

  it('returns render metadata in headers', async () => {
    const res = await post({ format: 'og', title: 'Test Title' });
    expect(res.headers.get('X-Render-Time-Ms')).toBeTruthy();
    expect(res.headers.get('X-Title-Lines')).toBeTruthy();
    expect(res.headers.get('X-Desc-Lines')).toBeTruthy();
    expect(res.headers.get('X-Layout-Overflow')).toBeTruthy();
  });

  it('returns PNG binary data', async () => {
    const res = await post({ format: 'og', title: 'Test Title' });
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf[0]).toBe(0x89);
    expect(buf[1]).toBe(0x50);
    expect(buf[2]).toBe(0x4e);
    expect(buf[3]).toBe(0x47);
  });

  it('returns 400 for missing format', async () => {
    const res = await post({ title: 'Hello' });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('invalid_request');
  });

  it('returns 400 for missing title', async () => {
    const res = await post({ format: 'og' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid font', async () => {
    const res = await post({
      format: 'og',
      title: 'Hello',
      style: { font: 'NonexistentFont' },
    });
    expect(res.status).toBe(400);
  });

  it('accepts full style customization', async () => {
    const res = await post({
      format: 'og',
      title: 'Styled Image',
      description: 'With custom styles.',
      author: 'Author',
      tag: 'Tag',
      style: {
        accent: '#67e8f9',
        layout: 'center',
        font: 'Inter',
        titleSize: 56,
        descSize: 24,
        gradient: 'deep-sea',
      },
    });
    expect(res.status).toBe(200);
  });

  it('renders with a specific template', async () => {
    const res = await post({
      format: 'og',
      title: 'Social Card Test',
      template: 'social-card',
    });
    expect(res.status).toBe(200);
  });

  it('returns 400 for invalid template', async () => {
    const res = await post({
      format: 'og',
      title: 'Hello',
      template: 'nonexistent',
    });
    expect(res.status).toBe(400);
  });

  it('returns WebP when output format is webp', async () => {
    const res = await post({
      format: 'og',
      title: 'WebP Test',
      output: { format: 'webp' },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/webp');
  });
});

describe('renderSchema with variables', () => {
  it('accepts a request with variables', () => {
    const result = renderSchema.safeParse({
      format: 'og',
      title: 'My Product',
      variables: {
        price: '€129',
        badge: '-20%',
        rating: '4.8',
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.variables).toEqual({
        price: '€129',
        badge: '-20%',
        rating: '4.8',
      });
    }
  });

  it('defaults variables to empty object when omitted', () => {
    const result = renderSchema.safeParse({
      format: 'og',
      title: 'Test',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.variables).toEqual({});
    }
  });

  it('rejects non-string variable values', () => {
    const result = renderSchema.safeParse({
      format: 'og',
      title: 'Test',
      variables: { count: 42 },
    });
    expect(result.success).toBe(false);
  });
});

describe('renderSchema with images', () => {
  it('accepts a request with named image URLs', () => {
    const result = renderSchema.safeParse({
      format: 'og',
      title: 'Product',
      images: {
        logo: 'https://example.com/logo.png',
        avatar: 'https://example.com/avatar.jpg',
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.images).toEqual({
        logo: 'https://example.com/logo.png',
        avatar: 'https://example.com/avatar.jpg',
      });
    }
  });

  it('defaults images to empty object when omitted', () => {
    const result = renderSchema.safeParse({
      format: 'og',
      title: 'Test',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.images).toEqual({});
    }
  });

  it('rejects non-URL image values', () => {
    const result = renderSchema.safeParse({
      format: 'og',
      title: 'Test',
      images: { logo: 'not-a-url' },
    });
    expect(result.success).toBe(false);
  });
});
