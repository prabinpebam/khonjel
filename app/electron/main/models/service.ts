/**
 * Local model management service (07 §5–§7): the composition glue that joins the catalog manifests,
 * the durable index, the resumable downloader, and storage accounting into the `status / download /
 * cancel / verify / remove / storage` surface, and streams progress to the renderer via `emit`.
 *
 * All IO (fs, free-space, sha256, engine detection, slot bindings) is injected, so the orchestration
 * logic is BE1-tested without electron, native modules, or a real disk. Downloads run one at a time
 * (a tiny internal queue — "queued" is mechanics, not a user control).
 */
import { join } from "node:path";
import type {
  ModelError,
  ModelErrorCode,
  ModelProgress,
  ModelStatus,
} from "../../../src/services/ports";
import { localModels, modelKindOf, modelManifest, type ModelManifest } from "./catalog";
import type { ModelIndexStore } from "./store";
import type { Downloader } from "./downloader";

export interface ModelServiceFs {
  exists: (path: string) => boolean;
  size: (path: string) => number;
  ensureDir: (dir: string) => void;
  remove: (path: string) => void;
  freeBytes: (dir: string) => number;
  sha256: (path: string) => string;
}

export interface ModelServiceDeps {
  modelsDir: string;
  store: ModelIndexStore;
  downloader: Downloader;
  fs: ModelServiceFs;
  /** Whether the runtime binary for an engine is present (whisper-cli / llama-server). */
  engineReady: (engine: ModelManifest["engine"]) => boolean;
  /** Model ids currently bound by a settings slot (for the "In use" tag + remove-safety). */
  boundModelIds: () => Set<string>;
  /** Push a progress tick to the renderer. */
  emit: (progress: ModelProgress) => void;
  /** Optional source override per id (mirror / test hook); falls back to manifest.sources[0]. */
  sourceFor?: (id: string) => string | undefined;
}

export interface ModelService {
  status: () => ModelStatus[];
  download: (id: string) => void;
  cancel: (id: string) => void;
  verify: (id: string) => Promise<{ ok: boolean }>;
  remove: (id: string) => { freedBytes: number };
  storage: () => { cachePath: string; usedBytes: number; freeBytes: number };
  /** Reconcile the index against the disk (cheap presence + size pass). */
  reconcile: () => void;
}

/** Approximate bytes from a "466 MB" / "1.5 GB" label (used when manifest.bytes is unpinned). */
function labelBytes(label: string): number {
  const m = /([\d.]+)\s*(GB|MB)/i.exec(label);
  if (!m) return 256 * 1024 * 1024;
  const unit = (m[2] ?? "MB").toUpperCase();
  return Math.round(Number(m[1]) * (unit === "GB" ? 1024 : 1) * 1024 * 1024);
}

function messageFor(code: ModelErrorCode): string {
  switch (code) {
    case "disk-full":
      return "Not enough disk space.";
    case "source-unavailable":
      return "The download source is unavailable.";
    case "checksum-mismatch":
    case "corrupt":
      return "This file looks incomplete — re-downloading.";
    case "permission":
      return "Can't write to the model folder.";
    default:
      return "Couldn't finish downloading. Try again?";
  }
}

export function createModelService(deps: ModelServiceDeps): ModelService {
  const finalPathOf = (m: ModelManifest): string => join(deps.modelsDir, m.fileName);
  const partPathOf = (m: ModelManifest): string => `${finalPathOf(m)}.part`;

  const controllers = new Map<string, AbortController>();
  const queue: string[] = [];
  let active: string | null = null;

  function progress(id: string): void {
    const entry = deps.store.get(id);
    if (!entry) return;
    deps.emit({
      id,
      state: entry.state,
      bytesDone: entry.bytesDone,
      bytesTotal: entry.bytesTotal,
      error: entry.errorCode ? { code: entry.errorCode, message: messageFor(entry.errorCode) } : undefined,
    });
  }

  function reconcile(): void {
    for (const { info, manifest } of localModels()) {
      const finalPath = finalPathOf(manifest);
      const present = deps.fs.exists(finalPath) && deps.fs.size(finalPath) > 0;
      const sizeOk = manifest.bytes == null || deps.fs.size(finalPath) === manifest.bytes;
      const entry = deps.store.get(info.id);
      if (present && sizeOk) {
        if (!entry || entry.state !== "installed") {
          deps.store.patch(info.id, {
            state: "installed",
            installedBytes: deps.fs.size(finalPath),
            bytesDone: undefined,
            errorCode: undefined,
          });
        }
      } else if (entry?.state === "installed") {
        // The file vanished out from under us.
        deps.store.patch(info.id, { state: "not-installed", installedBytes: undefined });
      }
    }
  }

  function pump(): void {
    if (active || queue.length === 0) return;
    const id = queue.shift();
    if (!id) return;
    active = id;
    void runDownload(id).finally(() => {
      active = null;
      pump();
    });
  }

  async function runDownload(id: string): Promise<void> {
    const manifest = modelManifest(id);
    if (!manifest) return;
    const url = deps.sourceFor?.(id) ?? manifest.sources[0];
    if (!url) {
      deps.store.patch(id, { state: "error", errorCode: "source-unavailable", bytesDone: undefined });
      progress(id);
      return;
    }
    const need = manifest.bytes ?? labelBytes(catalogLabel(id));
    if (deps.fs.freeBytes(deps.modelsDir) < need) {
      deps.store.patch(id, { state: "error", errorCode: "disk-full", bytesDone: undefined });
      progress(id);
      return;
    }
    deps.fs.ensureDir(deps.modelsDir);
    deps.store.patch(id, { state: "downloading", bytesTotal: manifest.bytes ?? need, bytesDone: 0, errorCode: undefined });
    progress(id);

    const controller = new AbortController();
    controllers.set(id, controller);

    const outcome = await deps.downloader.download(
      {
        url,
        partPath: partPathOf(manifest),
        finalPath: finalPathOf(manifest),
        expectedBytes: manifest.bytes,
        sha256: manifest.sha256,
      },
      (bytesDone, bytesTotal) => {
        deps.store.patch(id, { state: "downloading", bytesDone, bytesTotal: bytesTotal ?? manifest.bytes });
        progress(id);
      },
      controller.signal,
    );
    controllers.delete(id);

    if (controller.signal.aborted) {
      deps.fs.remove(partPathOf(manifest));
      deps.store.patch(id, { state: "not-installed", bytesDone: undefined, errorCode: undefined });
      progress(id);
      return;
    }
    if (outcome.ok) {
      deps.store.patch(id, {
        state: "installed",
        installedBytes: outcome.bytes,
        bytesDone: undefined,
        verifiedAt: new Date().toISOString(),
        errorCode: undefined,
      });
    } else {
      deps.store.patch(id, { state: "error", errorCode: outcome.code, bytesDone: undefined });
    }
    progress(id);
  }

  function catalogLabel(id: string): string {
    for (const { info } of localModels()) if (info.id === id) return info.sizeLabel;
    return "";
  }

  function enqueueDownload(id: string): void {
    const manifest = modelManifest(id);
    if (!manifest) return;
    const entry = deps.store.get(id);
    if (entry?.state === "installed") return;
    if (active === id || queue.includes(id)) return;
    queue.push(id);
    deps.store.patch(id, { state: "queued", errorCode: undefined });
    progress(id);
    pump();
  }

  function toStatus(): ModelStatus[] {
    const bound = deps.boundModelIds();
    return localModels().map(({ info, kind, manifest }): ModelStatus => {
      const entry = deps.store.get(info.id);
      const error: ModelError | undefined = entry?.errorCode
        ? { code: entry.errorCode, message: messageFor(entry.errorCode) }
        : undefined;
      return {
        ...info,
        kind,
        state: entry?.state ?? "not-installed",
        bytesDone: entry?.bytesDone,
        bytesTotal: entry?.bytesTotal ?? manifest.bytes,
        engineReady: deps.engineReady(manifest.engine),
        error,
        installedBytes: entry?.installedBytes,
        verifiedAt: entry?.verifiedAt,
        inUse: bound.has(info.id),
      };
    });
  }

  // Bring the index in line with the disk on construction.
  reconcile();

  return {
    status: toStatus,
    reconcile,
    download: (id) => enqueueDownload(id),
    cancel: (id) => {
      const controller = controllers.get(id);
      if (controller) {
        controller.abort();
        return;
      }
      // Not active yet: drop it from the queue.
      const idx = queue.indexOf(id);
      if (idx >= 0) queue.splice(idx, 1);
      const manifest = modelManifest(id);
      if (manifest) deps.fs.remove(partPathOf(manifest));
      deps.store.patch(id, { state: "not-installed", bytesDone: undefined, errorCode: undefined });
      progress(id);
    },
    verify: async (id) => {
      const manifest = modelManifest(id);
      if (!manifest) return { ok: false };
      const finalPath = finalPathOf(manifest);
      // Signal that verification started so the picker shows "Verifying…" (transient, not persisted).
      deps.emit({ id, state: "verifying" });
      // Yield once so the "verifying" tick reaches the renderer before a large synchronous hash
      // blocks the event loop (otherwise the success/failure tick coalesces and nothing is shown).
      await new Promise((resolve) => setImmediate(resolve));

      const present = deps.fs.exists(finalPath) && deps.fs.size(finalPath) > 0;
      const sizeOk = present && (manifest.bytes == null || deps.fs.size(finalPath) === manifest.bytes);
      const hashOk =
        present &&
        (!manifest.sha256 || deps.fs.sha256(finalPath).toLowerCase() === manifest.sha256.toLowerCase());
      if (sizeOk && hashOk) {
        deps.store.patch(id, { state: "installed", verifiedAt: new Date().toISOString(), errorCode: undefined });
        progress(id);
        return { ok: true };
      }
      // Missing or corrupt: drop it and silently re-download (07 §3/§4).
      deps.fs.remove(finalPath);
      deps.store.patch(id, { state: "not-installed", installedBytes: undefined });
      progress(id);
      enqueueDownload(id);
      return { ok: false };
    },
    remove: (id) => {
      const manifest = modelManifest(id);
      if (!manifest) return { freedBytes: 0 };
      const controller = controllers.get(id);
      if (controller) controller.abort();
      const idx = queue.indexOf(id);
      if (idx >= 0) queue.splice(idx, 1);
      const finalPath = finalPathOf(manifest);
      const freed = deps.fs.exists(finalPath) ? deps.fs.size(finalPath) : deps.store.get(id)?.installedBytes ?? 0;
      deps.fs.remove(finalPath);
      deps.fs.remove(partPathOf(manifest));
      deps.store.patch(id, {
        state: "not-installed",
        installedBytes: undefined,
        bytesDone: undefined,
        verifiedAt: undefined,
        errorCode: undefined,
      });
      progress(id);
      return { freedBytes: freed };
    },
    storage: () => {
      let usedBytes = 0;
      for (const { info } of localModels()) {
        const entry = deps.store.get(info.id);
        if (entry?.state === "installed") usedBytes += entry.installedBytes ?? 0;
      }
      return { cachePath: deps.modelsDir, usedBytes, freeBytes: deps.fs.freeBytes(deps.modelsDir) };
    },
  };
}

/** The slot-config dotted keys that bind a model per slot (for inUse + remove-safety). */
export const MODEL_SLOT_KEYS = [
  "stt.dictation.model",
  "stt.note.model",
  "llm.cleanup.model",
  "llm.agent.model",
  "llm.note.model",
  "llm.chat.model",
] as const;

/** Resolve the bound-model id set from a settings `values` map. */
export function boundModelIdsFrom(values: Record<string, string>): Set<string> {
  const out = new Set<string>();
  for (const key of MODEL_SLOT_KEYS) {
    const id = values[key];
    if (id && modelKindOf(id)) out.add(id);
  }
  return out;
}
