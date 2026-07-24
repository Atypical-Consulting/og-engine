import { Hono } from 'hono';
import pkg from '../../package.json' with { type: 'json' };
import { FONTS } from '../engine/fonts';
import { FORMAT_KEYS } from '../engine/formats';
import { TEMPLATE_NAMES } from '../engine/templates';

export const healthRoute = new Hono();

healthRoute.get('/health', (c) => {
  return c.json({
    status: 'ok',
    fonts: FONTS.map((f) => f.name),
    formats: FORMAT_KEYS,
    templates: TEMPLATE_NAMES,
    version: pkg.version,
  });
});
