/**
 * Settings domain service (main process): the durable source of truth for the renderer's two
 * flat maps, stored as one JSON row in `settings` (see backend/09 §4). Per-domain module so the
 * composition root stays thin (architecture §3). DB is injected, so it unit-tests against an
 * in-memory database (BE1) without Electron.
 */
import type Database from "better-sqlite3";
import type { SettingsPatch, SettingsSnapshot } from "../../../src/services/ports";

const SCHEMA_VER = 1;

export interface SettingsStore {
  get: () => SettingsSnapshot;
  patch: (patch: SettingsPatch) => SettingsSnapshot;
}

export function createSettingsStore(db: Database.Database): SettingsStore {
  const read = (): SettingsSnapshot => {
    const row = db.prepare("SELECT doc FROM settings WHERE id = 1").get() as { doc: string } | undefined;
    if (!row) return { toggles: {}, values: {} };
    const parsed = JSON.parse(row.doc) as Partial<SettingsSnapshot>;
    return { toggles: parsed.toggles ?? {}, values: parsed.values ?? {} };
  };

  const write = (snapshot: SettingsSnapshot): void => {
    db.prepare(
      `INSERT INTO settings (id, doc, schema_ver, updated_at) VALUES (1, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET doc = excluded.doc, schema_ver = excluded.schema_ver, updated_at = excluded.updated_at`,
    ).run(JSON.stringify(snapshot), SCHEMA_VER, new Date().toISOString());
  };

  return {
    get: () => read(),
    patch: (patch) => {
      const current = read();
      const next: SettingsSnapshot = {
        toggles: { ...current.toggles, ...(patch.toggles ?? {}) },
        values: { ...current.values, ...(patch.values ?? {}) },
      };
      write(next);
      return next;
    },
  };
}
