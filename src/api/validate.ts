import { Hono } from 'hono';
import { autoFitCard } from '../engine/autofit';
import { getFontByName } from '../engine/fonts';
import { FORMATS } from '../engine/formats';
import { measureLines } from '../engine/text-measure';
import { validateSchema } from '../schemas/request';

export const validateRoute = new Hono();

validateRoute.post('/validate', async (c) => {
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

  const parsed = validateSchema.safeParse(raw);
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
  const t0 = performance.now();

  // If autoFit requested, return optimal sizes
  if (data.autoFit) {
    const fitted = autoFitCard({
      title: data.title,
      description: data.description,
      format: data.format,
      fontName: data.font,
      titleSizeRange: [28, data.titleSize],
      descSizeRange: [14, data.descSize],
      maxTitleLines: data.maxTitleLines,
      maxDescLines: data.maxDescLines,
    });

    const computeTimeMs = Number((performance.now() - t0).toFixed(2));

    return c.json({
      fits: true,
      autoFit: {
        titleSize: fitted.titleSize,
        descSize: fitted.descSize,
      },
      title: {
        lines: fitted.titleLines,
        maxLines: data.maxTitleLines ?? FORMATS[data.format].maxTitleLines,
        overflow: false,
      },
      ...(data.description
        ? {
            description: {
              lines: fitted.descLines,
              maxLines: data.maxDescLines ?? FORMATS[data.format].maxDescLines,
              overflow: false,
            },
          }
        : {}),
      computeTimeMs,
    });
  }

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
  let descResult: { lines: number; maxLines: number; overflow: boolean } | undefined;
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
  const fits = !titleOverflow && !descResult?.overflow;

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
