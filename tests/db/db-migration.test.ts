import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, createUser, findUserByEmail, findUserById, getDb } from '../../src/db';

// Use in-memory database for tests
beforeEach(() => {
  closeDb();
  process.env.DATABASE_URL = 'file::memory:';
});

afterEach(() => {
  closeDb();
  delete process.env.DATABASE_URL;
});

describe('users table migration', () => {
  it('creates users table on first access', () => {
    const db = getDb();
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[];
    const names = tables.map((t) => t.name);
    expect(names).toContain('users');
  });

  it('creates index on users.email', () => {
    const db = getDb();
    const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='users'").all() as {
      name: string;
    }[];
    const indexNames = indexes.map((i) => i.name);
    expect(indexNames).toContain('idx_users_email');
  });
});

describe('createUser', () => {
  it('creates a user and retrieves by email', () => {
    const user = createUser('user@example.com');
    expect(user.email).toBe('user@example.com');
    expect(user.plan).toBe('free');
    expect(user.calls_limit).toBe(500);
    expect(user.calls_used).toBe(0);
    expect(user.active).toBe(1);
    expect(user.id).toBeTruthy();

    const found = findUserByEmail('user@example.com');
    expect(found).not.toBeNull();
    expect(found!.id).toBe(user.id);
    expect(found!.email).toBe('user@example.com');
  });

  it('creates a user with a specified plan', () => {
    const user = createUser('pro@example.com', 'pro');
    expect(user.plan).toBe('pro');
    expect(user.calls_limit).toBe(50_000);
  });

  it('enforces unique email constraint', () => {
    createUser('duplicate@example.com');
    expect(() => createUser('duplicate@example.com')).toThrow();
  });
});

describe('findUserByEmail', () => {
  it('returns null for unknown email', () => {
    const found = findUserByEmail('nobody@example.com');
    expect(found).toBeNull();
  });

  it('returns the correct user', () => {
    createUser('alpha@example.com');
    createUser('beta@example.com');

    const found = findUserByEmail('beta@example.com');
    expect(found).not.toBeNull();
    expect(found!.email).toBe('beta@example.com');
  });
});

describe('findUserById', () => {
  it('retrieves user by id', () => {
    const user = createUser('byid@example.com');
    const found = findUserById(user.id);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(user.id);
    expect(found!.email).toBe('byid@example.com');
  });

  it('returns null for unknown id', () => {
    const found = findUserById('00000000-0000-0000-0000-000000000000');
    expect(found).toBeNull();
  });
});
