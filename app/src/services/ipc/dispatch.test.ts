import { describe, it, expect } from "vitest";
import { createDispatch, type DispatchDeps } from "@ipc/dispatch";
import { isIpcError } from "@ipc/ipc-contract";
import type { AccelerationPlan, GpuProfile } from "@services/ports";

const GPU_PROFILE: GpuProfile = {
  os: "win32",
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

/**
 * BE1/BE2 — the pure dispatch layer (Phase 0, T0.5). Deps are injected so handlers stay pure
 * and node-free (the real db/keychain are constructed in the electron composition root later).
 */
const deps: DispatchDeps = {
  profile: { get: () => ({ id: "local", name: "You" }) },
  system: { getAppVersion: () => "1.2.3", getPlatform: () => "win32", injectText: () => ({ strategy: "paste" }), captureSelection: () => "" },
  settings: {
    get: () => ({ toggles: {}, values: {} }),
    patch: (patch) => ({ toggles: { ...(patch.toggles ?? {}) }, values: { ...(patch.values ?? {}) } }),
  },
  inference: {
    cleanup: (input) => ({ text: input, cleaned: false, mode: "dictation" }),
    chat: (messages) => ({ text: `reply:${messages.length}` }),
  },
  transcription: {
    transcribe: (req) => ({ text: `heard:${req.audioBase64}` }),
  },
  connections: {
    list: () => [],
    upsert: (profile) => [profile],
    remove: () => [],
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
        os: "win32",
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
  },
};

describe("createDispatch", () => {
  const dispatch = createDispatch(deps);

  it("routes a known channel to its handler", async () => {
    expect(await dispatch("system:getAppVersion")).toBe("1.2.3");
    expect(await dispatch("system:getPlatform")).toBe("win32");
    expect(await dispatch("profile:get")).toEqual({ id: "local", name: "You" });
  });

  it("rejects an unknown channel with a not_found IpcError", async () => {
    await expect(dispatch("nope:nope")).rejects.toSatisfy((e: unknown) => isIpcError(e) && e.code === "not_found");
  });

  it("rejects an over-supplied payload with a validation IpcError", async () => {
    await expect(dispatch("system:getAppVersion", "unexpected-arg")).rejects.toSatisfy(
      (e: unknown) => isIpcError(e) && e.code === "validation",
    );
  });
});
