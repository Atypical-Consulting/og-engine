import { describe, it, expect, beforeAll } from 'vitest';
import { Hono } from 'hono';
import { healthRoute } from '../../src/api/health';
import { registerFonts } from '../../src/engine/fonts';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = new Hono();
app.route('/', healthRoute);

beforeAll(async () => {
  await registerFonts(join(__dirname, '..', '..', 'fonts'));
});

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
  });

  it('returns fonts, formats, templates, and version', async () => {
    const res = await app.request('/health');
    const body = await res.json();
    expect(body.fonts).toBeInstanceOf(Array);
    expect(body.fonts.length).toBeGreaterThan(0);
    expect(body.formats).toEqual(['og', 'twitter', 'square', 'linkedin', 'story']);
    expect(body.templates).toEqual(['default', 'social-card', 'blog-hero', 'email-banner']);
    expect(body.version).toBe('0.1.0');
  });
});
