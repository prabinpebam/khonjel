// @vitest-environment node
import { describe, it, expect } from "vitest";
import { runMigrations, appliedMigrationCount } from "./migrate";
import { MIGRATIONS, type Migration, type MigrationDb } from "./migrations";

interface FakeStatement {
  all(): unknown[];
  get(): unknown;
  run(...args: unknown[]): unknown;
}

/**
 * BE1 — the migration runner (Phase 0, T0.6). Uses a tiny native-free DB fake for the handful of
 * `better-sqlite3` methods the runner calls, so this test lane stays green even when the optional
 * native binding is not compiled locally. The real SQLite adapter is exercised when SQLite becomes
 * a runtime dependency again.
 */
class FakeDb implements MigrationDb {
  readonly applied = new Set<string>();
  readonly execs: string[] = [];

  pragma(): void {
    // no-op for the fake
  }

  exec(sql: string): void {
    this.execs.push(sql);
  }

  prepare(sql: string): FakeStatement {
    if (/SELECT id FROM _migrations/i.test(sql)) {
      return {
        all: () => [...this.applied].map((id) => ({ id })),
        get: () => undefined,
        run: () => undefined,
      };
    }
    if (/INSERT INTO _migrations/i.test(sql)) {
      return {
        all: () => [],
        get: () => undefined,
        run: (id) => {
          if (typeof id === "string") this.applied.add(id);
        },
      };
    }
    if (/SELECT COUNT\(\*\) AS n FROM _migrations/i.test(sql)) {
      return {
        all: () => [],
        get: () => ({ n: this.applied.size }),
        run: () => undefined,
      };
    }
    throw new Error(`unexpected prepared statement: ${sql}`);
  }

  transaction<T extends (...args: never[]) => unknown>(fn: T): T {
    return ((...args: Parameters<T>) => fn(...args)) as T;
  }

  close(): void {
    // no-op for the fake
  }
}

function freshDb() {
  return new FakeDb();
}

describe("runMigrations", () => {
  it("applies all pending migrations and tracks the version", () => {
    const db = freshDb();
    const applied = runMigrations(db);
    expect(applied).toEqual(MIGRATIONS.map((m) => m.id));
    expect(appliedMigrationCount(db)).toBe(MIGRATIONS.length);
    db.close();
  });

  it("is idempotent — a second run applies nothing and does not throw", () => {
    const db = freshDb();
    runMigrations(db);
    expect(runMigrations(db)).toEqual([]);
    expect(appliedMigrationCount(db)).toBe(MIGRATIONS.length);
    db.close();
  });

  it("only applies migrations not yet recorded (forward-only, partial)", () => {
    const db = freshDb();
    const a: Migration = { id: "0001_a", up: (d) => d.exec("CREATE TABLE a (x)") };
    const b: Migration = { id: "0002_b", up: (d) => d.exec("CREATE TABLE b (x)") };
    expect(runMigrations(db, [a])).toEqual(["0001_a"]);
    expect(runMigrations(db, [a, b])).toEqual(["0002_b"]);
    db.close();
  });
});
