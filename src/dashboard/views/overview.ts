import type { Plan, RenderHistoryRecord, UserRecord } from '../../db/index';
import { escapeHtml } from '../../utils/html';

const PLAN_PRICES: Record<Plan, string> = {
  free: 'Free',
  starter: '\u20AC10/mo',
  pro: '\u20AC39/mo',
  scale: '\u20AC99/mo',
};

interface OverviewData {
  user: UserRecord;
  avgRenderTime: number;
  recentRenders: RenderHistoryRecord[];
}

function usagePercent(user: UserRecord): number {
  if (user.calls_limit === 0) return 0;
  return Math.min(100, Math.round((user.calls_used / user.calls_limit) * 100));
}

function progressClass(pct: number): string {
  if (pct >= 90) return 'progress-fill danger';
  if (pct >= 80) return 'progress-fill warning';
  return 'progress-fill';
}

export function overviewView(data: OverviewData): string {
  const { user, avgRenderTime, recentRenders } = data;
  const pct = usagePercent(user);

  const rendersRows =
    recentRenders.length > 0
      ? recentRenders
          .map(
            (r) => `<tr>
        <td>${escapeHtml(r.endpoint)}</td>
        <td>${escapeHtml(r.format)}</td>
        <td>${r.template ? escapeHtml(r.template) : '<span style="color:var(--text-muted)">-</span>'}</td>
        <td>${r.render_time_ms !== null ? `${r.render_time_ms.toFixed(1)}ms` : '-'}</td>
        <td>${escapeHtml(r.created_at)}</td>
      </tr>`,
          )
          .join('\n')
      : `<tr><td colspan="5"><div class="empty-state"><p>No renders yet. Use the API to generate your first image.</p></div></td></tr>`;

  return `<div class="page-header">
  <h1>Overview</h1>
</div>

<div class="stats-grid">
  <div class="stat-card">
    <div class="label">Plan</div>
    <div class="value">${escapeHtml(user.plan.charAt(0).toUpperCase() + user.plan.slice(1))}</div>
    <div class="sub">${PLAN_PRICES[user.plan]}</div>
  </div>

  <div class="stat-card">
    <div class="label">Usage this period</div>
    <div class="value">${user.calls_used.toLocaleString()} / ${user.calls_limit.toLocaleString()}</div>
    <div class="progress">
      <div class="${progressClass(pct)}" style="width: ${pct}%"></div>
    </div>
    <div class="sub">${pct}% used</div>
  </div>

  <div class="stat-card">
    <div class="label">Avg render time (7d)</div>
    <div class="value">${avgRenderTime > 0 ? `${avgRenderTime.toFixed(1)}ms` : '-'}</div>
    <div class="sub">Last 7 days</div>
  </div>
</div>

<div class="table-card">
  <div class="table-header">Recent renders</div>
  <table>
    <thead>
      <tr>
        <th>Endpoint</th>
        <th>Format</th>
        <th>Template</th>
        <th>Render time</th>
        <th>Created</th>
      </tr>
    </thead>
    <tbody>
      ${rendersRows}
    </tbody>
  </table>
</div>`;
}
