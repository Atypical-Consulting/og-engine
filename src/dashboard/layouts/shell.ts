import type { SessionRecord, UserRecord } from '../../db/index';
import { escapeHtml } from '../../utils/html';

interface ShellOptions {
  user: UserRecord;
  session: SessionRecord;
  title: string;
  activePath: string;
  content: string;
}

const NAV_ITEMS = [
  { path: '/dashboard', label: 'Overview', icon: '\u{1F4CA}' },
  { path: '/dashboard/images', label: 'Images', icon: '\u{1F5BC}\uFE0F' },
  { path: '/dashboard/api-keys', label: 'API Keys', icon: '\u{1F511}' },
  { path: '/dashboard/billing', label: 'Billing', icon: '\u{1F4B3}' },
  { path: '/dashboard/usage', label: 'Usage', icon: '\u{1F4C8}' },
  { path: '/dashboard/templates', label: 'Templates', icon: '\u{1F3A8}' },
  { path: '/dashboard/webhooks', label: 'Webhooks', icon: '\u{1F517}' },
  { path: '/dashboard/settings', label: 'Settings', icon: '\u2699\uFE0F' },
];

function isActive(activePath: string, itemPath: string): boolean {
  if (itemPath === '/dashboard') {
    return activePath === '/dashboard';
  }
  return activePath.startsWith(itemPath);
}

export function renderShell(opts: ShellOptions): string {
  const { user, session, title, activePath, content } = opts;

  const navHtml = NAV_ITEMS.map(
    (item) =>
      `<a href="${item.path}" class="${isActive(activePath, item.path) ? 'active' : ''}"
        hx-get="${item.path}" hx-target="#main-content" hx-push-url="true"
      >${item.icon} ${escapeHtml(item.label)}</a>`,
  ).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="csrf-token" content="${escapeHtml(session.csrf_token)}">
  <title>${escapeHtml(title)} - OG Engine</title>
  <link rel="stylesheet" href="/static/dashboard.css">
</head>
<body hx-headers='{"X-CSRF-Token": "${escapeHtml(session.csrf_token)}"}'>
  <div class="dashboard">
    <aside class="sidebar">
      <div class="sidebar-logo">OG Engine</div>
      <nav class="sidebar-nav">
        ${navHtml}
      </nav>
      <div class="sidebar-footer">
        <span class="email">${escapeHtml(user.email)}</span>
        <form method="POST" action="/auth/logout">
          <button type="submit" class="btn btn-sm btn-secondary" style="width:100%">Logout</button>
        </form>
      </div>
    </aside>
    <main class="main">
      <div id="main-content">${content}</div>
    </main>
  </div>
  <script src="/static/htmx.min.js"></script>
</body>
</html>`;
}
