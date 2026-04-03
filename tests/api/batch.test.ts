import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Hono } from 'hono';
import { beforeAll, describe, expect, it } from 'vitest';
import { batchRoute } from '../../src/api/batch';
import { registerFonts } from '../../src/engine/fonts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = new Hono();
app.route('/', batchRoute);

beforeAll(async () => {
  await registerFonts(join(__dirname, '..', '..', 'fonts'));
});

function post(body: unknown) {
  return app.request('/render/batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /render/batch', () => {
  it('returns a ZIP archive for valid batch request', async () => {
    const res = await post({
      items: [
        { format: 'og', title: 'Image 1' },
        { format: 'twitter', title: 'Image 2' },
      ],
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/zip');
    expect(res.headers.get('X-Batch-Count')).toBe('2');

    const buf = Buffer.from(await res.arrayBuffer());
    // ZIP magic bytes: PK\x03\x04
    expect(buf[0]).toBe(0x50);
    expect(buf[1]).toBe(0x4b);
    expect(buf[2]).toBe(0x03);
    expect(buf[3]).toBe(0x04);
  });

  it('returns 400 for empty items array', async () => {
    const res = await post({ items: [] });
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid item in batch', async () => {
    const res = await post({
      items: [
        { format: 'og', title: 'Valid' },
        { format: 'invalid', title: 'Invalid format' },
      ],
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 for missing body', async () => {
    const res = await app.request('/render/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    });
    expect(res.status).toBe(400);
  });

  it('returns render time header', async () => {
    const res = await post({
      items: [{ format: 'og', title: 'Timed' }],
    });
    expect(res.headers.get('X-Render-Time-Ms')).toBeTruthy();
  });
});
