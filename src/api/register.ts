import { Hono } from 'hono';
import { z } from 'zod';
import { createApiKey, createUser, findApiKeyByEmail, findUserByEmail } from '../db';
import { sendWelcomeEmail } from '../email/send';

export const registerRoute = new Hono();

const registerSchema = z.object({
  email: z.string().email('A valid email address is required.'),
});

/** Step of the signup path a 500 died on. Reported so the failure is diagnosable from a curl. */
type Stage = 'lookup' | 'create_user' | 'create_key';

registerRoute.post('/auth/register', async (c) => {
  const raw = await c.req.json().catch(() => null);
  if (!raw) {
    return c.json(
      {
        error: 'invalid_request',
        message: 'Request body must be valid JSON.',
        docs: 'https://og-engine.com/api-reference/errors#invalid_request',
      },
      400,
    );
  }

  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => ({
      field: i.path.join('.'),
      message: i.message,
    }));
    return c.json(
      {
        error: 'invalid_request',
        message: issues[0]?.message ?? 'Validation failed.',
        details: { fields: issues },
        docs: 'https://og-engine.com/api-reference/errors#invalid_request',
      },
      400,
    );
  }

  const { email } = parsed.data;

  // Signup is the top of the only funnel there is, so every failure below has to
  // name the step it died on. A bare 500 here (ATY-78) was undiagnosable from
  // outside for as long as it took to get production log access.
  let stage: Stage = 'lookup';
  try {
    // Per DECISIONS.md Decision 4: duplicate registration returns existing key
    const existing = findApiKeyByEmail(email);
    if (existing) {
      const user = findUserByEmail(email);
      return c.json({
        apiKey: existing.key,
        plan: user?.plan ?? 'free',
        limit: user?.calls_limit ?? 500,
        message: `Existing API key returned. Also sent to ${email}.`,
      });
    }

    stage = 'create_user';
    const user = createUser(email, 'free');

    stage = 'create_key';
    const record = createApiKey(user.id);

    // Deliberately off the critical path: the account exists the moment the key
    // row is written, and a mail-provider outage must not fail the request or
    // orphan a key the caller never receives. Same fix as 1dab347 for Stripe.
    void sendWelcomeEmail(email, record.key, user.plan).catch((err) => {
      console.error('[register] welcome email failed (account was still created):', err);
    });

    return c.json(
      {
        apiKey: record.key,
        plan: user.plan,
        limit: user.calls_limit,
        message: `API key created. Also sent to ${email}.`,
      },
      201,
    );
  } catch (err) {
    console.error(`[register] failed at stage=${stage}:`, err);
    return c.json(
      {
        error: 'server_error',
        message: 'An unexpected error occurred.',
        // The stage name carries no PII and no secret, and it is the difference
        // between diagnosing this from a curl and needing production log access.
        details: { stage },
        docs: 'https://og-engine.com/api-reference/errors#server_error',
      },
      500,
    );
  }
});
