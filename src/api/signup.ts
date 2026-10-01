import { Hono } from 'hono';
import { z } from 'zod';
import { provisionFreeAccount } from '../auth/provision';
import { emailField } from '../utils/email';
import { escapeHtml } from '../utils/html';

export const signupRoute = new Hono();

const signupSchema = z.object({
  email: emailField('Please enter a valid email address.'),
});

// NOTE: the strings below are functional placeholders in the same voice as the
// existing /auth/login page. The positioning copy for this page (headline,
// promise, what the free tier is sold as) is owned by marketing — see the
// follow-up issue linked from ATY-60. Do not grow marketing prose here.
const PAGE_STYLE = `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, -apple-system, sans-serif; background: #0a0a0a; color: #e5e5e5; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
    .card { background: #171717; border: 1px solid #262626; border-radius: 12px; padding: 40px; width: 100%; max-width: 440px; }
    .logo { font-size: 24px; font-weight: 700; color: #38ef7d; margin-bottom: 8px; }
    .subtitle { color: #a3a3a3; font-size: 14px; line-height: 1.6; margin-bottom: 32px; }
    h2 { font-size: 20px; margin-bottom: 12px; }
    p { color: #a3a3a3; font-size: 14px; line-height: 1.6; }
    label { display: block; font-size: 14px; font-weight: 500; margin-bottom: 6px; color: #d4d4d4; }
    input[type="email"] { width: 100%; padding: 10px 14px; border: 1px solid #404040; border-radius: 8px; background: #262626; color: #e5e5e5; font-size: 16px; outline: none; }
    input[type="email"]:focus { border-color: #38ef7d; }
    button { width: 100%; padding: 12px; border: none; border-radius: 8px; background: #38ef7d; color: #0a0a0a; font-size: 16px; font-weight: 600; cursor: pointer; margin-top: 16px; }
    button:hover { background: #2dd36f; }
    .error { color: #ef4444; margin-bottom: 16px; font-size: 14px; }
    .key { display: block; background: #262626; border: 1px solid #404040; border-radius: 8px; padding: 12px 14px; margin: 16px 0; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 14px; color: #38ef7d; word-break: break-all; }
    pre { background: #0f0f0f; border: 1px solid #262626; border-radius: 8px; padding: 12px; margin: 16px 0; overflow-x: auto; font-size: 12px; color: #d4d4d4; }
    a { color: #38ef7d; text-decoration: none; }
    a:hover { text-decoration: underline; }
`;

function page(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex">
  <title>${escapeHtml(title)} - OG Engine</title>
  <style>${PAGE_STYLE}</style>
</head>
<body>
  <div class="card">
    <div class="logo">OG Engine</div>
${body}
  </div>
</body>
</html>`;
}

function signupForm(error?: string): string {
  const errorBlock = error ? `    <p class="error">${escapeHtml(error)}</p>\n` : '';
  return page(
    'Create a free account',
    `    <p class="subtitle">Free tier: 500 renders per month. No card required.</p>
${errorBlock}    <form method="POST" action="/signup">
      <label for="email">Email address</label>
      <input type="email" id="email" name="email" placeholder="you@example.com" required autofocus>
      <button type="submit">Get my API key</button>
    </form>
    <p style="margin-top:24px;">Already have an account? <a href="/auth/login">Log in</a></p>`,
  );
}

// ─── GET /signup ────────────────────────────────────────────

signupRoute.get('/signup', (c) => c.html(signupForm(), 200));

// `/register` and `/sign-up` are the other two paths developers and inbound
// links actually try (all three 404'd before ATY-60). They redirect rather than
// duplicate the page so there is exactly one canonical signup URL to measure.
signupRoute.get('/register', (c) => c.redirect('/signup', 301));
signupRoute.get('/sign-up', (c) => c.redirect('/signup', 301));

// ─── POST /signup ───────────────────────────────────────────

signupRoute.post('/signup', async (c) => {
  const form = await c.req.parseBody().catch(() => ({}) as Record<string, unknown>);
  const parsed = signupSchema.safeParse({ email: form.email });

  if (!parsed.success) {
    return c.html(signupForm(parsed.error.issues[0].message), 400);
  }

  const result = provisionFreeAccount(parsed.data.email);
  const safeEmail = escapeHtml(result.email);

  // An existing address never gets its key rendered back. Anyone can type any
  // address into a public form, so showing the key here would hand a live
  // credential to whoever guessed the address. Recovery goes through the
  // magic-link flow, which proves possession of the mailbox.
  if (!result.created) {
    return c.html(
      page(
        'You already have an account',
        `    <h2>You already have an account</h2>
    <p><strong>${safeEmail}</strong> is already registered, so we did not create a second one.</p>
    <p style="margin-top:16px;">Use the magic link to get back into your dashboard, where your API key is listed.</p>
    <p style="margin-top:16px;"><a href="/auth/login">Email me a login link →</a></p>`,
      ),
      200,
    );
  }

  // The key is rendered once, here, on purpose: it is the shortest path from
  // signup to a first successful render, and it means a mail provider outage
  // cannot leave a brand-new account unusable.
  const safeKey = escapeHtml(result.apiKey);
  return c.html(
    page(
      'Your API key',
      `    <h2>Your API key</h2>
    <p>Copy this now — we also emailed it to <strong>${safeEmail}</strong>.</p>
    <code class="key">${safeKey}</code>
    <p>Plan: <strong>${escapeHtml(result.plan)}</strong> · ${result.limit.toLocaleString('en-US')} renders/month</p>
    <p style="margin-top:16px;">Your first render:</p>
    <pre>curl -X POST https://og-engine.com/render \\
  -H "Authorization: Bearer ${safeKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"format":"og","title":"Hello World"}' \\
  --output card.png</pre>
    <p><a href="https://og-engine.com/quick-start/">Read the quick start →</a></p>`,
    ),
    201,
  );
});
