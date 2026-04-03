import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { registerFonts } from './engine/fonts';
import { healthRoute } from './api/health';
import { validateRoute } from './api/validate';
import { renderRoute } from './api/render';
import { join } from 'path';

const app = new Hono();

// CORS — allow playground and external clients
app.use('*', cors({
  origin: '*',
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['X-Render-Time-Ms', 'X-Title-Lines', 'X-Desc-Lines', 'X-Layout-Overflow'],
}));

// Mount routes
app.route('/', healthRoute);
app.route('/', validateRoute);
app.route('/', renderRoute);

// 404 fallback
app.notFound((c) => {
  return c.json({
    error: 'not_found',
    message: `No route matches ${c.req.method} ${c.req.path}`,
    docs: 'https://og-engine.com/api-reference/overview',
  }, 404);
});

// Global error handler
app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json({
    error: 'server_error',
    message: 'An unexpected error occurred.',
    docs: 'https://og-engine.com/api-reference/errors#server_error',
  }, 500);
});

// Start
const PORT = Number(process.env.PORT ?? 3000);
const FONTS_DIR = join(import.meta.dir, '..', 'fonts');

async function start() {
  await registerFonts(FONTS_DIR);
  console.log(`OG Engine listening on http://localhost:${PORT}`);
}

start();

export default {
  port: PORT,
  fetch: app.fetch,
};
