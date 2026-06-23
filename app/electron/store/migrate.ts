/**
 * The migration runner: forward-only, version-tracked, idempotent, transactional.
 *
 * - Enables WAL (durability + concurrent reads) on a file database.
 * - Tracks applied migration ids in `_migrations`.
 * - Applies only pending migrations, in order, each wrapped in a transaction so a failure rolls
 *   back cleanly (the caller aborts boot rather than serving a half-migrated DB).
 *
 * Pure w.r.t. the app: it takes a minimal database surface (structural with `better-sqlite3`) so
 * tests do not need to load a native SQLite binding. See backend/09-data-and-storage.md §5.
 */
import { MIGRATIONS, type Migration, type MigrationDb } from "./migrations";

/** Applies pending migrations and returns the ids that were newly applied (in order). */
export function runMigrations(db: MigrationDb, migrations: Migration[] = MIGRATIONS): string[] {
  db.pragma("journal_mode = WAL");
  db.exec(`CREATE TABLE IF NOT EXISTS _migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL);`);

  const appliedRows = db.prepare(`SELECT id FROM _migrations`).all() as Array<{ id: string }>;
  const applied = new Set(appliedRows.map((row) => row.id));
  const insert = db.prepare(`INSERT INTO _migrations (id, applied_at) VALUES (?, ?)`);

  const applyOne = db.transaction((migration: Migration) => {
    migration.up(db);
    insert.run(migration.id, new Date().toISOString());
  });

  const newlyApplied: string[] = [];
  for (const migration of migrations) {
    if (applied.has(migration.id)) continue;
    applyOne(migration);
    newlyApplied.push(migration.id);
  }
  return newlyApplied;
}

/** The current applied schema version = the count of applied migrations. */
export function appliedMigrationCount(db: MigrationDb): number {
  const row = db.prepare(`SELECT COUNT(*) AS n FROM _migrations`).get() as { n: number };
  return row.n;
}
