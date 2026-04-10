import { Resend } from 'resend';
import { PLAN_LIMITS, type Plan } from '../db';

function getResend(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new Resend(apiKey);
}

const FROM = process.env.EMAIL_FROM ?? 'OG Engine <delivered@resend.dev>';

export async function sendWelcomeEmail(email: string, apiKey: string, plan: Plan): Promise<void> {
  const resend = getResend();
  if (!resend) {
    console.warn('[email] RESEND_API_KEY not set — skipping welcome email');
    return;
  }

  const limit = PLAN_LIMITS[plan];

  await resend.emails.send({
    from: FROM,
    to: email,
    subject: 'Your OG Engine API Key',
    html: `
      <h2>Welcome to OG Engine!</h2>
      <p>Your API key (plan: <strong>${plan}</strong>, ${limit.toLocaleString()} renders/month):</p>
      <code style="background:#f0f0f0;padding:8px 16px;border-radius:4px;font-size:16px;display:inline-block;margin:8px 0;">
        ${apiKey}
      </code>
      <p>Quick start:</p>
      <pre style="background:#f0f0f0;padding:12px;border-radius:4px;overflow-x:auto;">curl -X POST https://og-engine.com/render \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"format":"og","title":"Hello World"}'</pre>
      <p><a href="https://og-engine.com/quick-start/">Read the docs →</a></p>
    `,
  });
}

export async function sendUpgradeEmail(email: string, plan: Plan): Promise<void> {
  const resend = getResend();
  if (!resend) {
    console.warn('[email] RESEND_API_KEY not set — skipping upgrade email');
    return;
  }

  const limit = PLAN_LIMITS[plan];

  await resend.emails.send({
    from: FROM,
    to: email,
    subject: `You're now on OG Engine ${plan.charAt(0).toUpperCase() + plan.slice(1)}`,
    html: `
      <h2>Plan upgraded!</h2>
      <p>Your plan is now <strong>${plan}</strong> with <strong>${limit.toLocaleString()}</strong> renders/month.</p>
      <p>Manage your subscription anytime via the billing portal:</p>
      <pre style="background:#f0f0f0;padding:12px;border-radius:4px;overflow-x:auto;">curl https://og-engine.com/billing/portal \\
  -H "Authorization: Bearer YOUR_API_KEY"</pre>
      <p><a href="https://og-engine.com/pricing">View all plans →</a></p>
    `,
  });
}

export async function sendMagicLinkEmail(email: string, verifyUrl: string): Promise<void> {
  const resend = getResend();
  if (!resend) {
    console.warn('[email] RESEND_API_KEY not set — skipping magic link email');
    console.info(`[email] Magic link verify URL: ${verifyUrl}`);
    return;
  }

  await resend.emails.send({
    from: FROM,
    to: email,
    subject: 'Log in to OG Engine',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
        <h2 style="color:#111;">Log in to OG Engine</h2>
        <p style="color:#555;">Click the button below to log in to your dashboard. This link expires in 15 minutes.</p>
        <a href="${verifyUrl}"
           style="display:inline-block;background:#38ef7d;color:#111;font-weight:bold;text-decoration:none;padding:12px 24px;border-radius:6px;margin:16px 0;">
          Log in to Dashboard
        </a>
        <p style="color:#888;font-size:13px;">If you didn't request this email, you can safely ignore it.</p>
        <p style="color:#888;font-size:13px;">Or copy this link: ${verifyUrl}</p>
      </div>
    `,
  });
}

export async function sendDowngradeEmail(email: string): Promise<void> {
  const resend = getResend();
  if (!resend) {
    console.warn('[email] RESEND_API_KEY not set — skipping downgrade email');
    return;
  }

  await resend.emails.send({
    from: FROM,
    to: email,
    subject: 'OG Engine subscription cancelled',
    html: `
      <h2>Subscription cancelled</h2>
      <p>Your plan has been downgraded to <strong>Free</strong> (500 renders/month).</p>
      <p>Your API key is still active — you can keep using OG Engine on the free tier.</p>
      <p>Changed your mind? <a href="https://og-engine.com/pricing">Resubscribe anytime →</a></p>
    `,
  });
}
