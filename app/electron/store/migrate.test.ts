// @vitest-environment node
import { describe, it, expect } from "vitest";
import Database from "better-sqlite3";
import { runMigrations, appliedMigrationCount } from "./migrate";
import { MIGRATIONS, type Migration } from "./migrations";

/**
 * BE1 — the migration runner (Phase 0, T0.6). Runs against an in-memory SQLite DB (no Electron),
 * proving forward-only, version-tracked, idempotent application.
 */
function freshDb() {
  return new Database(":memory:");
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
