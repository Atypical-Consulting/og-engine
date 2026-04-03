import { Hono } from 'hono';
import { validateSchema } from '../schemas/request';
import { measureLines } from '../engine/text-measure';
import { getFontByName } from '../engine/fonts';
import { FORMATS } from '../engine/formats';

export const validateRoute = new Hono();

validateRoute.post('/validate', async (c) => {
  const raw = await c.req.json().catch(() => null);
  if (!raw) {
    return c.json({
      error: 'invalid_request',
      message: 'Request body must be valid JSON.',
      docs: 'https://og-engine.com/api-reference/errors#invalid_request',
    }, 400);
  }

  const parsed = validateSchema.safeParse(raw);
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

  const fmt = FORMATS[data.format];
  const fontEntry = getFontByName(data.font);
  const ff = fontEntry.family;
  const s = Math.max(fmt.w, fmt.h) / 1200;
  const px = Math.round(64 * s);
  const cW = fmt.w - px * 2;

  // Title measurement
  const tFont = `800 ${Math.round(data.titleSize * s)}px ${ff}`;
  const tLines = measureLines(data.title, tFont, cW);
  const maxT = data.maxTitleLines ?? fmt.maxTitleLines;
  const titleOverflow = tLines.length > maxT;

  // Description measurement
  let descResult = undefined;
  if (data.description) {
    const dFont = `400 ${Math.round(data.descSize * s)}px ${ff}`;
    const dLines = measureLines(data.description, dFont, cW);
    const maxD = data.maxDescLines ?? fmt.maxDescLines;
    const descOverflow = dLines.length > maxD;
    descResult = {
      lines: dLines.length,
      maxLines: maxD,
      overflow: descOverflow,
    };
  }

  const computeTimeMs = Number((performance.now() - t0).toFixed(2));
  const fits = !titleOverflow && (!descResult || !descResult.overflow);

  return c.json({
    fits,
    title: {
      lines: tLines.length,
      maxLines: maxT,
      overflow: titleOverflow,
    },
    ...(descResult ? { description: descResult } : {}),
    computeTimeMs,
  });
});
