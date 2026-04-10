import type { WebhookRecord } from '../../db/index';
import { escapeHtml } from '../../utils/html';

export function webhooksView(webhooks: WebhookRecord[]): string {
  const rows =
    webhooks.length > 0
      ? webhooks
          .map(
            (w) => `<tr id="webhook-row-${escapeHtml(w.id)}">
        <td>${escapeHtml(w.url)}</td>
        <td><code style="font-size:0.85em">${escapeHtml(w.secret.slice(0, 16))}...</code></td>
        <td>${escapeHtml(w.created_at)}</td>
        <td>
          <span id="webhook-test-${escapeHtml(w.id)}"></span>
          <button type="button" class="btn btn-sm btn-secondary"
            hx-post="/dashboard/webhooks/${escapeHtml(w.id)}/test"
            hx-target="#webhook-test-${escapeHtml(w.id)}"
            hx-swap="innerHTML">Test</button>
          <button type="button" class="btn btn-sm btn-secondary" style="color:var(--danger)"
            hx-delete="/dashboard/webhooks/${escapeHtml(w.id)}"
            hx-target="#webhook-row-${escapeHtml(w.id)}"
            hx-swap="outerHTML"
            hx-confirm="Delete this webhook?">Delete</button>
        </td>
      </tr>`,
          )
          .join('\n')
      : `<tr><td colspan="4"><div class="empty-state"><p>No webhooks configured.</p></div></td></tr>`;

  return `<div class="page-header">
  <h1>Webhooks</h1>
</div>

<div class="table-card" style="padding:1.5rem">
  <div class="table-header">Add webhook</div>
  <form hx-post="/dashboard/webhooks" hx-target="#main-content" hx-swap="innerHTML" style="display:flex;flex-direction:column;gap:0.75rem;max-width:500px">
    <label>
      URL
      <input type="url" name="url" required placeholder="https://example.com/webhook" style="width:100%;padding:0.5rem;margin-top:0.25rem">
    </label>
    <label>
      Render config (JSON, optional)
      <textarea name="render_config" rows="4" placeholder='{"format":"og","template":"default"}' style="width:100%;padding:0.5rem;margin-top:0.25rem;font-family:monospace">{}</textarea>
    </label>
    <button type="submit" class="btn btn-primary" style="align-self:flex-start">Add webhook</button>
  </form>
</div>

<div class="table-card">
  <div class="table-header">Active webhooks</div>
  <table>
    <thead>
      <tr>
        <th>URL</th>
        <th>Secret</th>
        <th>Created</th>
        <th>Actions</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>
</div>`;
}
