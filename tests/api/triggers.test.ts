import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Hono } from 'hono';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { triggersRoute } from '../../src/api/triggers';
import { closeDb, createApiKey } from '../../src/db';
import { registerFonts } from '../../src/engine/fonts';
import { authMiddleware } from '../../src/middleware/auth';

const __dirname = dirname(fileURLToPath(import.meta.url));

beforeAll(async () => {
  await registerFonts(join(__dirname, '..', '..', 'fonts'));
});

beforeEach(() => {
  closeDb();
  process.env.DATABASE_URL = 'file::memory:';
});

afterAll(() => {
  closeDb();
  delete process.env.DATABASE_URL;
});

function createApp() {
  const app = new Hono();
  app.use('/triggers', authMiddleware());
  app.use('/triggers/*', authMiddleware());
  app.route('/', triggersRoute);
  return app;
}

describe('POST /triggers', () => {
  it('creates a webhook trigger', async () => {
    const record = createApiKey('trigger@example.com');
    const app = createApp();

    const res = await app.request('/triggers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${record.key}` },
      body: JSON.stringify({
        url: 'https://example.com/callback',
        renderConfig: { format: 'og', title: 'Trigger Test' },
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBeTruthy();
    expect(body.secret).toMatch(/^whsec_/);
    expect(body.url).toBe('https://example.com/callback');
  });

  it('returns 401 without auth', async () => {
    const app = createApp();
    const res = await app.request('/triggers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com', renderConfig: { format: 'og', title: 'X' } }),
    });
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid URL', async () => {
    const record = createApiKey('bad@example.com');
    const app = createApp();

    const res = await app.request('/triggers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${record.key}` },
      body: JSON.stringify({
        url: 'not-a-url',
        renderConfig: { format: 'og', title: 'X' },
      }),
    });
    expect(res.status).toBe(400);
  });
});

describe('GET /triggers', () => {
  it('lists webhook triggers', async () => {
    const record = createApiKey('list@example.com');
    const app = createApp();
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${record.key}` };

    await app.request('/triggers', {
      method: 'POST',
      headers,
      body: JSON.stringify({ url: 'https://a.com/cb', renderConfig: { format: 'og', title: 'A' } }),
    });

    const res = await app.request('/triggers', { headers });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.triggers).toHaveLength(1);
  });
});

describe('DELETE /triggers/:id', () => {
  it('deletes a trigger', async () => {
    const record = createApiKey('del@example.com');
    const app = createApp();
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${record.key}` };

    const createRes = await app.request('/triggers', {
      method: 'POST',
      headers,
      body: JSON.stringify({ url: 'https://x.com/cb', renderConfig: { format: 'og', title: 'X' } }),
    });
    const { id } = await createRes.json();

    const res = await app.request(`/triggers/${id}`, { method: 'DELETE', headers });
    expect(res.status).toBe(200);

    // Verify it's gone from list
    const listRes = await app.request('/triggers', { headers });
    const body = await listRes.json();
    expect(body.triggers).toHaveLength(0);
  });
});
