import type { CustomTemplateRecord, UserRecord } from '../../db/index';
import { escapeHtml } from '../../utils/html';

export function templatesView(user: UserRecord, templates: CustomTemplateRecord[]): string {
  if (user.plan !== 'scale') {
    return `<div class="page-header">
  <h1>Custom Templates</h1>
</div>
<div class="table-card" style="padding:1.5rem">
  <div class="empty-state">
    <p>Custom templates are available on the <strong>Scale</strong> plan.</p>
    <p style="margin-top:0.5rem"><a href="/dashboard/billing" class="btn btn-primary"
      hx-get="/dashboard/billing" hx-target="#main-content" hx-push-url="true">Upgrade to Scale</a></p>
  </div>
</div>`;
  }

  const rows =
    templates.length > 0
      ? templates
          .map(
            (t) => `<tr id="tpl-row-${escapeHtml(t.id)}">
        <td>${escapeHtml(t.name)}</td>
        <td><code style="font-size:0.85em">${escapeHtml(t.definition.slice(0, 80))}${t.definition.length > 80 ? '...' : ''}</code></td>
        <td>${escapeHtml(t.created_at)}</td>
        <td>
          <button type="button" class="btn btn-sm btn-secondary" style="color:var(--danger)"
            hx-delete="/dashboard/templates/${escapeHtml(t.id)}"
            hx-target="#tpl-row-${escapeHtml(t.id)}"
            hx-swap="outerHTML"
            hx-confirm="Delete this template?">Delete</button>
        </td>
      </tr>`,
          )
          .join('\n')
      : `<tr><td colspan="4"><div class="empty-state"><p>No custom templates yet.</p></div></td></tr>`;

  return `<div class="page-header">
  <h1>Custom Templates</h1>
</div>

<div class="table-card" style="padding:1.5rem">
  <div class="table-header">Create template</div>
  <form hx-post="/dashboard/templates" hx-target="#main-content" hx-swap="innerHTML" style="display:flex;flex-direction:column;gap:0.75rem;max-width:500px">
    <label>
      Name
      <input type="text" name="name" required placeholder="my-template" style="width:100%;padding:0.5rem;margin-top:0.25rem">
    </label>
    <label>
      Definition (JSON)
      <textarea name="definition" required rows="6" placeholder='{"background":"#1a1a2e","titleColor":"#fff"}' style="width:100%;padding:0.5rem;margin-top:0.25rem;font-family:monospace"></textarea>
    </label>
    <button type="submit" class="btn btn-primary" style="align-self:flex-start">Create template</button>
  </form>
</div>

<div class="table-card">
  <div class="table-header">Your templates</div>
  <table>
    <thead>
      <tr>
        <th>Name</th>
        <th>Definition</th>
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
