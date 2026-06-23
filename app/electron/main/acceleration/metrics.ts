/**
 * Runtime metric parsers + the test-report builder (gpu-acceleration 03 §6). PURE: parse the local
 * engine logs into `RuntimeMetrics` and turn a GPU-vs-CPU comparison into a friendly report. Nothing
 * here leaves the device. BE1-tested.
 */
import type { AccelerationTestLeg, AccelerationTestReport, RuntimeMetrics } from "../../../src/services/ports";

/** "llm_load_tensors: offloaded 33/33 layers to GPU" -> 33. */
export function parseOffloadedLayers(log: string): number | undefined {
  const match = /offloaded\s+(\d+)\/(\d+)\s+layers to GPU/i.exec(log);
  const value = match?.[1];
  return value != null ? Number(value) : undefined;
}

/** "... 56.18 tokens per second)" -> 56.18. */
export function parseTokensPerSec(log: string): number | undefined {
  const match = /([0-9]+(?:\.[0-9]+)?)\s*tokens per second/i.exec(log);
  const value = match?.[1];
  return value != null ? Number(value) : undefined;
}

/** GPU/CPU throughput ratio; undefined when a baseline is missing or zero. */
export function computeSpeedup(gpuTps?: number, cpuTps?: number): number | undefined {
  if (gpuTps == null || cpuTps == null || cpuTps <= 0) return undefined;
  return gpuTps / cpuTps;
}

export interface TestReportInput {
  gpu?: RuntimeMetrics;
  cpu?: RuntimeMetrics;
  llm: AccelerationTestLeg;
  stt: AccelerationTestLeg;
}

export function buildTestReport(input: TestReportInput): AccelerationTestReport {
  const ok = input.llm.ok && input.stt.ok && input.gpu != null;
  const speedup = computeSpeedup(input.gpu?.tokensPerSec, input.cpu?.tokensPerSec);
  const summary = ok
    ? speedup != null
      ? `Your GPU is about ${Math.round(speedup)}x faster. Everything works.`
      : "GPU acceleration works."
    : "GPU support didn't pass the test, so Khonjel kept things on the CPU.";
  return { ok, gpu: input.gpu, cpu: input.cpu, speedup, llm: input.llm, stt: input.stt, summary };
}
