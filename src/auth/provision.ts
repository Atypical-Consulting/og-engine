import { createApiKey, createUser, findApiKeyByEmail, findUserByEmail, type Plan } from '../db';
import { sendWelcomeEmail } from '../email/send';
import { defer } from '../utils/defer';
import { normalizeEmail } from '../utils/email';

export interface FreeAccountResult {
  /** The normalized address the account is keyed on. */
  email: string;
  apiKey: string;
  plan: Plan;
  limit: number;
  /** False when the address already had an account — nothing was written. */
  created: boolean;
}

/**
 * Free-tier provisioning, shared by the JSON API (`POST /auth/register`) and the
 * self-serve signup page (`POST /signup`).
 *
 * The address is normalized through `normalizeEmail` before it is looked up or
 * written, so `Dev@Example.com` and `dev@example.com` resolve to one account.
 * Repeat calls are a no-op that returns the existing key rather than an error,
 * so a double-submitted form cannot strand a developer.
 *
 * The welcome email is deferred: the account row and the key are committed
 * before it is attempted, so a Resend outage costs the email, never the
 * account. It is sent only on first provisioning — re-sending a live credential
 * to anyone who types an address into a public form is an email-bomb vector, so
 * key recovery for an existing account goes through the rate-limited magic-link
 * flow at `/auth/login` instead.
 */
export function provisionFreeAccount(rawEmail: string): FreeAccountResult {
  const email = normalizeEmail(rawEmail);

  // Per DECISIONS.md Decision 4: duplicate registration returns the existing key.
  const existingKey = findApiKeyByEmail(email);
  if (existingKey) {
    const user = findUserByEmail(email);
    return {
      email,
      apiKey: existingKey.key,
      plan: user?.plan ?? 'free',
      limit: user?.calls_limit ?? 500,
      created: false,
    };
  }

  const user = createUser(email, 'free');
  const record = createApiKey(user.id);

  defer(sendWelcomeEmail(email, record.key, user.plan), 'sendWelcomeEmail');

  return {
    email,
    apiKey: record.key,
    plan: user.plan,
    limit: user.calls_limit,
    created: true,
  };
}
