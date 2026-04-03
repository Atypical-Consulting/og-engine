/**
 * SQLite compatibility layer.
 * Uses bun:sqlite when running in Bun, better-sqlite3 otherwise (vitest/Node).
 */

export interface SqliteDatabase {
  exec(sql: string): void;
  prepare(sql: string): SqliteStatement;
  close(): void;
}

export interface SqliteStatement {
  run(...params: unknown[]): void;
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
}

const isBun = typeof globalThis.Bun !== 'undefined';

export function openDatabase(path: string): SqliteDatabase {
  if (isBun) {
    return openBunSqlite(path);
  }
  return openBetterSqlite(path);
}

function openBunSqlite(path: string): SqliteDatabase {
  const { Database } = require('bun:sqlite');
  const db = new Database(path, { create: true });
  db.exec('PRAGMA journal_mode=WAL');
  db.exec('PRAGMA foreign_keys=ON');

  return {
    exec: (sql: string) => db.exec(sql),
    prepare: (sql: string) => {
      const stmt = db.prepare(sql);
      // bun:sqlite named params need $-prefixed keys in the object
      const prefixKeys = (obj: Record<string, unknown>): Record<string, unknown> => {
        const result: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(obj)) {
          result[k.startsWith('$') ? k : `$${k}`] = v;
        }
        return result;
      };
      const isObj = (p: unknown): p is Record<string, unknown> =>
        typeof p === 'object' && p !== null && !Array.isArray(p);
      return {
        run: (...params: unknown[]) => {
          if (params.length === 1 && isObj(params[0])) return stmt.run(prefixKeys(params[0]));
          return stmt.run(...params);
        },
        get: (...params: unknown[]) => {
          if (params.length === 1 && isObj(params[0])) return stmt.get(prefixKeys(params[0]));
          return stmt.get(...params);
        },
        all: (...params: unknown[]) => {
          if (params.length === 1 && isObj(params[0])) return stmt.all(prefixKeys(params[0]));
          return stmt.all(...params);
        },
      };
    },
    close: () => db.close(),
  };
}

function openBetterSqlite(path: string): SqliteDatabase {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const BetterSqlite = require('better-sqlite3');
  const db = new BetterSqlite(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  return {
    exec: (sql: string) => db.exec(sql),
    prepare: (sql: string) => {
      const stmt = db.prepare(sql);
      return {
        run: (...params: unknown[]) => stmt.run(...params),
        get: (...params: unknown[]) => stmt.get(...params),
        all: (...params: unknown[]) => stmt.all(...params),
      };
    },
    close: () => db.close(),
  };
}
