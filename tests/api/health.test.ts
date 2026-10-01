import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Hono } from 'hono';
import { beforeAll, describe, expect, it } from 'vitest';
import pkg from '../../package.json' with { type: 'json' };
import { healthRoute } from '../../src/api/health';
import { registerFonts } from '../../src/engine/fonts';

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
    expect(body.formats).toEqual(['og', 'twitter', 'square', 'linkedin', 'story', 'readme']);
    expect(body.templates).toEqual([
      'default',
      'social-card',
      'blog-hero',
      'email-banner',
      'event',
      'github-repo',
      'product-card',
      'readme-banner',
      'testimonial',
      'news-article',
      'pricing',
      'profile-card',
      'announcement',
    ]);
    expect(body.version).toBe(pkg.version);
  });

  // Without this, nobody can tell whether a given fix is actually deployed —
  // `version` only moves on a release, not on a deploy.
  it('identifies the running build', async () => {
    process.env.GIT_SHA = 'abc1234';
    const res = await app.request('/health');
    const body = await res.json();
    expect(body.build.commit).toBe('abc1234');
    delete process.env.GIT_SHA;
  });

  it('falls back to Fly’s per-deploy image ref when no sha was baked in', async () => {
    delete process.env.GIT_SHA;
    process.env.FLY_IMAGE_REF = 'registry.fly.io/og-engine:deployment-01JABC';
    const res = await app.request('/health');
    const body = await res.json();
    expect(body.build.commit).toBeNull();
    expect(body.build.image).toBe('registry.fly.io/og-engine:deployment-01JABC');
    delete process.env.FLY_IMAGE_REF;
  });
});
