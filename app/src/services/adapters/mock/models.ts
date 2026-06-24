import type {
  ActiveModelReport,
  HardwareProfile,
  ModelCompatibilityReport,
  ModelManagementService,
  ModelProgress,
  ModelReadiness,
  ModelRuntimeEvent,
  ModelStatus,
  RuntimeStatus,
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
const runtimeListeners = new Set<(event: ModelRuntimeEvent) => void>();
const timers = new Map<string, ReturnType<typeof setInterval>>();

const mockHardware: HardwareProfile = {
  os: "win32",
  arch: "x64",
  cpuName: "Preview PC",
  physicalCores: 8,
  logicalCores: 16,
  totalRamBytes: 16 * 1024 * 1024 * 1024,
  availableRamBytes: 10 * 1024 * 1024 * 1024,
  freeDiskBytes: 64 * 1024 * 1024 * 1024,
  gpus: [{ name: "Preview GPU", vendor: "nvidia", vramBytes: 8 * 1024 * 1024 * 1024 }],
  power: "plugged",
  detectionWarnings: [],
};

const mockRuntimes: RuntimeStatus[] = [
  { engine: "whisper", state: "ready", message: "Speech runtime ready." },
  { engine: "llama", state: "ready", message: "Language runtime ready." },
  { engine: "parakeet", state: "ready", message: "Parakeet runtime ready." },
];

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

function emitRuntime(event: ModelRuntimeEvent): void {
  for (const cb of runtimeListeners) cb(event);
}

function readinessFor(s: ModelStatus): ModelReadiness {
  if (s.state === "installed" && s.engineReady) {
    return { modelId: s.id, kind: s.kind, state: "ready", selected: s.inUse ?? false, active: s.inUse ?? false, reason: "Ready." };
  }
  if (s.state === "installed") {
    return { modelId: s.id, kind: s.kind, state: "runtime-missing", selected: false, active: false, reason: "Runtime missing.", nextAction: "install-runtime" };
  }
  if (s.state === "downloading" || s.state === "queued" || s.state === "paused") {
    return { modelId: s.id, kind: s.kind, state: "downloading", selected: false, active: false, reason: "Downloading model." };
  }
  if (s.state === "verifying") {
    return { modelId: s.id, kind: s.kind, state: "verifying", selected: false, active: false, reason: "Verifying download." };
  }
  if (s.state === "error") {
    return { modelId: s.id, kind: s.kind, state: "failed", selected: false, active: false, reason: s.error?.message ?? "Model needs attention.", nextAction: "retry" };
  }
  return { modelId: s.id, kind: s.kind, state: "not-installed", selected: false, active: false, reason: "Download needed.", nextAction: "download" };
}

function compatibility(): ModelCompatibilityReport {
  const models = [...status.values()].map((s) => {
    return {
      modelId: s.id,
      kind: s.kind,
      level: s.recommended ? ("recommended" as const) : ("works" as const),
      summary: s.recommended ? "Recommended for this PC." : `${s.name} works on this PC.`,
      reasons: [
        { code: "runtime-ready" as const, message: "Runtime ready." },
        { code: "enough-disk" as const, message: "Enough free disk space." },
        { code: "enough-memory" as const, message: "Enough memory." },
      ],
      estimated: { speed: s.recommended ? ("fast" as const) : ("good" as const), firstLoad: s.kind === "llm" ? ("medium" as const) : ("short" as const) },
    };
  });
  return {
    hardware: mockHardware,
    runtimes: mockRuntimes,
    summary: {
      level: "great",
      title: "Great for local models",
      message: "This PC can run the recommended private local setup.",
    },
    recommended: { stt: "ggml-small.bin", llm: "qwen2.5-3b-instruct-q4_k_m.gguf" },
    models,
  };
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
  compatibility: async () => compatibility(),
  readiness: async () => [...status.values()].map(readinessFor),
  active: async (): Promise<ActiveModelReport> => ({
    speech: { selectedModelId: "ggml-small.bin", activeModelId: "ggml-small.bin", state: "ready", message: "Ready." },
    language: { selectedModelId: "qwen2.5-3b-instruct-q4_k_m.gguf", activeModelId: "qwen2.5-3b-instruct-q4_k_m.gguf", state: "ready", message: "Ready." },
  }),
  prepare: async (id) => {
    const s = status.get(id);
    if (!s) return;
    emitRuntime({ modelId: id, kind: s.kind, state: "starting", message: `Loading ${s.name}...` });
    window.setTimeout(() => emitRuntime({ modelId: id, kind: s.kind, state: "ready", message: `${s.name} is ready.`, activeModelId: id }), 300);
  },
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
  verify: async (id) => {
    const s = status.get(id);
    if (!s || s.state !== "installed") return { ok: false };
    s.state = "verifying";
    emit(s);
    await new Promise((r) => setTimeout(r, 450));
    const cur = status.get(id);
    if (cur) {
      cur.state = "installed";
      cur.verifiedAt = new Date().toISOString();
      emit(cur);
    }
    return { ok: true };
  },
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
  onRuntime: (callback) => {
    runtimeListeners.add(callback);
    return () => runtimeListeners.delete(callback);
  },
};
