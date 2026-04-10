import { Hono } from 'hono';
import type { SessionRecord, UserRecord } from '../db/index';
import {
  createApiKey,
  createCustomTemplate,
  createWebhook,
  deactivateApiKey,
  deleteCustomTemplate,
  deleteWebhook,
  getDailyUsage,
  getDb,
  getRenderHistory,
  getRenderHistoryById,
  getUsageStats,
  listApiKeysByUserId,
  listCustomTemplatesByUser,
  listWebhooksByUser,
  regenerateApiKey,
} from '../db/index';
import { renderCard } from '../engine/renderer';
import { renderShell } from './layouts/shell';
import { apiKeyRow, apiKeysView } from './views/api-keys';
import { billingView } from './views/billing';
import { imagesView } from './views/images';
import { overviewView } from './views/overview';
import { settingsView } from './views/settings';
import { templatesView } from './views/templates';
import { usageView } from './views/usage';
import { webhooksView } from './views/webhooks';

export const dashboardRoutes = new Hono();

function isHtmx(c: any): boolean {
  return c.req.header('HX-Request') === 'true';
}

function respond(c: any, title: string, path: string, content: string): Response {
  if (isHtmx(c)) {
    return c.html(content);
  }
  const user = c.get('user' as never) as UserRecord;
  const session = c.get('session' as never) as SessionRecord;
  return c.html(renderShell({ user, session, title, activePath: path, content }));
}

dashboardRoutes.get('/dashboard', (c) => {
  const user = c.get('user' as never) as UserRecord;

  // Fetch recent renders
  const recentRenders = getRenderHistory(user.id, { limit: 10, offset: 0 });

  // Calculate avg render time from last 7 days
  const d = getDb();
  const avgRow = d
    .prepare(
      `SELECT AVG(render_time_ms) as avg_ms
       FROM render_history
       WHERE user_id = ? AND render_time_ms IS NOT NULL
         AND created_at >= datetime('now', '-7 days')`,
    )
    .get(user.id) as { avg_ms: number | null } | null;

  const avgRenderTime = avgRow?.avg_ms ?? 0;

  const content = overviewView({ user, avgRenderTime, recentRenders });
  return respond(c, 'Overview', '/dashboard', content);
});

// ─── Images ───────────────────────────────────────────────────

dashboardRoutes.get('/dashboard/images', (c) => {
  const user = c.get('user' as never) as UserRecord;
  const offset = Math.max(0, parseInt(c.req.query('offset') ?? '0', 10) || 0);
  const limit = 20;

  const renders = getRenderHistory(user.id, { limit: limit + 1, offset });
  const hasMore = renders.length > limit;
  if (hasMore) renders.pop();

  const content = imagesView({ renders, hasMore, offset });

  // For infinite scroll (offset > 0), return just rows
  if (offset > 0) {
    return c.html(content);
  }
  return respond(c, 'Images', '/dashboard/images', content);
});

dashboardRoutes.post('/dashboard/images/:id/render', async (c) => {
  const user = c.get('user' as never) as UserRecord;
  const id = c.req.param('id');

  const record = getRenderHistoryById(id);
  if (!record || record.user_id !== user.id) {
    return c.html('<span class="badge" style="background:var(--danger)">Not found</span>', 404);
  }

  try {
    const payload = JSON.parse(record.request_payload);
    const result = await renderCard({
      title: payload.title ?? '',
      description: payload.description ?? '',
      author: payload.author ?? '',
      tag: payload.tag ?? '',
      format: payload.format ?? 'og',
      template: payload.template ?? 'default',
      accent: payload.style?.accent ?? '#38ef7d',
      layout: payload.style?.layout ?? 'left',
      titleSize: payload.style?.titleSize ?? 48,
      descSize: payload.style?.descSize ?? 22,
      fontName: payload.style?.font ?? 'Outfit',
      gradient: payload.style?.gradient ?? 'void',
      bgImageBuffer: null,
      overlayOpacity: payload.style?.overlayOpacity ?? 0.65,
      autoFit: false,
      outputFormat: payload.output?.format ?? 'png',
      outputQuality: payload.output?.quality ?? 90,
      variables: payload.variables,
      namedImages: undefined,
    });

    return new Response(new Uint8Array(result.buffer), {
      headers: {
        'Content-Type': result.contentType,
        'Content-Disposition': `attachment; filename="render-${id}.${payload.output?.format ?? 'png'}"`,
        'X-Render-Time-Ms': result.phases?.totalMs?.toFixed(2) ?? '0',
      },
    });
  } catch {
    return c.html('<span class="badge" style="background:var(--danger)">Render failed</span>', 500);
  }
});

// ─── API Keys ─────────────────────────────────────────────────

dashboardRoutes.get('/dashboard/api-keys', (c) => {
  const user = c.get('user' as never) as UserRecord;
  const keys = listApiKeysByUserId(user.id);
  const content = apiKeysView(keys);
  return respond(c, 'API Keys', '/dashboard/api-keys', content);
});

dashboardRoutes.post('/dashboard/api-keys', (c) => {
  const user = c.get('user' as never) as UserRecord;
  const key = createApiKey(user.id);
  return c.html(apiKeyRow(key, true));
});

dashboardRoutes.post('/dashboard/api-keys/:id/regenerate', (c) => {
  const user = c.get('user' as never) as UserRecord;
  const id = c.req.param('id');

  const keys = listApiKeysByUserId(user.id);
  const owned = keys.find((k) => k.id === id);
  if (!owned) {
    return c.html('<span class="badge" style="background:var(--danger)">Not found</span>', 404);
  }

  const updated = regenerateApiKey(id);
  return c.html(apiKeyRow(updated, true));
});

dashboardRoutes.delete('/dashboard/api-keys/:id', (c) => {
  const user = c.get('user' as never) as UserRecord;
  const id = c.req.param('id');

  const keys = listApiKeysByUserId(user.id);
  const owned = keys.find((k) => k.id === id);
  if (!owned) {
    return c.html('<span class="badge" style="background:var(--danger)">Not found</span>', 404);
  }

  deactivateApiKey(id);
  return c.html('');
});

// ─── Billing ──────────────────────────────────────────────────

dashboardRoutes.get('/dashboard/billing', (c) => {
  const user = c.get('user' as never) as UserRecord;
  const portalAvailable = !!user.stripe_customer_id && !!process.env.STRIPE_SECRET_KEY;
  const content = billingView(user, portalAvailable);
  return respond(c, 'Billing', '/dashboard/billing', content);
});

// ─── Usage ────────────────────────────────────────────────────

dashboardRoutes.get('/dashboard/usage', (c) => {
  const user = c.get('user' as never) as UserRecord;
  const days = Math.min(90, Math.max(1, parseInt(c.req.query('days') ?? '30', 10) || 30));
  const daily = getDailyUsage(user.id, days);
  const stats = getUsageStats(user.id);
  const content = usageView({
    user,
    daily,
    byEndpoint: stats.byEndpoint,
    byFormat: stats.byFormat,
    total: stats.total,
    days,
  });
  return respond(c, 'Usage', '/dashboard/usage', content);
});

// ─── Templates ────────────────────────────────────────────────

dashboardRoutes.get('/dashboard/templates', (c) => {
  const user = c.get('user' as never) as UserRecord;
  const templates = listCustomTemplatesByUser(user.id);
  const content = templatesView(user, templates);
  return respond(c, 'Templates', '/dashboard/templates', content);
});

dashboardRoutes.post('/dashboard/templates', async (c) => {
  const user = c.get('user' as never) as UserRecord;
  if (user.plan !== 'scale') {
    return c.html('<span class="badge" style="background:var(--danger)">Scale plan required</span>', 403);
  }

  const body = await c.req.parseBody();
  const name = ((body.name as string) ?? '').trim();
  const definitionStr = ((body.definition as string) ?? '').trim();

  if (!name || !definitionStr) {
    return c.html('<span class="badge" style="background:var(--danger)">Name and definition required</span>', 400);
  }

  let definition: object;
  try {
    definition = JSON.parse(definitionStr);
  } catch {
    return c.html('<span class="badge" style="background:var(--danger)">Invalid JSON</span>', 400);
  }

  // Find user's first api key to associate template
  const keys = listApiKeysByUserId(user.id);
  if (keys.length === 0) {
    return c.html('<span class="badge" style="background:var(--danger)">Create an API key first</span>', 400);
  }

  createCustomTemplate(keys[0].id, name, definition);
  const templates = listCustomTemplatesByUser(user.id);
  const content = templatesView(user, templates);
  return c.html(content);
});

dashboardRoutes.delete('/dashboard/templates/:id', (c) => {
  const user = c.get('user' as never) as UserRecord;
  const id = c.req.param('id');

  const templates = listCustomTemplatesByUser(user.id);
  const owned = templates.find((t) => t.id === id);
  if (!owned) {
    return c.html('<span class="badge" style="background:var(--danger)">Not found</span>', 404);
  }

  deleteCustomTemplate(id);
  return c.html('');
});

// ─── Webhooks ─────────────────────────────────────────────────

dashboardRoutes.get('/dashboard/webhooks', (c) => {
  const user = c.get('user' as never) as UserRecord;
  const webhooks = listWebhooksByUser(user.id);
  const content = webhooksView(webhooks);
  return respond(c, 'Webhooks', '/dashboard/webhooks', content);
});

dashboardRoutes.post('/dashboard/webhooks', async (c) => {
  const user = c.get('user' as never) as UserRecord;
  const body = await c.req.parseBody();
  const url = ((body.url as string) ?? '').trim();
  const configStr = ((body.render_config as string) ?? '{}').trim();

  if (!url) {
    return c.html('<span class="badge" style="background:var(--danger)">URL required</span>', 400);
  }

  let renderConfig: object;
  try {
    renderConfig = JSON.parse(configStr);
  } catch {
    return c.html('<span class="badge" style="background:var(--danger)">Invalid JSON config</span>', 400);
  }

  const keys = listApiKeysByUserId(user.id);
  if (keys.length === 0) {
    return c.html('<span class="badge" style="background:var(--danger)">Create an API key first</span>', 400);
  }

  createWebhook(keys[0].id, url, renderConfig);
  const webhooks = listWebhooksByUser(user.id);
  const content = webhooksView(webhooks);
  return c.html(content);
});

dashboardRoutes.post('/dashboard/webhooks/:id/test', async (c) => {
  const user = c.get('user' as never) as UserRecord;
  const id = c.req.param('id');

  const webhooks = listWebhooksByUser(user.id);
  const owned = webhooks.find((w) => w.id === id);
  if (!owned) {
    return c.html('<span class="badge" style="background:var(--danger)">Not found</span>', 404);
  }

  try {
    const resp = await fetch(owned.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'test', webhook_id: id }),
      signal: AbortSignal.timeout(10_000),
    });
    const status = resp.status;
    const color = status >= 200 && status < 300 ? 'var(--success, #38ef7d)' : 'var(--danger, #e74c3c)';
    return c.html(`<span class="badge" style="background:${color}">HTTP ${status}</span>`);
  } catch {
    return c.html('<span class="badge" style="background:var(--danger)">Connection failed</span>');
  }
});

dashboardRoutes.delete('/dashboard/webhooks/:id', (c) => {
  const user = c.get('user' as never) as UserRecord;
  const id = c.req.param('id');

  const webhooks = listWebhooksByUser(user.id);
  const owned = webhooks.find((w) => w.id === id);
  if (!owned) {
    return c.html('<span class="badge" style="background:var(--danger)">Not found</span>', 404);
  }

  deleteWebhook(id);
  return c.html('');
});

// ─── Settings ─────────────────────────────────────────────────

dashboardRoutes.get('/dashboard/settings', (c) => {
  const user = c.get('user' as never) as UserRecord;
  const content = settingsView(user);
  return respond(c, 'Settings', '/dashboard/settings', content);
});

dashboardRoutes.delete('/dashboard/account', async (c) => {
  const user = c.get('user' as never) as UserRecord;
  const d = getDb();

  // Cancel Stripe subscription if exists
  if (user.stripe_subscription_id && process.env.STRIPE_SECRET_KEY) {
    try {
      const Stripe = (await import('stripe')).default;
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
      await stripe.subscriptions.cancel(user.stripe_subscription_id);
    } catch {
      // Best effort — continue with deletion
    }
  }

  // Deactivate user
  d.prepare('UPDATE users SET active = 0 WHERE id = ?').run(user.id);

  // Deactivate all api keys
  d.prepare('UPDATE api_keys SET active = 0 WHERE user_id = ?').run(user.id);

  // Delete all sessions
  d.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);

  // Clear cookie and redirect
  return c.html('', 200, {
    'Set-Cookie': 'session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax',
    'HX-Redirect': '/',
  });
});
