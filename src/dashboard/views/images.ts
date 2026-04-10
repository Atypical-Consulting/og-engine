import type { RenderHistoryRecord } from '../../db/index';
import { escapeHtml } from '../../utils/html';

interface ImagesData {
  renders: RenderHistoryRecord[];
  hasMore: boolean;
  offset: number;
}

function extractTitle(record: RenderHistoryRecord): string {
  try {
    const payload = JSON.parse(record.request_payload);
    return payload.title ?? '-';
  } catch {
    return '-';
  }
}

function formatBadge(format: string): string {
  return `<span class="badge">${escapeHtml(format)}</span>`;
}

function renderRow(r: RenderHistoryRecord, isLast: boolean, nextOffset: number, hasMore: boolean): string {
  const title = extractTitle(r);
  const attrs =
    isLast && hasMore
      ? ` hx-get="/dashboard/images?offset=${nextOffset}" hx-trigger="revealed" hx-swap="afterend" hx-target="closest tr"`
      : '';

  return `<tr${attrs}>
    <td>${escapeHtml(title)}</td>
    <td>${formatBadge(r.format)}</td>
    <td>${r.template ? escapeHtml(r.template) : '<span style="color:var(--text-muted)">-</span>'}</td>
    <td>${r.render_time_ms !== null ? `${r.render_time_ms.toFixed(1)}ms` : '-'}</td>
    <td>${escapeHtml(r.created_at)}</td>
    <td>
      <form style="display:inline">
        <button type="button" class="btn btn-sm btn-secondary"
          hx-post="/dashboard/images/${escapeHtml(r.id)}/render"
          hx-swap="none">Re-render</button>
      </form>
    </td>
  </tr>`;
}

export function imagesView(data: ImagesData): string {
  const { renders, hasMore, offset } = data;

  if (renders.length === 0 && offset === 0) {
    return `<div class="page-header">
  <h1>Images</h1>
</div>
<div class="table-card">
  <div class="empty-state">
    <p>No renders yet. Use the API to generate your first image.</p>
  </div>
</div>`;
  }

  const nextOffset = offset + renders.length;

  const rows = renders.map((r, i) => renderRow(r, i === renders.length - 1, nextOffset, hasMore)).join('\n');

  // For htmx infinite scroll requests (offset > 0), return just rows
  if (offset > 0) {
    return rows;
  }

  return `<div class="page-header">
  <h1>Images</h1>
</div>

<div class="table-card">
  <div class="table-header">Render history</div>
  <table>
    <thead>
      <tr>
        <th>Title</th>
        <th>Format</th>
        <th>Template</th>
        <th>Render time</th>
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
