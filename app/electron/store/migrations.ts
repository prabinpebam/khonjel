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
  // Relational tables (transcriptions, notes, folders, dictionary, snippets, transforms,
  // integrations, model_cache, provider_connections) land in Phase 4 migrations (backend/09 §3),
  // where SQLite + the packaging-time native rebuild are justified. Settings are NOT here — they
  // are a native-free JSON file (electron/main/services/settings.ts).
];
