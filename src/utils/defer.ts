/**
 * Runs a side-effect without letting its failure reach the caller.
 *
 * For side-effects that must not fail the request that triggered them — a
 * welcome email after the account row is already committed, for instance.
 * Persist state synchronously first, then defer: the account survives a mail
 * provider outage, and the outage shows up in the logs instead of in a 500.
 */
export function defer(promise: Promise<unknown>, context: string): void {
  promise.catch((err) => {
    console.error(`deferred side-effect failed (${context}):`, err);
  });
}
