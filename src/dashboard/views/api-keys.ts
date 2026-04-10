import type { ApiKeyRecord } from '../../db/index';
import { escapeHtml } from '../../utils/html';

function maskKey(key: string): string {
  if (key.length <= 8) return key;
  return '\u2022'.repeat(key.length - 8) + key.slice(-8);
}

export function apiKeyRow(key: ApiKeyRecord, showFull = false): string {
  const display = showFull ? escapeHtml(key.key) : escapeHtml(maskKey(key.key));
  return `<tr id="key-row-${escapeHtml(key.id)}">
    <td>
      <code class="key-display">${display}</code>
      <button type="button" class="btn btn-sm btn-secondary" style="margin-left:0.5rem"
        onclick="navigator.clipboard.writeText('${escapeHtml(key.key)}')">Copy</button>
    </td>
    <td>${escapeHtml(key.created_at)}</td>
    <td>
      <button type="button" class="btn btn-sm btn-secondary"
        hx-post="/dashboard/api-keys/${escapeHtml(key.id)}/regenerate"
        hx-target="#key-row-${escapeHtml(key.id)}"
        hx-swap="outerHTML"
        hx-confirm="Regenerate this key? The old key will stop working immediately.">Regenerate</button>
      <button type="button" class="btn btn-sm btn-secondary" style="color:var(--danger)"
        hx-delete="/dashboard/api-keys/${escapeHtml(key.id)}"
        hx-target="#key-row-${escapeHtml(key.id)}"
        hx-swap="outerHTML"
        hx-confirm="Revoke this key? This action cannot be undone.">Revoke</button>
    </td>
  </tr>`;
}

export function apiKeysView(keys: ApiKeyRecord[]): string {
  const rows =
    keys.length > 0
      ? keys.map((k) => apiKeyRow(k)).join('\n')
      : `<tr><td colspan="3"><div class="empty-state"><p>No API keys yet. Create one to start using the API.</p></div></td></tr>`;

  return `<div class="page-header">
  <h1>API Keys</h1>
  <button type="button" class="btn btn-primary"
    hx-post="/dashboard/api-keys"
    hx-target="#keys-tbody"
    hx-swap="afterbegin">Create new key</button>
</div>

<div class="table-card">
  <div class="table-header">Active keys</div>
  <table>
    <thead>
      <tr>
        <th>Key</th>
        <th>Created</th>
        <th>Actions</th>
      </tr>
    </thead>
    <tbody id="keys-tbody">
      ${rows}
    </tbody>
  </table>
</div>`;
}
