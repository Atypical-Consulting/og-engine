import { Hono } from 'hono';
import {
  type ApiKeyRecord,
  createCustomTemplate,
  deleteCustomTemplate,
  findCustomTemplate,
  listCustomTemplates,
  updateCustomTemplate,
} from '../db';
import { customTemplateSchema } from '../engine/custom-template';
import { authMiddleware } from '../middleware/auth';

export const templatesRoute = new Hono();

templatesRoute.post('/templates', authMiddleware(), async (c) => {
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

  const parsed = customTemplateSchema.safeParse(raw);
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

  const { name, layers } = parsed.data;

  // Check if template name already exists for this user
  const existing = findCustomTemplate(record.id, name);
  if (existing) {
    updateCustomTemplate(existing.id, { name, layers });
    return c.json({
      id: existing.id,
      name,
      layerCount: layers.length,
      message: 'Template updated.',
    });
  }

  const tmpl = createCustomTemplate(record.id, name, { name, layers });
  return c.json(
    {
      id: tmpl.id,
      name,
      layerCount: layers.length,
      message: 'Template created.',
    },
    201,
  );
});

templatesRoute.get('/templates', authMiddleware(), async (c) => {
  const record = c.get('apiKey' as never) as ApiKeyRecord | undefined;
  if (!record) {
    return c.json({ error: 'unauthorized', message: 'API key required.' }, 401);
  }

  const templates = listCustomTemplates(record.id);
  return c.json({
    templates: templates.map((t) => {
      const def = JSON.parse(t.definition);
      return {
        id: t.id,
        name: t.name,
        layerCount: def.layers?.length ?? 0,
        createdAt: t.created_at,
        updatedAt: t.updated_at,
      };
    }),
  });
});

templatesRoute.delete('/templates/:id', authMiddleware(), async (c) => {
  const record = c.get('apiKey' as never) as ApiKeyRecord | undefined;
  if (!record) {
    return c.json({ error: 'unauthorized', message: 'API key required.' }, 401);
  }

  const id = c.req.param('id') as string;
  deleteCustomTemplate(id);
  return c.json({ message: 'Template deleted.' });
});
