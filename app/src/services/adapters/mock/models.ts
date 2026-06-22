import type {
  ModelManagementService,
  ModelProgress,
  ModelStatus,
} from "@services/ports";
import { STT_MODELS, LLM_MODELS } from "@mock/seed";

/**
 * Mock model management — a stateful in-memory simulation so the browser preview exercises the
 * real four-state UX (07 §2) without a backend. Downloads run on a timer and emit progress to
 * `onProgress` subscribers; integrity/verify always succeed. Local assets only (cloud catalog
 * entries — `sizeLabel === "cloud"` — are not managed here).
 */
const sizeBytes = (label: string): number => {
  const m = /([\d.]+)\s*(GB|MB)/i.exec(label);
  if (!m) return 200 * 1024 * 1024;
  const n = Number(m[1]);
  const unit = (m[2] ?? "MB").toUpperCase();
  return Math.round(n * (unit === "GB" ? 1024 : 1) * 1024 * 1024);
};

const LOCAL = [
  ...STT_MODELS.filter((m) => m.sizeLabel !== "cloud").map((m) => ({ ...m, kind: "stt" as const })),
  ...LLM_MODELS.filter((m) => m.sizeLabel !== "cloud").map((m) => ({ ...m, kind: "llm" as const })),
];

const status = new Map<string, ModelStatus>(
  LOCAL.map((m) => [
    m.id,
    {
      ...m,
      // Seed: the recommended models start installed so the picker has a usable default.
      state: m.recommended ? "installed" : "not-installed",
      engineReady: true,
      bytesTotal: sizeBytes(m.sizeLabel),
      installedBytes: m.recommended ? sizeBytes(m.sizeLabel) : undefined,
      verifiedAt: m.recommended ? new Date().toISOString() : undefined,
    } satisfies ModelStatus,
  ]),
);

const listeners = new Set<(p: ModelProgress) => void>();
const timers = new Map<string, ReturnType<typeof setInterval>>();

function emit(s: ModelStatus): void {
  const p: ModelProgress = {
    id: s.id,
    state: s.state,
    bytesDone: s.bytesDone,
    bytesTotal: s.bytesTotal,
    error: s.error,
  };
  for (const cb of listeners) cb(p);
}

function stopTimer(id: string): void {
  const t = timers.get(id);
  if (t) {
    clearInterval(t);
    timers.delete(id);
  }
}

export const mockModelService: ModelManagementService = {
  status: async () => [...status.values()],
  download: async (id) => {
    const s = status.get(id);
    if (!s || s.state === "installed" || s.state === "downloading") return;
    const total = s.bytesTotal ?? sizeBytes(s.sizeLabel);
    s.state = "downloading";
    s.bytesTotal = total;
    s.bytesDone = 0;
    emit(s);
    stopTimer(id);
    timers.set(
      id,
      setInterval(() => {
        const cur = status.get(id);
        if (!cur) return stopTimer(id);
        cur.bytesDone = Math.min(total, (cur.bytesDone ?? 0) + Math.max(1, Math.round(total / 12)));
        if (cur.bytesDone >= total) {
          stopTimer(id);
          cur.state = "installed";
          cur.installedBytes = total;
          cur.verifiedAt = new Date().toISOString();
          cur.bytesDone = undefined;
        }
        emit(cur);
      }, 350),
    );
  },
  cancel: async (id) => {
    stopTimer(id);
    const s = status.get(id);
    if (!s) return;
    s.state = "not-installed";
    s.bytesDone = undefined;
    emit(s);
  },
  verify: async () => ({ ok: true }),
  remove: async (id) => {
    stopTimer(id);
    const s = status.get(id);
    if (!s) return { freedBytes: 0 };
    const freed = s.installedBytes ?? 0;
    s.state = "not-installed";
    s.installedBytes = undefined;
    s.bytesDone = undefined;
    s.verifiedAt = undefined;
    emit(s);
    return { freedBytes: freed };
  },
  storage: async () => {
    let used = 0;
    for (const s of status.values()) used += s.state === "installed" ? (s.installedBytes ?? 0) : 0;
    return { cachePath: "(browser preview)", usedBytes: used, freeBytes: 64 * 1024 * 1024 * 1024 };
  },
  onProgress: (callback) => {
    listeners.add(callback);
    return () => listeners.delete(callback);
  },
};
