import { Hono } from 'hono';
import { z } from 'zod';
import { sendMagicLinkEmail } from '../email/send';
import { escapeHtml } from '../utils/html';
import { createMagicLinkToken } from './magic-link';
import { clearSessionCookie, getCookie, setSessionCookie } from './middleware';
import { verifyMagicLink } from './session';

const authRoutes = new Hono();

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';

const emailSchema = z.object({
  email: z.string().email('Please enter a valid email address.'),
});

// ─── GET /auth/login ────────────────────────────────────────

authRoutes.get('/auth/login', (c) => {
  const returnTo = c.req.query('returnTo') ?? '';
  const error = c.req.query('error') ?? '';
  const safeReturnTo = escapeHtml(returnTo);
  const safeError = error ? `<p style="color:#ef4444;margin-bottom:16px;">${escapeHtml(error)}</p>` : '';

  return c.html(
    `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Log in - OG Engine</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, -apple-system, sans-serif; background: #0a0a0a; color: #e5e5e5; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    .card { background: #171717; border: 1px solid #262626; border-radius: 12px; padding: 40px; width: 100%; max-width: 400px; }
    .logo { font-size: 24px; font-weight: 700; color: #38ef7d; margin-bottom: 8px; }
    .subtitle { color: #a3a3a3; font-size: 14px; margin-bottom: 32px; }
    label { display: block; font-size: 14px; font-weight: 500; margin-bottom: 6px; color: #d4d4d4; }
    input[type="email"] { width: 100%; padding: 10px 14px; border: 1px solid #404040; border-radius: 8px; background: #262626; color: #e5e5e5; font-size: 16px; outline: none; }
    input[type="email"]:focus { border-color: #38ef7d; }
    button { width: 100%; padding: 12px; border: none; border-radius: 8px; background: #38ef7d; color: #0a0a0a; font-size: 16px; font-weight: 600; cursor: pointer; margin-top: 16px; }
    button:hover { background: #2dd36f; }
    .error { color: #ef4444; margin-bottom: 16px; font-size: 14px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">OG Engine</div>
    <p class="subtitle">Enter your email to receive a magic login link.</p>
    ${safeError}
    <form method="POST" action="/auth/send-link">
      <input type="hidden" name="returnTo" value="${safeReturnTo}">
      <label for="email">Email address</label>
      <input type="email" id="email" name="email" placeholder="you@example.com" required autofocus>
      <button type="submit">Send magic link</button>
    </form>
  </div>
</body>
</html>`,
    200,
  );
});

// ─── POST /auth/send-link ───────────────────────────────────

authRoutes.post('/auth/send-link', async (c) => {
  let email: string;
  let returnTo = '';

  const contentType = c.req.header('Content-Type') ?? '';
  if (contentType.includes('application/json')) {
    const body = await c.req.json();
    const parsed = emailSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'validation_error', message: parsed.error.issues[0].message }, 400);
    }
    email = parsed.data.email;
    returnTo = ((body as Record<string, unknown>).returnTo as string) ?? '';
  } else {
    const form = await c.req.parseBody();
    const parsed = emailSchema.safeParse({ email: form.email });
    if (!parsed.success) {
      const errorMsg = encodeURIComponent(parsed.error.issues[0].message);
      return c.redirect(`/auth/login?error=${errorMsg}`);
    }
    email = parsed.data.email;
    returnTo = (form.returnTo as string) ?? '';
  }

  try {
    const { token } = createMagicLinkToken(email);
    const verifyParams = new URLSearchParams({ token });
    if (returnTo) verifyParams.set('returnTo', returnTo);
    const verifyUrl = `${BASE_URL}/auth/verify?${verifyParams.toString()}`;

    try {
      await sendMagicLinkEmail(email, verifyUrl);
    } catch (emailErr) {
      // Email delivery failure is non-fatal — the token is already in the DB.
      // Log the error but still show the "check your email" page.
      console.error('[auth] Failed to send magic link email:', emailErr);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'An error occurred.';
    if (message.includes('Too many login requests')) {
      if (contentType.includes('application/json')) {
        return c.json({ error: 'rate_limited', message }, 429);
      }
      const errorMsg = encodeURIComponent(message);
      return c.redirect(`/auth/login?error=${errorMsg}`);
    }
    throw err;
  }

  // Show "check your email" page
  if (contentType.includes('application/json')) {
    return c.json({ ok: true, message: 'Check your email for a login link.' });
  }

  return c.html(
    `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Check your email - OG Engine</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, -apple-system, sans-serif; background: #0a0a0a; color: #e5e5e5; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    .card { background: #171717; border: 1px solid #262626; border-radius: 12px; padding: 40px; width: 100%; max-width: 400px; text-align: center; }
    .logo { font-size: 24px; font-weight: 700; color: #38ef7d; margin-bottom: 16px; }
    h2 { font-size: 20px; margin-bottom: 12px; }
    p { color: #a3a3a3; font-size: 14px; line-height: 1.6; }
    a { color: #38ef7d; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">OG Engine</div>
    <h2>Check your email</h2>
    <p>We sent a login link to <strong>${escapeHtml(email)}</strong>. Click the link in the email to log in.</p>
    <p style="margin-top:16px;"><a href="/auth/login">Back to login</a></p>
  </div>
</body>
</html>`,
    200,
  );
});

// ─── GET /auth/verify ───────────────────────────────────────

authRoutes.get('/auth/verify', (c) => {
  const token = c.req.query('token');
  let returnTo = c.req.query('returnTo') ?? '/dashboard';

  if (!token) {
    return c.redirect('/auth/login?error=Missing%20token');
  }

  // Validate returnTo starts with /dashboard to prevent open redirects
  if (!returnTo.startsWith('/dashboard')) {
    returnTo = '/dashboard';
  }

  try {
    const { sessionToken } = verifyMagicLink(token);
    setSessionCookie(c, sessionToken);
    return c.redirect(returnTo);
  } catch {
    return c.redirect('/auth/login?error=Invalid%20or%20expired%20link');
  }
});

// ─── POST /auth/logout ──────────────────────────────────────

authRoutes.post('/auth/logout', async (c) => {
  const token = getCookie(c, 'oge_session');
  if (token) {
    const { deleteSession } = await import('../db/index');
    deleteSession(token);
  }
  clearSessionCookie(c);
  return c.redirect('/auth/login');
});

export { authRoutes };
