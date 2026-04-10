import type { UserRecord } from '../../db/index';
import { escapeHtml } from '../../utils/html';

interface UsageData {
  user: UserRecord;
  daily: { date: string; count: number }[];
  byEndpoint: Record<string, number>;
  byFormat: Record<string, number>;
  total: number;
  days: number;
}

function usagePercent(user: UserRecord): number {
  if (user.calls_limit === 0) return 0;
  return Math.min(100, Math.round((user.calls_used / user.calls_limit) * 100));
}

export function usageView(data: UsageData): string {
  const { user, daily, byEndpoint, byFormat, total, days } = data;
  const pct = usagePercent(user);

  // Build daily chart bars
  const maxCount = Math.max(1, ...daily.map((d) => d.count));
  const chartBars =
    daily.length > 0
      ? daily
          .map((d) => {
            const height = Math.max(2, Math.round((d.count / maxCount) * 100));
            return `<div class="chart-bar" style="height:${height}%" title="${escapeHtml(d.date)}: ${d.count} renders">
          <span class="chart-label">${d.count}</span>
        </div>`;
          })
          .join('\n')
      : '<p style="color:var(--text-muted);padding:1rem">No render data for this period.</p>';

  // Date range buttons
  const rangeButtons = [7, 30, 90]
    .map((d) => {
      const active = d === days ? ' btn-primary' : ' btn-secondary';
      return `<button type="button" class="btn btn-sm${active}"
        hx-get="/dashboard/usage?days=${d}"
        hx-target="#main-content"
        hx-push-url="true">${d}d</button>`;
    })
    .join('\n');

  // Endpoint breakdown
  const endpointRows = Object.entries(byEndpoint)
    .sort(([, a], [, b]) => b - a)
    .map(([ep, count]) => `<tr><td>${escapeHtml(ep)}</td><td>${count.toLocaleString()}</td></tr>`)
    .join('\n');

  // Format breakdown
  const formatRows = Object.entries(byFormat)
    .sort(([, a], [, b]) => b - a)
    .map(([fmt, count]) => `<tr><td>${escapeHtml(fmt)}</td><td>${count.toLocaleString()}</td></tr>`)
    .join('\n');

  // Quota warning
  const quotaWarning =
    pct >= 80
      ? `<div class="stat-card" style="border-color:var(--danger)">
          <div class="label" style="color:var(--danger)">Quota warning</div>
          <div class="value">${pct}% used</div>
          <div class="sub">${user.calls_used.toLocaleString()} of ${user.calls_limit.toLocaleString()} renders used this period.
            ${pct >= 100 ? ' You have reached your limit.' : ' Consider upgrading your plan.'}</div>
        </div>`
      : '';

  return `<div class="page-header">
  <h1>Usage</h1>
  <div class="btn-group">
    ${rangeButtons}
  </div>
</div>

${quotaWarning}

<div class="stats-grid">
  <div class="stat-card">
    <div class="label">Total renders (all time)</div>
    <div class="value">${total.toLocaleString()}</div>
  </div>
  <div class="stat-card">
    <div class="label">Renders (last ${days}d)</div>
    <div class="value">${daily.reduce((s, d) => s + d.count, 0).toLocaleString()}</div>
  </div>
</div>

<div class="table-card">
  <div class="table-header">Daily renders (last ${days} days)</div>
  <div class="chart" style="display:flex;align-items:flex-end;gap:2px;height:120px;padding:1rem">
    ${chartBars}
  </div>
</div>

<div class="stats-grid">
  <div class="table-card">
    <div class="table-header">By endpoint</div>
    <table>
      <thead><tr><th>Endpoint</th><th>Count</th></tr></thead>
      <tbody>${endpointRows || '<tr><td colspan="2" style="color:var(--text-muted)">No data</td></tr>'}</tbody>
    </table>
  </div>

  <div class="table-card">
    <div class="table-header">By format</div>
    <table>
      <thead><tr><th>Format</th><th>Count</th></tr></thead>
      <tbody>${formatRows || '<tr><td colspan="2" style="color:var(--text-muted)">No data</td></tr>'}</tbody>
    </table>
  </div>
</div>`;
}
