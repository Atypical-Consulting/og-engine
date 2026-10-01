/**
 * Canonical form of an email address for identity purposes.
 *
 * Email is the only join key between a Stripe Payment Link purchase and an
 * og-engine account, so `Dev@Example.com` typed at checkout has to resolve to
 * the `dev@example.com` row the developer logs into. Without this, paying
 * customers get a second, orphan account that holds the plan while their real
 * account stays rate-limited on `free`.
 *
 * The `src/db` helpers call this on every email write and every email lookup,
 * so a new entry point cannot reintroduce the split by forgetting to. Call it
 * at HTTP boundaries too, so the value we store, display and email is the same
 * one we matched on.
 *
 * Only case and surrounding whitespace are canonicalised. We deliberately do
 * not strip dots or `+tags`: those are provider-specific conventions, and
 * treating `a.b@example.com` and `ab@example.com` as one identity would merge
 * accounts that the provider considers distinct.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
