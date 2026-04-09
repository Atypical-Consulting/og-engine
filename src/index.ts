import { join } from 'node:path';
import { Hono } from 'hono';
import { serveStatic } from 'hono/bun';
import { cors } from 'hono/cors';
import { adminRoute } from './api/admin';
import { batchRoute } from './api/batch';
import { billingRoute } from './api/billing';
import { healthRoute } from './api/health';
import { registerRoute } from './api/register';
import { renderRoute } from './api/render';
import { templatesRoute } from './api/templates';
import { triggersRoute } from './api/triggers';
import { usageRoute } from './api/usage';
import { validateRoute } from './api/validate';
import { webhooksRoute } from './api/webhooks';
import { registerFonts } from './engine/fonts';
import { authMiddleware, optionalAuthMiddleware, planGate, usageTracking } from './middleware/auth';
import { rateLimit } from './middleware/rate-limit';

const app = new Hono();

// CORS — allow playground and external clients
app.use(
  '*',
  cors({
    origin: '*',
    allowHeaders: ['Content-Type', 'Authorization'],
    exposeHeaders: [
      'X-Render-Time-Ms',
      'X-Title-Lines',
      'X-Desc-Lines',
      'X-Layout-Overflow',
      'X-Batch-Count',
      'X-Cache',
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset',
    ],
  }),
);

// Rate limiting on render endpoints
app.use('/render', rateLimit());
app.use('/render/batch', rateLimit());
app.use('/validate', rateLimit());

// Auth middleware — conditionally applied based on AUTH_ENABLED env var
// This allows running without a database in development
const authEnabled = process.env.AUTH_ENABLED !== 'false';

if (authEnabled) {
  // Protected endpoints — require API key + track usage
  app.use('/render', authMiddleware(), usageTracking('/render'));
  app.use('/render/batch', authMiddleware(), planGate('batch'), usageTracking('/render/batch'));

  // Optional auth for /validate (per DECISIONS.md Decision 3)
  app.use('/validate', optionalAuthMiddleware());

  // Usage endpoint — requires auth
  app.use('/usage', authMiddleware());

  // Custom templates — auth is applied per-route in src/api/templates.ts
  // so it doesn't shadow the /templates/gallery/ docs page. planGate stays
  // path-wide: it no-ops when no apiKey is set in context, so docs requests
  // fall through to the static handler.
  app.use('/templates', planGate('custom_templates'));
  app.use('/templates/*', planGate('custom_templates'));

  // Webhook triggers — requires auth
  app.use('/triggers', authMiddleware());
  app.use('/triggers/*', authMiddleware());

  // Billing portal — requires auth
  app.use('/billing/*', authMiddleware());
}

// ─── Public routes ───────────────────────────────────────────
app.route('/', healthRoute);
app.route('/', registerRoute);
app.route('/', webhooksRoute);
app.route('/', adminRoute);

// ─── API routes ──────────────────────────────────────────────
app.route('/', validateRoute);
app.route('/', renderRoute);
app.route('/', batchRoute);
app.route('/', usageRoute);
app.route('/', templatesRoute);
app.route('/', triggersRoute);
app.route('/', billingRoute);

// ─── Static docs site (Astro build output) ─────────────────
const DOCS_DIR = join(import.meta.dir, '..', 'docs-dist');

app.use(
  '*',
  serveStatic({
    root: './docs-dist',
    onFound: (_path, c) => {
      if (_path.includes('/_astro/')) {
        c.header('Cache-Control', 'public, immutable, max-age=31536000');
      } else {
        c.header('Cache-Control', 'public, max-age=3600');
      }
    },
  }),
);

// 404 fallback — serve docs 404 page for browsers, JSON for API clients
app.notFound(async (c) => {
  const accepts = c.req.header('Accept') ?? '';
  if (accepts.includes('text/html')) {
    const notFoundPage = Bun.file(join(DOCS_DIR, '404.html'));
    if (await notFoundPage.exists()) {
      return c.html(await notFoundPage.text(), 404);
    }
  }
  return c.json(
    {
      error: 'not_found',
      message: `No route matches ${c.req.method} ${c.req.path}`,
      docs: 'https://og-engine.com/api-reference/overview',
    },
    404,
  );
});

// Global error handler
app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json(
    {
      error: 'server_error',
      message: 'An unexpected error occurred.',
      docs: 'https://og-engine.com/api-reference/errors#server_error',
    },
    500,
  );
});

// Start
const PORT = Number(process.env.PORT ?? 3000);
const FONTS_DIR = join(import.meta.dir, '..', 'fonts');

async function start() {
  await registerFonts(FONTS_DIR);
  console.log(`OG Engine listening on http://localhost:${PORT}`);
  if (authEnabled) {
    console.log('Auth: enabled (set AUTH_ENABLED=false to disable)');
  } else {
    console.log('Auth: disabled (development mode)');
  }
}

start();

export default {
  port: PORT,
  fetch: app.fetch,
};
