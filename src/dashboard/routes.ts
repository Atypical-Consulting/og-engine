import { Hono } from 'hono';
import type { SessionRecord, UserRecord } from '../db/index';
import { getDb, getRenderHistory } from '../db/index';
import { renderShell } from './layouts/shell';
import { overviewView } from './views/overview';

export const dashboardRoutes = new Hono();

function isHtmx(c: any): boolean {
  return c.req.header('HX-Request') === 'true';
}

function respond(c: any, title: string, path: string, content: string): Response {
  if (isHtmx(c)) {
    return c.html(content);
  }
  const user = c.get('user' as never) as UserRecord;
  const session = c.get('session' as never) as SessionRecord;
  return c.html(renderShell({ user, session, title, activePath: path, content }));
}

dashboardRoutes.get('/dashboard', (c) => {
  const user = c.get('user' as never) as UserRecord;

  // Fetch recent renders
  const recentRenders = getRenderHistory(user.id, { limit: 10, offset: 0 });

  // Calculate avg render time from last 7 days
  const d = getDb();
  const avgRow = d
    .prepare(
      `SELECT AVG(render_time_ms) as avg_ms
       FROM render_history
       WHERE user_id = ? AND render_time_ms IS NOT NULL
         AND created_at >= datetime('now', '-7 days')`,
    )
    .get(user.id) as { avg_ms: number | null } | null;

  const avgRenderTime = avgRow?.avg_ms ?? 0;

  const content = overviewView({ user, avgRenderTime, recentRenders });
  return respond(c, 'Overview', '/dashboard', content);
});
