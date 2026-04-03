import { Hono } from 'hono';
import { renderSchema } from '../schemas/request';
import { renderCard } from '../engine/renderer';

export const renderRoute = new Hono();

renderRoute.post('/render', async (c) => {
  const raw = await c.req.json().catch(() => null);
  if (!raw) {
    return c.json({
      error: 'invalid_request',
      message: 'Request body must be valid JSON.',
      docs: 'https://og-engine.com/api-reference/errors#invalid_request',
    }, 400);
  }

  const parsed = renderSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => ({
      field: i.path.join('.'),
      message: i.message,
    }));
    return c.json({
      error: 'invalid_request',
      message: issues[0]?.message ?? 'Validation failed.',
      details: { fields: issues },
      docs: 'https://og-engine.com/api-reference/errors#invalid_request',
    }, 400);
  }

  const data = parsed.data;
  const t0 = performance.now();

  const result = renderCard({
    title: data.title,
    description: data.description,
    author: data.author,
    tag: data.tag,
    format: data.format,
    accent: data.style.accent,
    layout: data.style.layout,
    titleSize: data.style.titleSize,
    descSize: data.style.descSize,
    fontName: data.style.font,
    gradient: data.style.gradient,
    bgImageBuffer: null,
    overlayOpacity: data.style.overlayOpacity,
  });

  const renderTimeMs = (performance.now() - t0).toFixed(2);

  return new Response(new Uint8Array(result.buffer), {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'X-Render-Time-Ms': renderTimeMs,
      'X-Title-Lines': String(result.titleVisibleLines),
      'X-Desc-Lines': String(result.descVisibleLines),
      'X-Layout-Overflow': String(result.overflow),
    },
  });
});
