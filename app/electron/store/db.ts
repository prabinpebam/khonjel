/**
 * Opens the local SQLite database and brings it up to date. The composition root (electron main)
 * calls this on boot with `<userData>/khonjel.db` BEFORE any handler serves traffic; a failed
 * migration throws and aborts boot. Tests call it with `:memory:`.
 *
 * NOTE: better-sqlite3 is a native module — under Electron it must be rebuilt for the Electron
 * ABI (electron-builder `install-app-deps` / @electron/rebuild). It is wired into the live boot
 * when the first handler needs it (settings, T0.7); the migration runner itself is node-tested now.
 */
import Database from "better-sqlite3";
import { runMigrations } from "./migrate";

export type AppDatabase = Database.Database;

export function openDatabase(filename: string): AppDatabase {
  const db = new Database(filename);
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  return db;
}
