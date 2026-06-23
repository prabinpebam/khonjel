/**
 * Backend validation probes + crash-loop guard (gpu-acceleration 02 §5-6). The decision logic is
 * PURE (classify stderr, evaluate signals, sliding-window demote) and BE1-tested; the orchestrators
 * take injected IO so the real spawn/health/chat edges stay out of the unit tests.
 *
 * The probe is the HARD activation gate: a backend is trusted only after it actually loads, returns
 * a token, and (for a GPU build) offloads at least one layer — so a GPU build that silently fell
 * back to CPU is caught and reported honestly.
 */
import type { Backend } from "../../../src/services/ports";

export type ProbeFailCode =
  | "missing-files"
  | "driver-too-old"
  | "load-failed"
  | "no-gpu-offload"
  | "oom"
  | "timeout"
  | "crashed"
  | "unknown";

export interface ProbeMetrics {
  tokensPerSec?: number;
  offloadedLayers?: number;
  vramUsedBytes?: number;
  ms?: number;
}

export interface ProbeResult {
  ok: boolean;
  backend: Backend;
  failCode?: ProbeFailCode;
  message: string;
  metrics?: ProbeMetrics;
  logTail?: string;
}

/** Classify an engine's stderr into a precise failure code the UX + auto-tune can react to. */
export function classifyProbeStderr(stderr: string): ProbeFailCode {
  const s = stderr.toLowerCase();
  if (/out of memory|cudaerrormemoryallocation|\boom\b/.test(s)) return "oom";
  if (/insufficient driver|cudaerrorinsufficientdriver|driver version is insufficient/.test(s)) return "driver-too-old";
  if (/loadlibrary|could not be found|cannot open shared object|\.dll|\.so[:.]/.test(s)) return "load-failed";
  return "unknown";
}

function fail(backend: Backend, failCode: ProbeFailCode, message: string, stderr?: string): ProbeResult {
  return { ok: false, backend, failCode, message, logTail: stderr };
}

export interface LlmProbeSignals {
  backend: Backend;
  expectGpu: boolean;
  healthOk: boolean;
  tokenReturned: boolean;
  offloadedLayers: number;
  stderr?: string;
  ms?: number;
}

/** Decide whether an LLM backend passed: healthy + a token + (for GPU) at least one offloaded layer. */
export function evaluateLlmProbe(s: LlmProbeSignals): ProbeResult {
  if (!s.healthOk) {
    const code = s.stderr ? classifyProbeStderr(s.stderr) : "crashed";
    return fail(s.backend, code === "unknown" ? "load-failed" : code, "GPU support failed to start.", s.stderr);
  }
  if (!s.tokenReturned) return fail(s.backend, "timeout", "GPU support didn't respond in time.", s.stderr);
  if (s.expectGpu && s.offloadedLayers <= 0) {
    return fail(s.backend, "no-gpu-offload", "The GPU build ended up running on the CPU.", s.stderr);
  }
  return {
    ok: true,
    backend: s.backend,
    message: "GPU support passed the quick test.",
    metrics: { offloadedLayers: s.offloadedLayers, ms: s.ms },
  };
}

export interface SttProbeSignals {
  backend: Backend;
  exitCode: number;
  hasOutput: boolean;
  stderr?: string;
}

/** Decide whether an STT backend passed: a clean exit with parseable output. */
export function evaluateSttProbe(s: SttProbeSignals): ProbeResult {
  if (s.exitCode !== 0) {
    const code = s.stderr ? classifyProbeStderr(s.stderr) : "crashed";
    return fail(s.backend, code === "unknown" ? "load-failed" : code, "GPU support failed to run.", s.stderr);
  }
  if (!s.hasOutput) return fail(s.backend, "timeout", "GPU support produced no output.", s.stderr);
  return { ok: true, backend: s.backend, message: "GPU support passed the quick test." };
}

/** Sliding-window crash-loop guard: demote after `threshold` crashes within `windowMs`. */
export function shouldDemote(crashTimes: number[], now: number, threshold: number, windowMs: number): boolean {
  const recent = crashTimes.filter((t) => now - t <= windowMs);
  return recent.length >= threshold;
}

// ------------------------------------------------------------------ //
// Orchestrators (IO injected)
// ------------------------------------------------------------------ //

export interface LlmProbeIo {
  start(): Promise<{ ok: boolean }>;
  oneToken(): Promise<{ tokenReturned: boolean }>;
  offloadedLayers(): Promise<number>;
  stderr(): string;
  stop(): void;
}

export async function probeLlm(backend: Backend, expectGpu: boolean, io: LlmProbeIo): Promise<ProbeResult> {
  try {
    const started = await io.start();
    if (!started.ok) {
      return evaluateLlmProbe({ backend, expectGpu, healthOk: false, tokenReturned: false, offloadedLayers: 0, stderr: io.stderr() });
    }
    const token = await io.oneToken();
    const layers = await io.offloadedLayers();
    return evaluateLlmProbe({
      backend,
      expectGpu,
      healthOk: true,
      tokenReturned: token.tokenReturned,
      offloadedLayers: layers,
      stderr: io.stderr(),
    });
  } finally {
    io.stop();
  }
}

export interface SttProbeIo {
  run(): Promise<{ exitCode: number; output: string }>;
  stderr(): string;
}

export async function probeStt(backend: Backend, io: SttProbeIo): Promise<ProbeResult> {
  const result = await io.run();
  return evaluateSttProbe({ backend, exitCode: result.exitCode, hasOutput: result.output.trim().length > 0, stderr: io.stderr() });
}
