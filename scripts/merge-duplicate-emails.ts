/**
 * Merge accounts that were split across case variants of the same email.
 *
 * Before ATY-58, nothing canonicalised an email on a live path, so a developer
 * who signed up as `dev@example.com` and then typed `Dev@Example.com` at Stripe
 * checkout ended up with two `users` rows: one holding the plan they paid for,
 * one holding the API key they actually ship with. `src/utils/email.ts` stops
 * new splits. This merges the historical ones and then installs the unique
 * NOCASE index that makes the split unrepresentable.
 *
 * Usage (report only — never writes):
 *   bun run scripts/merge-duplicate-emails.ts
 *
 * Usage (apply):
 *   bun run scripts/merge-duplicate-emails.ts --apply
 *
 * Against production (SQLite lives on the Fly volume at /data/og-engine.db):
 *   fly ssh console -a og-engine -C "bun run scripts/merge-duplicate-emails.ts"
 *   fly ssh console -a og-engine -C "bun run scripts/merge-duplicate-emails.ts --apply"
 *
 * ROLLBACK
 * --apply first writes a consistent snapshot of the database next to it via
 * SQLite `VACUUM INTO`, and prints its path. To undo everything:
 *
 *   1. Stop the app:     fly scale count 0 -a og-engine
 *   2. Restore:          mv /data/og-engine.db.pre-aty58-<stamp> /data/og-engine.db
 *                        rm -f /data/og-engine.db-wal /data/og-engine.db-shm
 *   3. Start the app:    fly scale count 1 -a og-engine
 *
 * To roll back the schema change only, leaving the merged rows in place:
 *
 *   DROP INDEX IF EXISTS idx_users_email_nocase;
 *   DROP INDEX IF EXISTS idx_api_keys_email_nocase;
 *   DROP INDEX IF EXISTS idx_magic_links_email_nocase;
 *
 * The merge itself runs in a single transaction: a failure part-way through
 * leaves the database exactly as it was, with no snapshot restore needed.
 */

import { countSplitIdentityEmails, getDb, PLAN_LIMITS, type Plan } from '../src/db/index';

interface UserRow {
  id: string;
  email: string;
  plan: Plan;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  calls_used: number;
  created_at: string;
}

const PLAN_RANK: Record<Plan, number> = { free: 0, starter: 1, pro: 2, scale: 3 };

/** Never print a full address: these reports end up in logs and task comments. */
function mask(email: string): string {
  const [local = '', domain = ''] = email.split('@');
  const head = local.slice(0, 1) || '?';
  return `${head}${'*'.repeat(Math.max(local.length - 1, 1))}@${domain}`;
}

/**
 * The row whose entitlement the merged account should keep: the best plan, and
 * among equal plans the one Stripe is actually billing.
 */
function bestEntitlement(group: UserRow[]): UserRow {
  return [...group].sort((a, b) => {
    const byPlan = PLAN_RANK[b.plan] - PLAN_RANK[a.plan];
    if (byPlan !== 0) return byPlan;
    const byStripe = Number(Boolean(b.stripe_subscription_id)) - Number(Boolean(a.stripe_subscription_id));
    if (byStripe !== 0) return byStripe;
    return b.created_at.localeCompare(a.created_at);
  })[0];
}

function loadGroups(): UserRow[][] {
  const d = getDb();
  const keys = d
    .prepare('SELECT lower(trim(email)) AS k FROM users GROUP BY k HAVING COUNT(*) > 1 ORDER BY k')
    .all() as { k: string }[];

  return keys.map(
    ({ k }) =>
      d
        .prepare('SELECT * FROM users WHERE lower(trim(email)) = ? ORDER BY created_at ASC')
        .all(k) as UserRow[],
  );
}

function report(groups: UserRow[][]): void {
  const counts = countSplitIdentityEmails();
  console.log('--- split-identity email report ---');
  console.log(`duplicate groups          : ${counts.groups}`);
  console.log(`users rows in those groups: ${counts.user_rows}`);
  console.log(`non-canonical email rows  : ${counts.non_canonical_rows}`);

  if (groups.length === 0) {
    console.log('\nNothing to merge.');
    return;
  }

  console.log('\nPer group (survivor = oldest row, the account the developer logs into):');
  for (const group of groups) {
    const survivor = group[0];
    const best = bestEntitlement(group);
    const paying = group.filter((u) => u.stripe_subscription_id).length;
    console.log(`\n  ${mask(survivor.email.toLowerCase().trim())} — ${group.length} rows, ${paying} with a subscription`);
    for (const u of group) {
      const marks = [u.id === survivor.id ? 'survivor' : 'merge', u.id === best.id ? 'entitlement' : null]
        .filter(Boolean)
        .join(', ');
      console.log(
        `    ${u.plan.padEnd(7)} sub=${(u.stripe_subscription_id ?? '-').padEnd(20)} used=${String(u.calls_used).padEnd(7)} created=${u.created_at}  (${marks})`,
      );
    }
    console.log(`    → merged account keeps plan '${best.plan}' and subscription '${best.stripe_subscription_id ?? '-'}'`);
  }
}

function snapshot(): string | null {
  const raw = process.env.DATABASE_URL?.replace('file:', '');
  if (!raw || raw === ':memory:' || raw.startsWith(':memory:')) {
    console.log('In-memory database — no snapshot taken.');
    return null;
  }
  const path = `${raw}.pre-aty58-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  // VACUUM INTO writes a consistent single-file copy, including anything still
  // sitting in the WAL. Copying the .db alone would not.
  getDb().exec(`VACUUM INTO '${path.replace(/'/g, "''")}'`);
  console.log(`Snapshot written: ${path}`);
  return path;
}

function apply(groups: UserRow[][]): void {
  const d = getDb();
  const snapshotPath = snapshot();

  d.exec('BEGIN');
  try {
    let merged = 0;

    for (const group of groups) {
      const survivor = group[0];
      const best = bestEntitlement(group);
      const losers = group.slice(1);

      // Keep the highest meter reading rather than resetting it — a merge must
      // not hand out a fresh free quota.
      const callsUsed = Math.max(...group.map((u) => u.calls_used));
      const customerId = best.stripe_customer_id ?? group.find((u) => u.stripe_customer_id)?.stripe_customer_id ?? null;
      const subscriptionId =
        best.stripe_subscription_id ?? group.find((u) => u.stripe_subscription_id)?.stripe_subscription_id ?? null;

      d.prepare(
        `UPDATE users
         SET email = lower(trim(email)), plan = ?, calls_limit = ?, calls_used = ?,
             stripe_customer_id = ?, stripe_subscription_id = ?
         WHERE id = ?`,
      ).run(best.plan, PLAN_LIMITS[best.plan], callsUsed, customerId, subscriptionId, survivor.id);

      for (const loser of losers) {
        // Repoint every child row before the delete: api_keys has a plain FK to
        // users(id) and would block it, render_history/sessions cascade and
        // would silently lose the customer's history.
        d.prepare('UPDATE api_keys SET user_id = ? WHERE user_id = ?').run(survivor.id, loser.id);
        d.prepare('UPDATE render_history SET user_id = ? WHERE user_id = ?').run(survivor.id, loser.id);
        d.prepare('UPDATE sessions SET user_id = ? WHERE user_id = ?').run(survivor.id, loser.id);
        d.prepare('DELETE FROM users WHERE id = ?').run(loser.id);
      }

      merged += losers.length;
    }

    // Rows that were never duplicated but still hold a non-canonical address.
    const users = d.prepare('UPDATE users SET email = lower(trim(email)) WHERE email <> lower(trim(email))').run();
    const keys = d.prepare('UPDATE api_keys SET email = lower(trim(email)) WHERE email <> lower(trim(email))').run();
    const links = d.prepare('UPDATE magic_links SET email = lower(trim(email)) WHERE email <> lower(trim(email))').run();

    d.exec('COMMIT');

    console.log(`\nMerged ${merged} duplicate row(s) into ${groups.length} account(s).`);
    console.log(`Canonicalised: users=${users.changes}, api_keys=${keys.changes}, magic_links=${links.changes}`);
  } catch (err) {
    d.exec('ROLLBACK');
    console.error('\nMerge failed and was rolled back. The database is unchanged.');
    if (snapshotPath) console.error(`Snapshot left in place for inspection: ${snapshotPath}`);
    throw err;
  }

  // Now that the data is canonical the guarantee can be installed. Outside the
  // transaction so a pre-existing index is not treated as a merge failure.
  try {
    d.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_nocase ON users(email COLLATE NOCASE);');
    console.log('Unique index idx_users_email_nocase is in place.');
  } catch (err) {
    console.error('Could not create idx_users_email_nocase — re-run the report to see what is still split.', err);
    process.exitCode = 1;
    return;
  }

  const after = countSplitIdentityEmails();
  console.log(
    `Verified: groups=${after.groups}, rows_in_groups=${after.user_rows}, non_canonical=${after.non_canonical_rows}`,
  );
  if (snapshotPath) {
    console.log(`\nRollback: stop the app, mv ${snapshotPath} back over the database, remove -wal/-shm, restart.`);
  }
}

function main(): void {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    console.log('Usage: bun run scripts/merge-duplicate-emails.ts [--apply]');
    console.log('Without --apply this only reports. See the header of this file for the rollback path.');
    return;
  }

  const groups = loadGroups();
  report(groups);

  if (!args.includes('--apply')) {
    if (groups.length > 0) {
      console.log('\nReport only. Re-run with --apply to merge.');
    }
    return;
  }

  if (groups.length === 0) {
    console.log('\n--apply given but there is nothing to merge; installing the unique index only.');
  }

  apply(groups);
}

if (import.meta.main) {
  main();
}

export { bestEntitlement, loadGroups, apply as mergeDuplicateEmails };
