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
