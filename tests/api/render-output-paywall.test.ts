import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Hono } from 'hono';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { renderRoute } from '../../src/api/render';
import { closeDb, createApiKey, createUser, type Plan, updatePlan } from '../../src/db';
import { registerFonts } from '../../src/engine/fonts';
import { authMiddleware } from '../../src/middleware/auth';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = new Hono();
app.use('/render', authMiddleware());
app.route('/', renderRoute);

beforeAll(async () => {
  await registerFonts(join(__dirname, '..', '..', 'fonts'));
});

beforeEach(() => {
  closeDb();
  process.env.DATABASE_URL = 'file::memory:';
  process.env.WEBP_PAYWALL_ENABLED = 'true';
});

afterEach(() => {
  delete process.env.WEBP_PAYWALL_ENABLED;
});

afterAll(() => {
  closeDb();
  delete process.env.DATABASE_URL;
});

function keyForPlan(email: string, plan: Plan): string {
  const user = createUser(email);
  const record = createApiKey(user.id);
  if (plan !== 'free') updatePlan(user.id, plan);
  return record.key;
}

// Distinct titles keep the module-level image cache from serving one test's
// render to another.
function render(key: string, title: string, outputFormat: string) {
  return app.request('/render', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ format: 'og', title, output: { format: outputFormat } }),
  });
}

describe('output format paywall on POST /render', () => {
  it('returns 402 plan_required for webp on a free plan', async () => {
    const key = keyForPlan('free-webp@example.com', 'free');
    const res = await render(key, 'free webp', 'webp');

    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.error).toBe('plan_required');
    expect(body.details.outputFormat).toBe('webp');
    expect(body.details.currentPlan).toBe('free');
    expect(body.details.requiredPlans).toEqual(['starter', 'pro', 'scale']);
  });

  it('returns image/webp for webp on a starter plan', async () => {
    const key = keyForPlan('starter-webp@example.com', 'starter');
    const res = await render(key, 'starter webp', 'webp');

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/webp');
  });

  it('serves webp to a free plan again when the flag is off', async () => {
    delete process.env.WEBP_PAYWALL_ENABLED;
    const key = keyForPlan('flagoff-webp@example.com', 'free');
    const res = await render(key, 'flag off webp', 'webp');

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/webp');
  });

  it('leaves png ungated on a free plan', async () => {
    const key = keyForPlan('free-png@example.com', 'free');
    const res = await render(key, 'free png', 'png');

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/png');
  });

  // Per DECISIONS.md Decision 2, PDF is not one of the gated features.
  it('leaves pdf ungated on a free plan', async () => {
    const key = keyForPlan('free-pdf@example.com', 'free');
    const res = await render(key, 'free pdf', 'pdf');

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/pdf');
  });
});
