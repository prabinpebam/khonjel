/**
 * Acceleration state projection (gpu-acceleration 04 §2). PURE: turn the persisted backends index +
 * the user mode into the `AccelerationState` the renderer renders (honest device, summary, gpuActive).
 * BE1-tested.
 */
import type { AccelerationEngine, AccelerationMode, AccelerationState, EngineAcceleration } from "../../../src/services/ports";
import type { EngineBackends } from "./backends";

const ENGINE_LABEL: Record<AccelerationEngine, string> = { llama: "language model", whisper: "voice typing" };

/** Project one engine's index into its user-facing acceleration state. */
export function engineAccelerationOf(engine: AccelerationEngine, index: EngineBackends): EngineAcceleration {
  const activeKey = index.active;
  const active = activeKey ? index.installed[activeKey] : undefined;
  if (active && active.backend !== "cpu" && active.state === "active") {
    return {
      engine,
      device: "gpu",
      activeBackend: active.backend,
      state: "active",
      message: `Running ${ENGINE_LABEL[engine]} on the GPU.`,
      metrics: active.probedAt ? { device: "gpu", backend: active.backend } : undefined,
    };
  }
  return {
    engine,
    device: "cpu",
    activeBackend: active?.backend,
    state: active ? "active" : "none",
    message: `Running ${ENGINE_LABEL[engine]} on the CPU.`,
  };
}

export interface AccelerationStateInput {
  mode: AccelerationMode;
  llm: EngineBackends;
  stt: EngineBackends;
  online: boolean;
  autoSetup?: AccelerationState["autoSetup"];
  notice?: AccelerationState["notice"];
}

export function buildAccelerationState(input: AccelerationStateInput): AccelerationState {
  const llm = engineAccelerationOf("llama", input.llm);
  const stt = engineAccelerationOf("whisper", input.stt);
  const gpuActive = input.mode !== "off" && (llm.device === "gpu" || stt.device === "gpu");
  const summary =
    input.mode === "off"
      ? "Running on the CPU (acceleration is off)."
      : gpuActive
        ? "Running on your graphics card."
        : "Running on the CPU.";
  return {
    mode: input.mode,
    llm: input.mode === "off" ? { ...llm, device: "cpu" } : llm,
    stt: input.mode === "off" ? { ...stt, device: "cpu" } : stt,
    gpuActive,
    online: input.online,
    autoSetup: input.autoSetup,
    notice: input.notice,
    summary,
  };
}
