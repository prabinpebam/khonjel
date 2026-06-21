/**
 * Forward-only schema migrations. Each migration has a stable `id` and an idempotent-by-runner
 * `up(db)`; the runner applies pending migrations in order, each in a transaction, tracking
 * applied ids in `_migrations` (see migrate.ts). New phases append migrations — never edit or
 * reorder shipped ones. Schema reference: backend/09-data-and-storage.md §3.
 */
import type Database from "better-sqlite3";

export interface Migration {
  id: string;
  up: (db: Database.Database) => void;
}

export const MIGRATIONS: Migration[] = [
  {
    // Phase 0 / T0.6: the settings source-of-truth row (renderer's two flat maps as JSON).
    id: "0001_init_settings",
    up: (db) => {
      db.exec(`
        CREATE TABLE settings (
          id          INTEGER PRIMARY KEY CHECK (id = 1),
          doc         TEXT NOT NULL,            -- JSON { toggles: {..}, values: {..} }
          schema_ver  INTEGER NOT NULL,
          updated_at  TEXT NOT NULL
        );
      `);
    },
  },
];
