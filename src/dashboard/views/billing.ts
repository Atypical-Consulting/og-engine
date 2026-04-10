import type { Plan, UserRecord } from '../../db/index';
import { escapeHtml } from '../../utils/html';

const PLAN_PRICES: Record<Plan, string> = {
  free: 'Free',
  starter: '\u20AC10/mo',
  pro: '\u20AC39/mo',
  scale: '\u20AC99/mo',
};

const PLAN_NAMES: Record<Plan, string> = {
  free: 'Free',
  starter: 'Starter',
  pro: 'Pro',
  scale: 'Scale',
};

function usagePercent(user: UserRecord): number {
  if (user.calls_limit === 0) return 0;
  return Math.min(100, Math.round((user.calls_used / user.calls_limit) * 100));
}

function progressClass(pct: number): string {
  if (pct >= 90) return 'progress-fill danger';
  if (pct >= 80) return 'progress-fill warning';
  return 'progress-fill';
}

export function billingView(user: UserRecord, portalAvailable: boolean): string {
  const pct = usagePercent(user);

  const portalLink = portalAvailable
    ? `<a href="/billing/portal" class="btn btn-primary">Manage Subscription</a>`
    : `<p style="color:var(--text-muted)">Subscribe to a paid plan to manage billing.</p>`;

  return `<div class="page-header">
  <h1>Billing</h1>
</div>

<div class="stats-grid">
  <div class="stat-card">
    <div class="label">Current plan</div>
    <div class="value">${escapeHtml(PLAN_NAMES[user.plan])}</div>
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
    <div class="label">Period started</div>
    <div class="value">${escapeHtml(user.period_start)}</div>
  </div>
</div>

<div class="table-card" style="padding:1.5rem">
  <div class="table-header">Subscription management</div>
  ${portalLink}
</div>`;
}
