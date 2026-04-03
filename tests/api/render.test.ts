import { describe, it, expect, beforeAll } from 'vitest';
import { Hono } from 'hono';
import { renderRoute } from '../../src/api/render';
import { registerFonts } from '../../src/engine/fonts';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

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
});
