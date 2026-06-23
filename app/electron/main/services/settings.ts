/**
 * Settings domain service (main process): the durable source of truth for the renderer's two
 * flat maps, persisted as a single JSON document (see backend/09 §4).
 *
 * Settings use a **JSON file**, not SQLite: it is small key/value data, and a JSON file is
 * native-free — it works identically in the Node test lane, the dev Electron run, and the
 * packaged app, with NO better-sqlite3 ABI rebuild. SQLite (better-sqlite3) is reserved for the
 * heavier relational data (history/notes/…) in Phase 4, where the packaging rebuild is justified.
 *
 * The persistence IO is injected, so the store is unit-tested with an in-memory IO (BE1) and
 * never touches `fs` in tests. The composition root injects file-backed IO.
 */
import { readFileSync, writeFileSync, chmodSync } from "node:fs";
import type { SettingsPatch, SettingsSnapshot } from "../../../src/services/ports";
import type { Cipher } from "../secrets/store";

/** Pluggable durable IO: returns the persisted JSON doc (or null), and writes a new doc. */
export interface SettingsIO {
  read: () => string | null;
  write: (doc: string) => void;
}

export interface SettingsStore {
  get: () => SettingsSnapshot;
  patch: (patch: SettingsPatch) => SettingsSnapshot;
}

function parse(doc: string | null): SettingsSnapshot {
  if (!doc) return { toggles: {}, values: {} };
  try {
    const parsed = JSON.parse(doc) as Partial<SettingsSnapshot>;
    return { toggles: parsed.toggles ?? {}, values: parsed.values ?? {} };
  } catch {
    return { toggles: {}, values: {} };
  }
}

export function createSettingsStore(io: SettingsIO): SettingsStore {
  return {
    get: () => parse(io.read()),
    patch: (patch) => {
      const current = parse(io.read());
      const next: SettingsSnapshot = {
        toggles: { ...current.toggles, ...(patch.toggles ?? {}) },
        values: { ...current.values, ...(patch.values ?? {}) },
      };
      io.write(JSON.stringify(next));
      return next;
    },
  };
}

/** File-backed IO for the live app: `<userData>/settings.json`. Created user-only (0600). */
export function fileSettingsIO(filePath: string): SettingsIO {
  return {
    read: () => {
      try {
        return readFileSync(filePath, "utf8");
      } catch {
        return null;
      }
    },
    write: (doc) => {
      writeFileSync(filePath, doc, { encoding: "utf8", mode: 0o600 });
      try {
        chmodSync(filePath, 0o600);
      } catch {
        // best-effort: Windows ignores POSIX mode bits (DPAPI protects secrets there instead)
      }
    },
  };
}

/**
 * Encrypts the persisted document at rest with the injected cipher (real impl = Electron
 * safeStorage). Reads transparently decrypt; a legacy plaintext file is read as-is and re-written
 * encrypted on the next save (seamless migration). When OS encryption is unavailable the cipher
 * throws and we fall back to plaintext (no worse than before) so the app keeps working.
 */
export function encryptedSettingsIO(filePath: string, cipher: Cipher): SettingsIO {
  const base = fileSettingsIO(filePath);
  const TAG = "enc:";
  return {
    read: () => {
      const raw = base.read();
      if (raw == null) return null;
      if (raw.startsWith(TAG)) {
        try {
          return cipher.decrypt(raw.slice(TAG.length));
        } catch {
          return null;
        }
      }
      return raw; // legacy plaintext, migrated to ciphertext on next write
    },
    write: (doc) => {
      let out: string;
      try {
        out = `${TAG}${cipher.encrypt(doc)}`;
      } catch {
        out = doc; // encryption unavailable on this host
      }
      base.write(out);
    },
  };
}
