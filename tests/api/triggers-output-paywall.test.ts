import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Hono } from 'hono';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { triggersRoute } from '../../src/api/triggers';
import { closeDb, createApiKey, createUser, type Plan, updatePlan } from '../../src/db';
import { registerFonts } from '../../src/engine/fonts';
import { authMiddleware } from '../../src/middleware/auth';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = new Hono();
app.use('/triggers', authMiddleware());
app.use('/triggers/*', authMiddleware());
app.route('/', triggersRoute);

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

function keyForPlan(email: string, plan: Plan): { key: string; userId: string } {
  const user = createUser(email);
  const record = createApiKey(user.id);
  if (plan !== 'free') updatePlan(user.id, plan);
  return { key: record.key, userId: user.id };
}

function headers(key: string) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` };
}

// Unreachable on purpose — delivery failure is irrelevant, the render is what matters.
const CALLBACK = 'http://127.0.0.1:1/callback';

function register(key: string, outputFormat: string) {
  return app.request('/triggers', {
    method: 'POST',
    headers: headers(key),
    body: JSON.stringify({
      url: CALLBACK,
      renderConfig: { format: 'og', title: 'trigger card', output: { format: outputFormat } },
    }),
  });
}

describe('output format paywall on /triggers', () => {
  it('returns 402 when a free key registers a webp trigger', async () => {
    const { key } = keyForPlan('free-trigger@example.com', 'free');
    const res = await register(key, 'webp');

    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.error).toBe('plan_required');
    expect(body.details.outputFormat).toBe('webp');
  });

  it('lets a starter key register and fire a webp trigger', async () => {
    const { key } = keyForPlan('starter-trigger@example.com', 'starter');
    const created = await register(key, 'webp');
    expect(created.status).toBe(201);

    const { id } = await created.json();
    const fired = await app.request(`/triggers/${id}/fire`, {
      method: 'POST',
      headers: headers(key),
      body: '{}',
    });

    expect(fired.status).toBe(200);
    const body = await fired.json();
    expect(body.contentType).toBe('image/webp');
  });

  // The saved config outlives the plan that created it.
  it('returns 402 when firing a webp trigger after a downgrade to free', async () => {
    const { key, userId } = keyForPlan('downgraded-trigger@example.com', 'starter');
    const created = await register(key, 'webp');
    expect(created.status).toBe(201);
    const { id } = await created.json();

    updatePlan(userId, 'free');

    const fired = await app.request(`/triggers/${id}/fire`, {
      method: 'POST',
      headers: headers(key),
      body: '{}',
    });

    expect(fired.status).toBe(402);
    const body = await fired.json();
    expect(body.error).toBe('plan_required');
    expect(body.details.currentPlan).toBe('free');
  });

  it('leaves png triggers ungated on a free key', async () => {
    const { key } = keyForPlan('free-png-trigger@example.com', 'free');
    const created = await register(key, 'png');
    expect(created.status).toBe(201);

    const { id } = await created.json();
    const fired = await app.request(`/triggers/${id}/fire`, {
      method: 'POST',
      headers: headers(key),
      body: '{}',
    });

    expect(fired.status).toBe(200);
    expect((await fired.json()).contentType).toBe('image/png');
  });

  it('serves webp triggers to a free key again when the flag is off', async () => {
    delete process.env.WEBP_PAYWALL_ENABLED;
    const { key } = keyForPlan('flagoff-trigger@example.com', 'free');
    const created = await register(key, 'webp');

    expect(created.status).toBe(201);
  });
});
