import { describe, it, expect, beforeAll } from 'vitest';
import { Hono } from 'hono';
import { validateRoute } from '../../src/api/validate';
import { registerFonts } from '../../src/engine/fonts';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = new Hono();
app.route('/', validateRoute);

beforeAll(async () => {
  await registerFonts(join(__dirname, '..', '..', 'fonts'));
});

function post(body: unknown) {
  return app.request('/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /validate', () => {
  it('returns fits: true for short text', async () => {
    const res = await post({ format: 'og', title: 'Hello' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.fits).toBe(true);
    expect(body.title.lines).toBe(1);
    expect(body.title.overflow).toBe(false);
    expect(body.computeTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('returns fits: false for overflowing title', async () => {
    const res = await post({
      format: 'og',
      title: 'This is an extremely long title that will certainly overflow because it has too many words to possibly fit within three lines of the OG format at the default font size of forty-eight pixels',
    });
    const body = await res.json();
    expect(body.fits).toBe(false);
    expect(body.title.overflow).toBe(true);
    expect(body.title.lines).toBeGreaterThan(3);
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

  it('accepts custom maxTitleLines', async () => {
    const res = await post({
      format: 'og',
      title: 'Short title',
      maxTitleLines: 1,
    });
    const body = await res.json();
    expect(body.title.maxLines).toBe(1);
  });

  it('includes description validation when provided', async () => {
    const res = await post({
      format: 'og',
      title: 'Title',
      description: 'Some description text',
    });
    const body = await res.json();
    expect(body.description).toBeDefined();
    expect(body.description.lines).toBeGreaterThan(0);
  });
});
