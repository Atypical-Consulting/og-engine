import { Hono } from 'hono';
import { type ApiKeyRecord, findCustomTemplate } from '../db';
import type { CustomTemplateDefinition } from '../engine/custom-template';
import { getCachedImage, hashRequest, setCachedImage } from '../engine/image-cache';
import { renderCard } from '../engine/renderer';
import { renderSchema } from '../schemas/request';

export const renderRoute = new Hono();

renderRoute.post('/render', async (c) => {
  const contentType = c.req.header('content-type') ?? '';

  let raw: Record<string, unknown> | null = null;
  let bgImageBuffer: Buffer | null = null;

  if (contentType.includes('multipart/form-data')) {
    // Multipart: supports background image upload
    const form = await c.req.formData().catch(() => null);
    if (!form) {
      return c.json(
        {
          error: 'invalid_request',
          message: 'Could not parse multipart form data.',
          docs: 'https://og-engine.com/api-reference/errors#invalid_request',
        },
        400,
      );
    }

    const jsonField = form.get('data') ?? form.get('json');
    if (!jsonField || typeof jsonField !== 'string') {
      return c.json(
        {
          error: 'invalid_request',
          message: 'Multipart request must include a "data" field with JSON.',
          docs: 'https://og-engine.com/api-reference/errors#invalid_request',
        },
        400,
      );
    }

    try {
      raw = JSON.parse(jsonField);
    } catch {
      return c.json(
        {
          error: 'invalid_request',
          message: 'The "data" field must contain valid JSON.',
          docs: 'https://og-engine.com/api-reference/errors#invalid_request',
        },
        400,
      );
    }

    const bgFile = form.get('backgroundImage') ?? form.get('background');
    if (bgFile && bgFile instanceof File) {
      const ab = await bgFile.arrayBuffer();
      bgImageBuffer = Buffer.from(ab);
    }
  } else {
    raw = await c.req.json().catch(() => null);
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
  }

  const parsed = renderSchema.safeParse(raw);
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

  const data = parsed.data;

  // Check image cache (only for JSON requests without background image)
  if (!bgImageBuffer) {
    const cacheKey = hashRequest(data);
    const cached = getCachedImage(cacheKey);
    if (cached) {
      return new Response(new Uint8Array(cached.buffer), {
        status: 200,
        headers: { ...cached.headers, 'X-Cache': 'hit' },
      });
    }
  }

  // Resolve custom template if template starts with "custom:"
  let customTemplateDefinition: CustomTemplateDefinition | undefined;
  if (data.template.startsWith('custom:')) {
    const apiKeyRecord = c.get('apiKey' as never) as ApiKeyRecord | undefined;
    if (!apiKeyRecord) {
      return c.json(
        {
          error: 'unauthorized',
          message: 'Custom templates require authentication.',
          docs: 'https://og-engine.com/api-reference/errors#unauthorized',
        },
        401,
      );
    }
    const customName = data.template.slice(7); // strip "custom:"
    const tmpl = findCustomTemplate(apiKeyRecord.id, customName);
    if (!tmpl) {
      return c.json(
        {
          error: 'not_found',
          message: `Custom template "${customName}" not found.`,
          docs: 'https://og-engine.com/api-reference/errors#not_found',
        },
        404,
      );
    }
    customTemplateDefinition = JSON.parse(tmpl.definition);
  }

  const t0 = performance.now();

  const result = await renderCard({
    title: data.title,
    description: data.description,
    author: data.author,
    tag: data.tag,
    format: data.format,
    template: data.template,
    accent: data.style.accent,
    layout: data.style.layout,
    titleSize: data.style.titleSize,
    descSize: data.style.descSize,
    fontName: data.style.font,
    gradient: data.style.gradient,
    bgImageBuffer,
    overlayOpacity: data.style.overlayOpacity,
    autoFit: data.style.autoFit,
    customTemplateDefinition,
    outputFormat: data.output.format,
    outputQuality: data.output.quality,
  });

  const renderTimeMs = (performance.now() - t0).toFixed(2);

  const headers: Record<string, string> = {
    'Content-Type': result.contentType,
    'X-Render-Time-Ms': renderTimeMs,
    'X-Title-Lines': String(result.titleVisibleLines),
    'X-Desc-Lines': String(result.descVisibleLines),
    'X-Layout-Overflow': String(result.overflow),
    'X-Cache': 'miss',
  };

  // Cache the rendered image (only for JSON requests without background image)
  if (!bgImageBuffer) {
    const cacheKey = hashRequest(data);
    setCachedImage(cacheKey, { buffer: result.buffer, contentType: result.contentType, headers });
  }

  return new Response(new Uint8Array(result.buffer), { status: 200, headers });
});
