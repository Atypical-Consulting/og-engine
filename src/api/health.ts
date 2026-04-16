import { Hono } from 'hono';
import { FONTS } from '../engine/fonts';
import { FORMAT_KEYS } from '../engine/formats';
import { TEMPLATE_NAMES } from '../engine/templates';
import { getMeasureCacheStats } from '../engine/text-measure';

export const healthRoute = new Hono();

healthRoute.get('/health', (c) => {
  return c.json({
    status: 'ok',
    fonts: FONTS.map((f) => f.name),
    formats: FORMAT_KEYS,
    templates: TEMPLATE_NAMES,
    version: '0.1.0',
    cache: {
      textMeasure: getMeasureCacheStats(),
    },
  });
});
