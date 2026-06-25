import { describe, it, expect } from "vitest";
import type { ConnectionProfile, Services, AccelerationPlan, AccelerationState, AccelerationTestReport, GpuProfile } from "@services/ports";
import { mockServices } from "@services/adapters/mock";
import { createIpcServices } from "@services/adapters/ipc";
import { createDispatch } from "@ipc/dispatch";

const GPU_PROFILE: GpuProfile = {
  os: "linux",
  arch: "x64",
  devices: [],
  detectedAt: "2026-06-23T00:00:00.000Z",
  warnings: [],
};
const GPU_PLAN: AccelerationPlan = {
  llm: [{ backend: "cpu", reason: "Runs on the processor.", confidence: "low" }],
  stt: [{ backend: "cpu", reason: "Runs on the processor.", confidence: "low" }],
  recommendedLevel: "cpu-only",
  summary: "Running on the CPU.",
  requiresDownload: false,
};
const GPU_STATE: AccelerationState = {
  mode: "auto",
  llm: { engine: "llama", device: "cpu", state: "none", message: "Running on the CPU." },
  stt: { engine: "whisper", device: "cpu", state: "none", message: "Running on the CPU." },
  gpuActive: false,
  online: true,
  summary: "Running on the CPU.",
};
const GPU_TEST_REPORT: AccelerationTestReport = {
  ok: true,
  llm: { ok: true, message: "ok" },
  stt: { ok: true, message: "ok" },
  summary: "ok",
};

/**
 * BE3 — adapter parity (Phase 0, T0.4). The mock and the real `ipc` adapter must satisfy the
 * SAME `Services` contract. We wire the ipc adapter to an in-memory loopback (its `invoke`
 * routes straight to the pure dispatch layer), so the whole seam -- adapter, channel,
 * validation, handler, response -- is exercised deterministically without launching Electron.
 */
const settingsState = { toggles: {} as Record<string, boolean>, values: {} as Record<string, string> };
let connectionState: ConnectionProfile[] = [];
const dispatch = createDispatch({
  system: { getAppVersion: () => "9.9.9", getPlatform: () => "linux" as const, getAccountName: () => "prabin", injectText: () => ({ strategy: "paste" as const, app: "notepad.exe" }), captureSelection: () => "selected" },
  settings: {
    get: () => ({ toggles: { ...settingsState.toggles }, values: { ...settingsState.values } }),
    patch: (patch) => {
      Object.assign(settingsState.toggles, patch.toggles ?? {});
      Object.assign(settingsState.values, patch.values ?? {});
      return { toggles: { ...settingsState.toggles }, values: { ...settingsState.values } };
    },
  },
  inference: {
    cleanup: (input, options) => {
      const trimmed = input.trim();
      const looksClean = /^[A-Z].*[.!?]$/.test(trimmed);
      const cleaned = options.cleanupEnabled !== false && !looksClean;
      return { text: trimmed, cleaned, mode: "dictation" };
    },
    chat: (messages) => ({ text: `echo:${messages.at(-1)?.content ?? ""}` }),
  },
  transcription: {
    transcribe: (req) => ({ text: req.audioBase64.length > 0 ? "sample transcript" : "" }),
  },
  connections: {
    list: () => [...connectionState],
    upsert: (profile) => {
      connectionState = connectionState.some((c) => c.id === profile.id)
        ? connectionState.map((c) => (c.id === profile.id ? profile : c))
        : [...connectionState, profile];
      return [...connectionState];
    },
    remove: (id) => {
      connectionState = connectionState.filter((c) => c.id !== id);
      return [...connectionState];
    },
    test: () => ({ ok: true }),
  },
  secrets: {
    set: () => undefined,
    has: () => false,
    remove: () => undefined,
  },
  content: {
    history: () => [],
    insights: () => ({
      wpm: 0,
      wpmPercentile: 0,
      wordsCorrected: 0,
      dictionaryFixes: 0,
      totalWords: 0,
      appUsage: [],
      streak: { current: 0, longest: 0 },
      heatmap: [],
    }),
    chat: () => [],
    folders: () => [],
    notes: () => [],
    uploads: () => [],
    dictionary: () => [],
    snippets: () => [],
    transforms: () => [],
    integrations: () => [],
    sttModels: () => [],
    llmModels: () => [],
    addHistory: () => [],
    replace: () => undefined,
  },
  models: {
    status: () => [],
    compatibility: () => ({
      hardware: {
        os: "linux",
        arch: "x64",
        gpus: [],
        power: "unknown",
        detectionWarnings: [],
      },
      runtimes: [],
      summary: { level: "unknown", title: "Unknown", message: "Unknown" },
      recommended: {},
      models: [],
    }),
    readiness: () => [],
    active: () => ({}),
    prepare: () => undefined,
    download: () => undefined,
    cancel: () => undefined,
    verify: () => ({ ok: true }),
    remove: () => ({ freedBytes: 0 }),
    storage: () => ({ cachePath: "", usedBytes: 0, freeBytes: 0 }),
  },
  capture: {
    start: () => "s1",
    stop: () => ({ text: "" }),
  },
  acceleration: {
    profile: () => GPU_PROFILE,
    rescan: () => GPU_PROFILE,
    plan: () => GPU_PLAN,
    state: () => GPU_STATE,
    setMode: () => undefined,
    enable: () => undefined,
    disable: () => undefined,
    retry: () => undefined,
    runTest: () => GPU_TEST_REPORT,
    removeGpuBackends: () => undefined,
    reset: () => undefined,
  },
});
const ipcServices = createIpcServices((channel, ...args) => dispatch(channel, ...args));

const PLATFORMS = ["win32", "darwin", "linux", "web"];

describe.each<[string, Services]>([
  ["mock", mockServices],
  ["ipc", ipcServices],
])("Services parity — %s adapter", (_name, services) => {
  it("system.getAccountName resolves a non-empty string", async () => {
    const accountName = await services.system.getAccountName();
    expect(typeof accountName).toBe("string");
    expect(accountName.length).toBeGreaterThan(0);
  });

  it("system.getAppVersion resolves a non-empty string", async () => {
    const version = await services.system.getAppVersion();
    expect(typeof version).toBe("string");
    expect(version.length).toBeGreaterThan(0);
  });

  it("system.getPlatform resolves a known platform", async () => {
    expect(PLATFORMS).toContain(await services.system.getPlatform());
  });

  it("settings.patch then get round-trips a flat-map value", async () => {
    await services.settings.patch({ values: { "stt.dictation.mode": "providers" } });
    const snapshot = await services.settings.get();
    expect(snapshot.values["stt.dictation.mode"]).toBe("providers");
  });

  it("inference.cleanup returns a structured result and skips already-clean text", async () => {
    const clean = await services.inference.cleanup("This is already clean.", {});
    expect(clean.cleaned).toBe(false);
    expect(clean.mode).toBe("dictation");
    const messy = await services.inference.cleanup("um so like the the thing", {});
    expect(messy.cleaned).toBe(true);
  });

  it("connections.upsert then list round-trips a profile", async () => {
    await services.connections.upsert({
      id: "p1",
      kind: "azure-openai",
      baseEndpoint: "https://x.cognitiveservices.azure.com",
      authMode: "api-key-header",
    });
    expect((await services.connections.list()).some((c) => c.id === "p1")).toBe(true);
    await services.connections.remove("p1");
    expect((await services.connections.list()).some((c) => c.id === "p1")).toBe(false);
  });

  it("content routes through the seam and resolves an array", async () => {
    expect(Array.isArray(await services.content.notes())).toBe(true);
    expect(Array.isArray(await services.content.sttModels())).toBe(true);
  });

  it("transcription returns text through the seam", async () => {
    const result = await services.transcription.transcribe({ audioBase64: "Zm9v" });
    expect(typeof result.text).toBe("string");
  });

  it("system.injectText returns a valid injection outcome", async () => {
    const outcome = await services.system.injectText("hello world");
    expect(["paste", "type", "clipboard"]).toContain(outcome.strategy);
  });
});
