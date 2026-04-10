/**
 * Migration script: populate users table from existing api_keys rows.
 *
 * Safe to run multiple times (idempotent). Only processes api_keys rows
 * that have no user_id set. Deduplicates by email — if two orphaned keys
 * share the same email only one user row is created and both keys are linked
 * to it.
 */

import { getDb, PLAN_LIMITS } from './index';

export interface MigrationResult {
  usersCreated: number;
  keysLinked: number;
  keysAlreadyLinked: number;
}

export function migrateToUserModel(): MigrationResult {
  const db = getDb();

  // All api_keys rows that have no user_id yet
  const orphanedKeys = db
    .prepare('SELECT id, email, created_at FROM api_keys WHERE user_id IS NULL ORDER BY created_at ASC')
    .all() as { id: string; email: string; created_at: string }[];

  if (orphanedKeys.length === 0) {
    return { usersCreated: 0, keysLinked: 0, keysAlreadyLinked: 0 };
  }

  let usersCreated = 0;
  let keysLinked = 0;
  const keysAlreadyLinked = 0; // guard value; we only query unlinked rows above

  // Build an email → user_id map so we deduplicate within this run
  const emailToUserId = new Map<string, string>();

  for (const apiKey of orphanedKeys) {
    const email = apiKey.email.toLowerCase().trim();

    // Check if a users row already exists (from a previous partial run)
    const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email) as { id: string } | null;

    let userId: string;

    if (existingUser) {
      userId = existingUser.id;
    } else if (emailToUserId.has(email)) {
      // Another orphaned key with the same email was already processed in this run
      userId = emailToUserId.get(email)!;
    } else {
      // Create a new user
      userId = crypto.randomUUID();
      const now = new Date().toISOString();

      db.prepare(`
        INSERT INTO users (id, email, plan, stripe_customer_id, stripe_subscription_id, calls_limit, calls_used, period_start, created_at, active)
        VALUES (?, ?, ?, NULL, NULL, ?, 0, ?, ?, 1)
      `).run(userId, email, 'free', PLAN_LIMITS.free, now, now);

      emailToUserId.set(email, userId);
      usersCreated++;
    }

    // Link the api_key row to the resolved user
    db.prepare('UPDATE api_keys SET user_id = ? WHERE id = ?').run(userId, apiKey.id);
    keysLinked++;
  }

  return { usersCreated, keysLinked, keysAlreadyLinked };
}

// Allow running directly: `bun src/db/migrate.ts`
if (import.meta.main) {
  console.log('Running migration: link orphaned api_keys to users …');
  const result = migrateToUserModel();
  console.log(`Done. Users created: ${result.usersCreated}, Keys linked: ${result.keysLinked}`);
}
