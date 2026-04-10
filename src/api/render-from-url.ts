import { Hono } from 'hono';
import { z } from 'zod';
import { FONTS } from '../engine/fonts';
import { FORMAT_KEYS } from '../engine/formats';
import { GRADIENTS } from '../engine/gradients';
import { loadRemoteImages } from '../engine/image-loader';
import { extractMeta } from '../engine/meta-extract';
import { renderCard } from '../engine/renderer';
import { TEMPLATE_NAMES } from '../engine/templates';

const fontNames = FONTS.map((f) => f.name);
const gradientSlugs = GRADIENTS.map((g) => g.slug);
const formatEnum = z.enum(FORMAT_KEYS as [string, ...string[]]);

export const renderFromUrlSchema = z.object({
  url: z.string().url('A valid URL is required.'),
  format: formatEnum.default('og'),
  template: z
    .string()
    .refine((v) => TEMPLATE_NAMES.includes(v) || v.startsWith('custom:'), {
      message: `Template must be one of: ${TEMPLATE_NAMES.join(', ')}, or "custom:<name>"`,
    })
    .default('default'),
  style: z
    .object({
      accent: z
        .string()
        .regex(/^#[0-9a-fA-F]{6}$/)
        .default('#38ef7d'),
      layout: z.enum(['left', 'center', 'bottom']).default('left'),
      font: z
        .string()
        .refine((v) => fontNames.includes(v))
        .default('Outfit'),
      titleSize: z.number().int().min(28).max(72).default(48),
      descSize: z.number().int().min(14).max(32).default(22),
      gradient: z
        .string()
        .refine((v) => gradientSlugs.includes(v))
        .default('void'),
      overlayOpacity: z.number().min(0.2).max(0.9).default(0.65),
      autoFit: z.boolean().default(true),
    })
    .default({
      accent: '#38ef7d',
      layout: 'left',
      font: 'Outfit',
      titleSize: 48,
      descSize: 22,
      gradient: 'void',
      overlayOpacity: 0.65,
      autoFit: true,
    }),
  output: z
    .object({
      format: z.enum(['png', 'webp', 'pdf']).default('png'),
      quality: z.number().int().min(1).max(100).default(90),
    })
    .default({
      format: 'png',
      quality: 90,
    }),
});

export const renderFromUrlRoute = new Hono();

const FETCH_TIMEOUT_MS = 8_000;

renderFromUrlRoute.post('/render/from-url', async (c) => {
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

  const parsed = renderFromUrlSchema.safeParse(raw);
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

  // Fetch the URL
  let html: string;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(data.url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'OGEngine/1.0 (og-engine.com)' },
    });
    clearTimeout(timer);

    if (!res.ok) {
      return c.json(
        {
          error: 'fetch_failed',
          message: `Could not fetch URL: HTTP ${res.status}`,
          docs: 'https://og-engine.com/api-reference/errors#fetch_failed',
        },
        422,
      );
    }
    html = await res.text();
  } catch (err) {
    return c.json(
      {
        error: 'fetch_failed',
        message: `Could not fetch URL: ${err instanceof Error ? err.message : 'timeout or network error'}`,
        docs: 'https://og-engine.com/api-reference/errors#fetch_failed',
      },
      422,
    );
  }

  // Extract meta tags
  const meta = extractMeta(html);

  if (!meta.variables.title) {
    return c.json(
      {
        error: 'no_content',
        message: 'No title found on the page (checked og:title, twitter:title, <title>).',
        docs: 'https://og-engine.com/api-reference/errors#no_content',
      },
      422,
    );
  }

  // Fetch images from extracted URLs
  const namedImages = Object.keys(meta.images).length > 0 ? await loadRemoteImages(meta.images) : {};

  const t0 = performance.now();

  const result = await renderCard({
    title: meta.variables.title,
    description: meta.variables.description ?? '',
    author: meta.variables.author ?? '',
    tag: meta.variables.tag ?? '',
    variables: meta.variables,
    namedImages,
    format: data.format,
    template: data.template,
    accent: data.style.accent,
    layout: data.style.layout,
    titleSize: data.style.titleSize,
    descSize: data.style.descSize,
    fontName: data.style.font,
    gradient: data.style.gradient,
    bgImageBuffer: null,
    overlayOpacity: data.style.overlayOpacity,
    autoFit: data.style.autoFit,
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
    'X-Source-URL': data.url,
    'X-Cache': 'miss',
  };

  return new Response(new Uint8Array(result.buffer), { status: 200, headers });
});
