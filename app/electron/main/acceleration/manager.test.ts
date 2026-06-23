// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { createAccelerationManager, type ManagerDeps } from "./manager";
import { ProvisionError } from "./provision";
import { activate, backendKey, emptyIndex, recordInstalled, type EngineBackends } from "./backends";
import type { AccelerationMode, GpuProfile, AccelerationPlan } from "../../../src/services/ports";

const PROFILE: GpuProfile = { os: "win32", arch: "x64", devices: [], detectedAt: "t", warnings: [] };
const PLAN: AccelerationPlan = {
  llm: [{ backend: "cuda-12.4", reason: "best", confidence: "high" }, { backend: "cpu", reason: "cpu", confidence: "low" }],
  stt: [{ backend: "cpu", reason: "cpu", confidence: "low" }],
  recommendedLevel: "gpu-great",
  summary: "fast",
  requiresDownload: true,
};

function makeDeps(over: Partial<ManagerDeps> = {}): { deps: ManagerDeps; store: Record<string, EngineBackends>; mode: { value: AccelerationMode } } {
  const store: Record<string, EngineBackends> = { llama: emptyIndex("llama"), whisper: emptyIndex("whisper") };
  const mode = { value: "auto" as AccelerationMode };
  const deps: ManagerDeps = {
    profile: async () => PROFILE,
    rescan: async () => PROFILE,
    plan: async () => PLAN,
    getMode: () => mode.value,
    persistMode: (m) => {
      mode.value = m;
    },
    loadBackends: (engine) => store[engine] ?? emptyIndex(engine),
    saveBackends: (engine, index) => {
      store[engine] = index;
    },
    provision: vi.fn(async () => ({ dir: "/r/llama/cuda-12.4-b9744", version: "b9744" })),
    probe: vi.fn(async () => ({ ok: true, backend: "cuda-12.4" as const, message: "passed" })),
    removeDirs: vi.fn(),
    resetRuntime: vi.fn(),
    isOnline: () => true,
    runBenchmark: vi.fn(async () => ({ ok: true, llm: { ok: true, message: "ok" }, stt: { ok: true, message: "ok" }, summary: "7x" })),
    ...over,
  };
  return { deps, store, mode };
}

describe("acceleration manager", () => {
  it("reports CPU state from an empty index", async () => {
    const { deps } = makeDeps();
    const mgr = createAccelerationManager(deps);
    const s = await mgr.state();
    expect(s.gpuActive).toBe(false);
    expect(s.mode).toBe("auto");
  });

  it("setMode persists and emits the new state", async () => {
    const { deps, mode } = makeDeps();
    const mgr = createAccelerationManager(deps);
    const onState = vi.fn();
    mgr.onState(onState);
    await mgr.setMode("on");
    expect(mode.value).toBe("on");
    expect(onState).toHaveBeenCalledWith(expect.objectContaining({ mode: "on" }));
  });

  it("enable() activates a GPU backend when provision + probe succeed", async () => {
    const { deps, store } = makeDeps();
    const mgr = createAccelerationManager(deps);
    const progress: string[] = [];
    mgr.onProgress((e) => progress.push(e.state));
    await mgr.enable("llama");
    expect(store.llama?.active).toBe(backendKey("cuda-12.4", "b9744"));
    expect(progress).toContain("active");
  });

  it("enable() fails GRACEFULLY (no throw) when provisioning is pin-gated, staying on CPU", async () => {
    const { deps, store } = makeDeps({
      provision: vi.fn(async () => {
        throw new ProvisionError("not_pinned", "GPU support isn't available in this version yet.");
      }),
    });
    const mgr = createAccelerationManager(deps);
    const failures: string[] = [];
    mgr.onProgress((e) => {
      if (e.state === "failed") failures.push(e.message);
    });
    await expect(mgr.enable("llama")).resolves.toBeUndefined();
    expect(failures.length).toBe(1);
    expect(store.llama?.active).toBeUndefined(); // never activated a GPU backend
  });

  it("disable() removes GPU backends and reverts to CPU", async () => {
    const { deps, store } = makeDeps();
    let idx = recordInstalled(emptyIndex("llama"), { backend: "cpu", version: "b9744", dir: "/r/llama/cpu-b9744" });
    idx = recordInstalled(idx, { backend: "cuda-12.4", version: "b9744", dir: "/r/llama/cuda-12.4-b9744" });
    idx = activate(idx, backendKey("cuda-12.4", "b9744"));
    store.llama = idx;
    const mgr = createAccelerationManager(deps);
    await mgr.disable("llama");
    expect(store.llama?.active).toBe(backendKey("cpu", "b9744"));
    expect(deps.removeDirs).toHaveBeenCalled();
  });

  it("runTest delegates to the benchmark", async () => {
    const { deps } = makeDeps();
    const mgr = createAccelerationManager(deps);
    const report = await mgr.runTest();
    expect(report.ok).toBe(true);
  });
});
