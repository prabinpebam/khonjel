/**
 * Forward-only schema migrations. Each migration has a stable `id` and an idempotent-by-runner
 * `up(db)`; the runner applies pending migrations in order, each in a transaction, tracking
 * applied ids in `_migrations` (see migrate.ts). New phases append migrations — never edit or
 * reorder shipped ones. Schema reference: backend/09-data-and-storage.md §3.
 */

/** Minimal structural DB surface required by migrations (compatible with better-sqlite3). */
export interface MigrationDb {
  pragma(sql: string): unknown;
  exec(sql: string): unknown;
  prepare(sql: string): {
    all(...args: unknown[]): unknown[];
    get(...args: unknown[]): unknown;
    run(...args: unknown[]): unknown;
  };
  transaction<T extends (...args: never[]) => unknown>(fn: T): T;
}

export interface Migration {
  id: string;
  up: (db: MigrationDb) => void;
}

export const MIGRATIONS: Migration[] = [
  // Relational tables (transcriptions, notes, folders, dictionary, snippets, transforms,
  // integrations, model_cache, provider_connections) land in Phase 4 migrations (backend/09 §3),
  // where SQLite + the packaging-time native rebuild are justified. Settings are NOT here — they
  // are a native-free JSON file (electron/main/services/settings.ts).
];
