/**
 * Model install-state index (07 §7): the durable per-asset record, persisted as a native-free
 * JSON document at `<userData>/models/index.json` (consistent with settings — no better-sqlite3
 * rebuild; identical in the Node test lane, dev, and packaged app). IO is injected so the store is
 * BE1-tested in memory. Migrates into the `model_cache` table later; the shape is the same.
 */
import type { ModelErrorCode, ModelInstallState } from "../../../src/services/ports";
import type { SettingsIO } from "../services/settings";

export interface ModelIndexEntry {
  state: ModelInstallState;
  bytesDone?: number;
  bytesTotal?: number;
  sha256?: string;
  installedBytes?: number;
  verifiedAt?: string;
  errorCode?: ModelErrorCode;
}

export type ModelIndex = Record<string, ModelIndexEntry>;

export interface ModelIndexStore {
  all: () => ModelIndex;
  get: (id: string) => ModelIndexEntry | undefined;
  set: (id: string, entry: ModelIndexEntry) => void;
  patch: (id: string, partial: Partial<ModelIndexEntry>) => ModelIndexEntry;
  remove: (id: string) => void;
}

function parse(doc: string | null): ModelIndex {
  if (!doc) return {};
  try {
    const parsed = JSON.parse(doc) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as ModelIndex) : {};
  } catch {
    return {};
  }
}

export function createModelIndexStore(io: SettingsIO): ModelIndexStore {
  const read = (): ModelIndex => parse(io.read());
  const write = (index: ModelIndex): void => io.write(JSON.stringify(index, null, 2));

  return {
    all: () => read(),
    get: (id) => read()[id],
    set: (id, entry) => {
      const index = read();
      index[id] = entry;
      write(index);
    },
    patch: (id, partial) => {
      const index = read();
      const next: ModelIndexEntry = { ...(index[id] ?? { state: "not-installed" }), ...partial };
      index[id] = next;
      write(index);
      return next;
    },
    remove: (id) => {
      const index = read();
      delete index[id];
      write(index);
    },
  };
}
