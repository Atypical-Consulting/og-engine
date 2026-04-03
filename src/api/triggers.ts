import { Hono } from 'hono';
import { z } from 'zod';
import { type ApiKeyRecord, createWebhook, deleteWebhook, findWebhookById, listWebhooks } from '../db';
import { renderCard } from '../engine/renderer';
import { renderSchema } from '../schemas/request';

export const triggersRoute = new Hono();

const createWebhookSchema = z.object({
  url: z.string().url('A valid callback URL is required.'),
  renderConfig: renderSchema,
});

/**
 * POST /triggers — register a webhook trigger.
 * When the trigger fires (POST /triggers/:id/fire), we re-render using the saved config
 * and POST the resulting image to the callback URL.
 */
triggersRoute.post('/triggers', async (c) => {
  const record = c.get('apiKey' as never) as ApiKeyRecord | undefined;
  if (!record) {
    return c.json({ error: 'unauthorized', message: 'API key required.' }, 401);
  }

  const raw = await c.req.json().catch(() => null);
  if (!raw) {
    return c.json(
      {
        error: 'invalid_request',
        message: 'Request body must be valid JSON.',
        docs: 'https://og-engine.com/api-reference/errors#invalid_request',
      },
      400,
    );
  }

  const parsed = createWebhookSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => ({
      field: i.path.join('.'),
      message: i.message,
    }));
    return c.json(
      {
        error: 'invalid_request',
        message: issues[0]?.message ?? 'Validation failed.',
        details: { fields: issues },
        docs: 'https://og-engine.com/api-reference/errors#invalid_request',
      },
      400,
    );
  }

  const { url, renderConfig } = parsed.data;
  const webhook = createWebhook(record.id, url, renderConfig);

  return c.json(
    {
      id: webhook.id,
      url: webhook.url,
      secret: webhook.secret,
      message: 'Webhook trigger created. Fire it with POST /triggers/:id/fire.',
    },
    201,
  );
});

/**
 * GET /triggers — list all webhook triggers for the authenticated user.
 */
triggersRoute.get('/triggers', async (c) => {
  const record = c.get('apiKey' as never) as ApiKeyRecord | undefined;
  if (!record) {
    return c.json({ error: 'unauthorized', message: 'API key required.' }, 401);
  }

  const webhooks = listWebhooks(record.id);
  return c.json({
    triggers: webhooks.map((w) => ({
      id: w.id,
      url: w.url,
      createdAt: w.created_at,
    })),
  });
});

/**
 * DELETE /triggers/:id — deactivate a webhook trigger.
 */
triggersRoute.delete('/triggers/:id', async (c) => {
  const record = c.get('apiKey' as never) as ApiKeyRecord | undefined;
  if (!record) {
    return c.json({ error: 'unauthorized', message: 'API key required.' }, 401);
  }

  const id = c.req.param('id');
  const webhook = findWebhookById(id);
  if (!webhook || webhook.api_key_id !== record.id) {
    return c.json({ error: 'not_found', message: 'Trigger not found.' }, 404);
  }

  deleteWebhook(id);
  return c.json({ message: 'Trigger deleted.' });
});

/**
 * POST /triggers/:id/fire — fire a webhook trigger.
 * Re-renders the image using saved config (with optional content overrides)
 * and POSTs the result to the callback URL.
 *
 * Body (optional): { "title": "new title", "description": "new desc" }
 * These override the saved renderConfig values.
 */
triggersRoute.post('/triggers/:id/fire', async (c) => {
  const record = c.get('apiKey' as never) as ApiKeyRecord | undefined;
  if (!record) {
    return c.json({ error: 'unauthorized', message: 'API key required.' }, 401);
  }

  const id = c.req.param('id');
  const webhook = findWebhookById(id);
  if (!webhook || webhook.api_key_id !== record.id || !webhook.active) {
    return c.json({ error: 'not_found', message: 'Trigger not found.' }, 404);
  }

  // Parse optional content overrides
  const overrides = (await c.req.json().catch(() => ({}))) as Record<string, string>;
  const savedConfig = JSON.parse(webhook.render_config);

  // Merge overrides
  const config = {
    ...savedConfig,
    ...(overrides.title ? { title: overrides.title } : {}),
    ...(overrides.description ? { description: overrides.description } : {}),
    ...(overrides.author ? { author: overrides.author } : {}),
    ...(overrides.tag ? { tag: overrides.tag } : {}),
  };

  // Render
  const result = await renderCard({
    title: config.title,
    description: config.description ?? '',
    author: config.author ?? '',
    tag: config.tag ?? '',
    format: config.format,
    template: config.template ?? 'default',
    accent: config.style?.accent ?? '#38ef7d',
    layout: config.style?.layout ?? 'left',
    titleSize: config.style?.titleSize ?? 48,
    descSize: config.style?.descSize ?? 22,
    fontName: config.style?.font ?? 'Outfit',
    gradient: config.style?.gradient ?? 'void',
    bgImageBuffer: null,
    overlayOpacity: config.style?.overlayOpacity ?? 0.65,
    autoFit: config.style?.autoFit ?? false,
    outputFormat: config.output?.format ?? 'png',
    outputQuality: config.output?.quality ?? 90,
  });

  // Deliver to callback URL (fire-and-forget with error capture)
  let deliveryStatus = 'delivered';
  let deliveryError: string | undefined;

  try {
    const callbackRes = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': result.contentType,
        'X-Webhook-Id': webhook.id,
        'X-Webhook-Secret': webhook.secret,
        'X-Render-Time-Ms': '0',
      },
      body: new Uint8Array(result.buffer),
    });

    if (!callbackRes.ok) {
      deliveryStatus = 'failed';
      deliveryError = `Callback returned ${callbackRes.status}`;
    }
  } catch (err) {
    deliveryStatus = 'failed';
    deliveryError = err instanceof Error ? err.message : 'Unknown error';
  }

  return c.json({
    triggered: true,
    deliveryStatus,
    ...(deliveryError ? { deliveryError } : {}),
    imageSize: result.buffer.length,
    contentType: result.contentType,
  });
});
