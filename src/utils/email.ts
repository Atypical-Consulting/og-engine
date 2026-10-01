import { z } from 'zod';

/**
 * Canonical form of an email address, used as the join key for users and API keys.
 *
 * Addresses arrive from several places that disagree about case: a Stripe
 * checkout session echoes whatever the buyer typed, a signup form echoes
 * whatever the browser autofilled, and a magic-link request echoes a third
 * thing. Comparing those raw strings creates a second account for the same
 * person, which is the defect tracked in ATY-58.
 *
 * Lowercasing the whole address (not just the domain) is deliberate. RFC 5321
 * permits a case-sensitive local part, but no mailbox provider in practice
 * treats `Dev@` and `dev@` as different people, and treating them as different
 * people is the bug.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * A Zod field that normalizes before it validates.
 *
 * Order matters: `z.string().email()` rejects `" dev@example.com "`, so a
 * trailing space from a paste or an autofill would be reported to the user as an
 * invalid address. Normalizing first means validation — and everything
 * downstream — only ever sees the canonical form.
 */
export function emailField(message: string) {
  return z.preprocess((v) => (typeof v === 'string' ? normalizeEmail(v) : v), z.string().email(message));
}
