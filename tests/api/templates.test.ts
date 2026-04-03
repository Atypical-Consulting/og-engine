import { Hono } from 'hono';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { templatesRoute } from '../../src/api/templates';
import { closeDb, createApiKey } from '../../src/db';
import { authMiddleware } from '../../src/middleware/auth';

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
  app.use('/templates', authMiddleware());
  app.use('/templates/*', authMiddleware());
  app.route('/', templatesRoute);
  return app;
}

describe('POST /templates', () => {
  it('creates a custom template', async () => {
    const record = createApiKey('tmpl@example.com');
    const app = createApp();

    const res = await app.request('/templates', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${record.key}`,
      },
      body: JSON.stringify({
        name: 'my-card',
        layers: [
          { type: 'fill', color: '#000000' },
          { type: 'text', content: '{{title}}', fontSize: 48, x: 64, y: 100, width: 1072 },
        ],
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.name).toBe('my-card');
    expect(body.layerCount).toBe(2);
  });

  it('updates existing template on duplicate name', async () => {
    const record = createApiKey('tmpl2@example.com');
    const app = createApp();
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${record.key}` };

    await app.request('/templates', {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: 'dup', layers: [{ type: 'fill', color: '#000' }] }),
    });

    const res = await app.request('/templates', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'dup',
        layers: [
          { type: 'fill', color: '#fff' },
          { type: 'fill', color: '#000' },
        ],
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.layerCount).toBe(2);
    expect(body.message).toBe('Template updated.');
  });

  it('returns 401 without auth', async () => {
    const app = createApp();
    const res = await app.request('/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'x', layers: [{ type: 'fill', color: '#000' }] }),
    });
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid layer type', async () => {
    const record = createApiKey('bad@example.com');
    const app = createApp();

    const res = await app.request('/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${record.key}` },
      body: JSON.stringify({ name: 'bad', layers: [{ type: 'invalid' }] }),
    });
    expect(res.status).toBe(400);
  });
});

describe('GET /templates', () => {
  it('lists created templates', async () => {
    const record = createApiKey('list@example.com');
    const app = createApp();
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${record.key}` };

    await app.request('/templates', {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: 'a', layers: [{ type: 'fill', color: '#000' }] }),
    });
    await app.request('/templates', {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: 'b', layers: [{ type: 'fill', color: '#fff' }] }),
    });

    const res = await app.request('/templates', { headers });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.templates).toHaveLength(2);
  });
});
