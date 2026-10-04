import { Hono } from 'hono';
import { z } from 'zod';
import { createApiKey, createUser, findApiKeyByEmail } from '../db';
import { sendWelcomeEmail } from '../email/send';
import { normalizeEmail } from '../utils/email';

export const registerRoute = new Hono();

// `.trim()` runs before `.email()`, so a pasted address with stray whitespace
// signs up instead of 400-ing. Case is canonicalised separately below.
const registerSchema = z.object({
  email: z.string().trim().email('A valid email address is required.'),
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

  // Zod's .email() validates but does not canonicalise, so normalise here: the
  // signup email is the key a later Stripe checkout has to match.
  const email = normalizeEmail(parsed.data.email);

  // Signup is the top of the only funnel there is, so every failure below has to
  // name the step it died on. A bare 500 here (ATY-78) was undiagnosable from
  // outside for as long as it took to get production log access.
  let stage: Stage = 'lookup';
  try {
    // Per DECISIONS.md Decision 4 (amended): duplicate registration must NOT
    // return the existing key. This endpoint is unauthenticated, so echoing a
    // key back to anyone who guesses an email is credential disclosure. The
    // caller recovers the key themselves via POST /auth/send-link — we do not
    // send mail here, or an anonymous caller could put mail in someone else's
    // inbox.
    const existing = findApiKeyByEmail(email);
    if (existing) {
      return c.json(
        {
          error: 'account_exists',
          message:
            'An account already exists for this email. Log in at https://og-engine.com/auth/login to retrieve your API key.',
          docs: 'https://og-engine.com/api-reference/errors#account_exists',
        },
        409,
      );
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
