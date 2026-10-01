import { Hono } from 'hono';
import { z } from 'zod';
import { provisionFreeAccount } from '../auth/provision';
import { emailField } from '../utils/email';
import { escapeHtml } from '../utils/html';

export const signupRoute = new Hono();

const signupSchema = z.object({
  email: emailField('Please enter a valid email address.'),
});

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
    .hint { color: #737373; font-size: 12px; line-height: 1.5; margin-top: 10px; }
    .fineprint { color: #737373; font-size: 12px; line-height: 1.6; margin-top: 16px; }
    .cta { display: block; width: 100%; padding: 12px; border-radius: 8px; background: #38ef7d; color: #0a0a0a; font-size: 16px; font-weight: 600; text-align: center; margin-top: 20px; }
    .cta:hover { background: #2dd36f; text-decoration: none; }
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
    'Get your API key',
    `    <h2>Get your API key</h2>
    <p class="subtitle">Free forever: 500 renders a month, no credit card, no trial clock. Your key works the second you submit this form.</p>
${errorBlock}    <form method="POST" action="/signup">
      <label for="email">Email address</label>
      <input type="email" id="email" name="email" placeholder="you@example.com" required autofocus>
      <button type="submit">Get my API key</button>
      <p class="hint">No password to choose — we email the key and nothing else.</p>
    </form>
    <p class="fineprint">Free is the same engine: every format, every built-in template, all 53 bundled fonts, PNG and PDF output. WebP output, batch rendering and CDN caching start on Starter, €10/mo.</p>
    <p class="fineprint">Pass 500 renders in a month and the API returns 429 until your quota resets. With no card on file, nothing can be charged.</p>
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
        'That address already has a key',
        `    <h2>That address already has a key</h2>
    <p><strong>${safeEmail}</strong> is already registered, so we did not create a second account. Your existing key is still live and your quota is untouched.</p>
    <p style="margin-top:16px;">We never print a key on this page for an address that already exists — anyone can type any address into a public form. A login link proves the mailbox is yours.</p>
    <a class="cta" href="/auth/login">Email me a login link →</a>
    <p class="fineprint">The link arrives with the subject “Log in to OG Engine” and is good for 15 minutes. Your key is on the API Keys page of the dashboard: masked, with a Copy button.</p>
    <p class="fineprint">Lost it for good? Log in and regenerate it — the old key stops working immediately.</p>`,
      ),
      200,
    );
  }

  // The key is rendered once, here, on purpose: it is the shortest path from
  // signup to a first successful render, and it means a mail provider outage
  // cannot leave a brand-new account unusable.
  const safeKey = escapeHtml(result.apiKey);
  // The plan comes out of the DB lowercase ('free'); display it capitalised so
  // it reads as the plan's name rather than an enum value.
  const planLabel = escapeHtml(result.plan.charAt(0).toUpperCase() + result.plan.slice(1));
  const limitLabel = result.limit.toLocaleString('en-US');
  return c.html(
    page(
      'Your API key is ready',
      `    <h2>Your API key is ready</h2>
    <p>Copy it now. This is the only page that prints it in full — in your dashboard it is masked to the last eight characters, with a Copy button.</p>
    <code class="key">${safeKey}</code>
    <p>We are emailing a copy to <strong>${safeEmail}</strong>, subject line “Your OG Engine API Key”.</p>
    <p>Plan: <strong>${planLabel}</strong> · ${limitLabel} renders a month</p>
    <p style="margin-top:16px;">Your first render — paste this into a terminal:</p>
    <pre>curl -X POST https://og-engine.com/render \\
  -H "Authorization: Bearer ${safeKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"format":"og","title":"Hello World"}' \\
  --output card.png</pre>
    <p>That writes <code>card.png</code> — a 1200×630 PNG — and spends 1 of your ${limitLabel} renders.</p>
    <p><a href="https://og-engine.com/quick-start/">Read the quick start →</a></p>`,
    ),
    201,
  );
});
