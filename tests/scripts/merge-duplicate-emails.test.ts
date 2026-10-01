/**
 * The merge runs against live customer data, so it is load-bearing in the other
 * direction: it must move the entitlement onto the account the developer logs
 * into without dropping their API key, their render history, or their meter.
 *
 * Each test drops `idx_users_email_nocase` first, because that index is exactly
 * what makes the split unrepresentable — the pre-fix state has to be recreated
 * by hand.
 */

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { loadGroups, mergeDuplicateEmails } from '../../scripts/merge-duplicate-emails';
import { closeDb, countSplitIdentityEmails, getDb } from '../../src/db';

beforeEach(() => {
  closeDb();
  process.env.DATABASE_URL = 'file::memory:';
  getDb().exec('DROP INDEX IF EXISTS idx_users_email_nocase');
});

afterAll(() => {
  closeDb();
  delete process.env.DATABASE_URL;
});

function insertUser(row: {
  id: string;
  email: string;
  plan: string;
  limit: number;
  used: number;
  customer?: string;
  subscription?: string;
  createdAt: string;
}): void {
  getDb()
    .prepare(
      `INSERT INTO users (id, email, plan, stripe_customer_id, stripe_subscription_id, calls_limit, calls_used, period_start, created_at, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    )
    .run(
      row.id,
      row.email,
      row.plan,
      row.customer ?? null,
      row.subscription ?? null,
      row.limit,
      row.used,
      row.createdAt,
      row.createdAt,
    );
}

function insertKey(id: string, key: string, email: string, userId: string): void {
  getDb()
    .prepare('INSERT INTO api_keys (id, key, email, user_id, created_at, active) VALUES (?, ?, ?, ?, ?, 1)')
    .run(id, key, email, userId, '2026-01-01T00:00:00.000Z');
}

/** Reproduces ATY-58 exactly: signup lowercase, then pay with different capitalisation. */
function seedSplitAccount(): void {
  insertUser({
    id: 'user-signup',
    email: 'dev@example.com',
    plan: 'free',
    limit: 500,
    used: 120,
    createdAt: '2026-01-01T00:00:00.000Z',
  });
  insertUser({
    id: 'user-orphan',
    email: 'Dev@Example.com',
    plan: 'pro',
    limit: 50_000,
    used: 0,
    customer: 'cus_PAID',
    subscription: 'sub_PAID',
    createdAt: '2026-02-01T00:00:00.000Z',
  });
  insertKey('key-signup', 'oge_sk_signup', 'dev@example.com', 'user-signup');
  insertKey('key-orphan', 'oge_sk_orphan', 'Dev@Example.com', 'user-orphan');
  getDb()
    .prepare(
      `INSERT INTO render_history (id, user_id, api_key_id, endpoint, request_payload, format, created_at)
       VALUES (?, ?, ?, ?, '{}', 'png', '2026-01-15 10:00:00')`,
    )
    .run('render-1', 'user-signup', 'key-signup', '/render');
}

describe('merge-duplicate-emails', () => {
  it('reports the split before anything is written', () => {
    seedSplitAccount();

    const counts = countSplitIdentityEmails();
    expect(counts.groups).toBe(1);
    expect(counts.user_rows).toBe(2);
    expect(counts.non_canonical_rows).toBe(1);

    const groups = loadGroups();
    expect(groups).toHaveLength(1);
    // Oldest first — the survivor is the account the developer logs into.
    expect(groups[0].map((u) => u.id)).toEqual(['user-signup', 'user-orphan']);

    // Reporting must not mutate.
    expect((getDb().prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number }).n).toBe(2);
  });

  it('moves the paid entitlement onto the account the developer logs into', () => {
    seedSplitAccount();
    mergeDuplicateEmails(loadGroups());

    const users = getDb().prepare('SELECT * FROM users').all() as {
      id: string;
      email: string;
      plan: string;
      calls_limit: number;
      calls_used: number;
      stripe_customer_id: string | null;
      stripe_subscription_id: string | null;
    }[];

    expect(users).toHaveLength(1);
    expect(users[0].id).toBe('user-signup');
    expect(users[0].email).toBe('dev@example.com');
    expect(users[0].plan).toBe('pro');
    expect(users[0].calls_limit).toBe(50_000);
    expect(users[0].stripe_customer_id).toBe('cus_PAID');
    expect(users[0].stripe_subscription_id).toBe('sub_PAID');
    // The meter is carried over, not reset — merging must not gift a fresh quota.
    expect(users[0].calls_used).toBe(120);
  });

  it('keeps both API keys and the render history attached to the survivor', () => {
    seedSplitAccount();
    mergeDuplicateEmails(loadGroups());

    const keys = getDb().prepare('SELECT * FROM api_keys ORDER BY id').all() as {
      id: string;
      email: string;
      user_id: string;
    }[];
    expect(keys).toHaveLength(2);
    expect(keys.every((k) => k.user_id === 'user-signup')).toBe(true);
    expect(keys.map((k) => k.email)).toEqual(['dev@example.com', 'dev@example.com']);

    const renders = getDb().prepare('SELECT * FROM render_history').all() as { user_id: string }[];
    expect(renders).toHaveLength(1);
    expect(renders[0].user_id).toBe('user-signup');
  });

  it('installs the unique index so the split cannot come back', () => {
    seedSplitAccount();
    mergeDuplicateEmails(loadGroups());

    expect(countSplitIdentityEmails()).toEqual({ groups: 0, user_rows: 0, non_canonical_rows: 0 });
    expect(() =>
      insertUser({
        id: 'user-new',
        email: 'DEV@EXAMPLE.COM',
        plan: 'free',
        limit: 500,
        used: 0,
        createdAt: '2026-03-01T00:00:00.000Z',
      }),
    ).toThrow();
  });

  it('canonicalises a non-duplicated row that merely has the wrong case', () => {
    insertUser({
      id: 'user-solo',
      email: ' Solo@Example.com ',
      plan: 'starter',
      limit: 10_000,
      used: 5,
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    insertKey('key-solo', 'oge_sk_solo', ' Solo@Example.com ', 'user-solo');

    expect(loadGroups()).toHaveLength(0);
    mergeDuplicateEmails(loadGroups());

    expect((getDb().prepare('SELECT email FROM users').get() as { email: string }).email).toBe('solo@example.com');
    expect((getDb().prepare('SELECT email FROM api_keys').get() as { email: string }).email).toBe('solo@example.com');
    // The plan is untouched: this row was never in conflict with anything.
    expect((getDb().prepare('SELECT plan FROM users').get() as { plan: string }).plan).toBe('starter');
  });

  it('prefers the scale subscription when a group holds more than one paid row', () => {
    insertUser({
      id: 'user-a',
      email: 'multi@example.com',
      plan: 'starter',
      limit: 10_000,
      used: 10,
      customer: 'cus_OLD',
      subscription: 'sub_OLD',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    insertUser({
      id: 'user-b',
      email: 'Multi@Example.com',
      plan: 'scale',
      limit: 200_000,
      used: 3,
      customer: 'cus_NEW',
      subscription: 'sub_NEW',
      createdAt: '2026-02-01T00:00:00.000Z',
    });

    mergeDuplicateEmails(loadGroups());

    const user = getDb().prepare('SELECT * FROM users').get() as {
      id: string;
      plan: string;
      calls_limit: number;
      calls_used: number;
      stripe_subscription_id: string;
    };
    expect(user.id).toBe('user-a');
    expect(user.plan).toBe('scale');
    expect(user.calls_limit).toBe(200_000);
    expect(user.stripe_subscription_id).toBe('sub_NEW');
    expect(user.calls_used).toBe(10);
  });
});
