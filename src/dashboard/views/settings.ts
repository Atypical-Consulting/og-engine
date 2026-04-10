import type { UserRecord } from '../../db/index';
import { escapeHtml } from '../../utils/html';

export function settingsView(user: UserRecord): string {
  return `<div class="page-header">
  <h1>Settings</h1>
</div>

<div class="table-card" style="padding:1.5rem">
  <div class="table-header">Account information</div>
  <div style="display:flex;flex-direction:column;gap:1rem;max-width:400px">
    <div>
      <div class="label">Email</div>
      <div style="padding:0.5rem;background:var(--bg-secondary, #1a1a2e);border-radius:4px">${escapeHtml(user.email)}</div>
    </div>
    <div>
      <div class="label">Account ID</div>
      <div style="padding:0.5rem;background:var(--bg-secondary, #1a1a2e);border-radius:4px"><code>${escapeHtml(user.id)}</code></div>
    </div>
    <div>
      <div class="label">Member since</div>
      <div style="padding:0.5rem;background:var(--bg-secondary, #1a1a2e);border-radius:4px">${escapeHtml(user.created_at)}</div>
    </div>
  </div>
</div>

<div class="table-card" style="padding:1.5rem;border-color:var(--danger, #e74c3c)">
  <div class="table-header" style="color:var(--danger, #e74c3c)">Danger zone</div>
  <p style="margin-bottom:1rem;color:var(--text-muted)">Permanently delete your account and all associated data. This action cannot be undone.</p>
  <button type="button" class="btn btn-sm btn-secondary" style="color:var(--danger, #e74c3c);border-color:var(--danger, #e74c3c)"
    hx-delete="/dashboard/account"
    hx-confirm="Are you sure you want to delete your account? This will cancel your subscription and permanently delete all data.">Delete account</button>
</div>`;
}
