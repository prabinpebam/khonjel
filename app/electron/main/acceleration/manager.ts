/**
 * Acceleration manager (gpu-acceleration 04). The stateful orchestrator behind the full
 * `AccelerationService`: it owns the user mode, projects `AccelerationState` from the persisted
 * backends index, runs the enable/disable/retry lifecycle (provision -> probe -> activate/rollback),
 * and streams progress + state events. Dependency-injected so it is BE1-testable; the node root binds
 * real provisioning, probing, settings, and persistence.
 *
 * Failure is never thrown to the caller of a verb: a provisioning/probe failure resolves quietly and
 * the emitted state stays on the CPU (the floor never disappears).
 */
import type {
  AccelerationEngine,
  AccelerationMode,
  AccelerationPlan,
  AccelerationProgress,
  AccelerationState,
  AccelerationTestReport,
  Backend,
  GpuProfile,
} from "../../../src/services/ports";
import { backendKey, recordInstalled, removeGpuBackends as removeGpuFromIndex, type EngineBackends } from "./backends";
import { applyProbeOutcome } from "./lifecycle";
import { buildAccelerationState } from "./state";
import { ProvisionError } from "./provision";
import type { ProbeResult } from "./probe";

export interface ManagerDeps {
  profile(): Promise<GpuProfile>;
  rescan(): Promise<GpuProfile>;
  plan(): Promise<AccelerationPlan>;
  getMode(): AccelerationMode;
  persistMode(mode: AccelerationMode): void;
  loadBackends(engine: AccelerationEngine): EngineBackends;
  saveBackends(engine: AccelerationEngine, index: EngineBackends): void;
  /** Provision a backend (pin-gated). Throws ProvisionError on any failure. */
  provision(engine: AccelerationEngine, backend: Backend, onProgress: (bytesDone: number, bytesTotal: number) => void): Promise<{ dir: string; version: string }>;
  probe(engine: AccelerationEngine, backend: Backend, dir: string): Promise<ProbeResult>;
  removeDirs(dirs: string[]): void;
  resetRuntime(): void;
  isOnline(): boolean;
  runBenchmark(): Promise<AccelerationTestReport>;
}

export interface AccelerationManager {
  profile(): Promise<GpuProfile>;
  rescan(): Promise<GpuProfile>;
  plan(): Promise<AccelerationPlan>;
  state(): Promise<AccelerationState>;
  setMode(mode: AccelerationMode): Promise<void>;
  enable(engine: AccelerationEngine, backend?: Backend): Promise<void>;
  disable(engine: AccelerationEngine): Promise<void>;
  retry(engine: AccelerationEngine, backend: Backend): Promise<void>;
  runTest(opts?: { tokens?: number; warmup?: boolean }): Promise<AccelerationTestReport>;
  removeGpuBackends(engine: AccelerationEngine): Promise<void>;
  reset(): Promise<void>;
  onProgress(cb: (event: AccelerationProgress) => void): () => void;
  onState(cb: (state: AccelerationState) => void): () => void;
}

export function createAccelerationManager(deps: ManagerDeps): AccelerationManager {
  const progressListeners = new Set<(e: AccelerationProgress) => void>();
  const stateListeners = new Set<(s: AccelerationState) => void>();
  let notice: AccelerationState["notice"];

  function emitProgress(event: AccelerationProgress): void {
    for (const cb of progressListeners) cb(event);
  }

  function computeState(): AccelerationState {
    return buildAccelerationState({
      mode: deps.getMode(),
      llm: deps.loadBackends("llama"),
      stt: deps.loadBackends("whisper"),
      online: deps.isOnline(),
      notice,
    });
  }

  function notifyState(): void {
    const next = computeState();
    for (const cb of stateListeners) cb(next);
    notice = undefined; // one-shot
  }

  async function recommendedBackend(engine: AccelerationEngine): Promise<Backend> {
    const plan = await deps.plan();
    const list = engine === "llama" ? plan.llm : plan.stt;
    return list[0]?.backend ?? "cpu";
  }

  async function runEnable(engine: AccelerationEngine, backend: Backend): Promise<void> {
    if (backend === "cpu") {
      await disable(engine);
      return;
    }
    emitProgress({ engine, backend, state: "planning", message: "Checking your graphics card" });
    let index = deps.loadBackends(engine);
    try {
      emitProgress({ engine, backend, state: "downloading", message: "Downloading GPU support" });
      const installed = await deps.provision(engine, backend, (bytesDone, bytesTotal) =>
        emitProgress({ engine, backend, state: "downloading", bytesDone, bytesTotal, message: "Downloading GPU support" }),
      );
      index = recordInstalled(index, { backend, version: installed.version, dir: installed.dir });
      emitProgress({ engine, backend, state: "probing", message: "Testing it on your machine" });
      const probe = await deps.probe(engine, backend, installed.dir);
      const outcome = applyProbeOutcome(index, backendKey(backend, installed.version), probe.ok, probe.failCode ? { code: probe.failCode, message: probe.message } : undefined);
      deps.saveBackends(engine, outcome.index);
      if (probe.ok) {
        notice = { kind: "enabled", message: "Your graphics card is now making Khonjel faster." };
        emitProgress({ engine, backend, state: "active", message: "Acceleration is on." });
      } else {
        notice = { kind: "rolled-back", message: probe.message };
        emitProgress({ engine, backend, state: "quarantined", message: probe.message, rolledBackTo: "cpu" });
      }
    } catch (err) {
      const message = err instanceof ProvisionError ? err.message : "Couldn't finish setting up GPU support.";
      notice = { kind: "rolled-back", message };
      emitProgress({ engine, backend, state: "failed", message, rolledBackTo: "cpu" });
    }
    notifyState();
  }

  async function disable(engine: AccelerationEngine): Promise<void> {
    const { index, removedDirs } = removeGpuFromIndex(deps.loadBackends(engine));
    deps.saveBackends(engine, index);
    deps.removeDirs(removedDirs);
    notifyState();
  }

  return {
    profile: () => deps.profile(),
    rescan: () => deps.rescan(),
    plan: () => deps.plan(),
    state: async () => computeState(),
    setMode: async (mode) => {
      deps.persistMode(mode);
      if (mode === "off") {
        await disable("llama");
        await disable("whisper");
      }
      notifyState();
    },
    enable: async (engine, backend) => {
      const target = backend ?? (await recommendedBackend(engine));
      await runEnable(engine, target);
    },
    disable,
    retry: async (engine, backend) => runEnable(engine, backend),
    runTest: () => deps.runBenchmark(),
    removeGpuBackends: disable,
    reset: async () => {
      deps.resetRuntime();
      notifyState();
    },
    onProgress: (cb) => {
      progressListeners.add(cb);
      return () => progressListeners.delete(cb);
    },
    onState: (cb) => {
      stateListeners.add(cb);
      return () => stateListeners.delete(cb);
    },
  };
}
