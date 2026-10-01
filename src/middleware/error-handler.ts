/**
 * Global unhandled-exception handler.
 *
 * Lives here rather than inline in src/index.ts so it can be mounted on a bare
 * Hono app in tests — src/index.ts registers fonts and starts a server on
 * import.
 *
 * Two jobs:
 *  1. persist the failure to SQLite, so it is readable through /admin/errors
 *     without production log access (ATY-123);
 *  2. hand the caller a correlation id, so support is "give me the id in your
 *     error" instead of a guess.
 *
 * The logging write is best-effort by construction. A broken error_log must
 * never upgrade a 500 into a crashed process.
 */

import type { ErrorHandler } from 'hono';
import { logError } from '../db';

export function newRequestId(): string {
  return crypto.randomUUID().slice(0, 8);
}

export const errorHandler: ErrorHandler = (err, c) => {
  const requestId = newRequestId();
  const message = err instanceof Error ? err.message : String(err);

  console.error(`Unhandled error [${requestId}] ${c.req.method} ${c.req.path}:`, err);

  try {
    logError({
      method: c.req.method,
      path: c.req.path,
      status: 500,
      message,
      stack: err instanceof Error ? (err.stack ?? null) : null,
      requestId,
    });
  } catch (logFailure) {
    // Only the log line is lost; the request still gets its 500.
    console.error(`error_log write failed [${requestId}]:`, logFailure);
  }

  return c.json(
    {
      error: 'server_error',
      message: 'An unexpected error occurred.',
      request_id: requestId,
      docs: 'https://og-engine.com/api-reference/errors#server_error',
    },
    500,
  );
};
