import { Hono } from 'hono';
import { FONTS } from '../engine/fonts';
import { FORMAT_KEYS } from '../engine/formats';

export const healthRoute = new Hono();

const TEMPLATES = ['default', 'social-card', 'blog-hero', 'email-banner'];

healthRoute.get('/health', (c) => {
  return c.json({
    status: 'ok',
    fonts: FONTS.map((f) => f.name),
    formats: FORMAT_KEYS,
    templates: TEMPLATES,
    version: '0.1.0',
  });
});
