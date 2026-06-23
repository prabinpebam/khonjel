// @vitest-environment node
import { describe, expect, it } from "vitest";
import { parseTokensPerSec, parseOffloadedLayers, computeSpeedup, buildTestReport } from "./metrics";

describe("parseOffloadedLayers", () => {
  it("reads 'offloaded N/M layers to GPU' from the llama.cpp log", () => {
    expect(parseOffloadedLayers("llm_load_tensors: offloaded 33/33 layers to GPU")).toBe(33);
  });
  it("returns undefined when absent", () => {
    expect(parseOffloadedLayers("no offload here")).toBeUndefined();
  });
});

describe("parseTokensPerSec", () => {
  it("reads tokens/second from the timing line", () => {
    expect(parseTokensPerSec("llama_print_timings: eval time = 100 ms / 56 runs ( 1.78 ms per token, 56.18 tokens per second)")).toBeCloseTo(56.18, 1);
  });
  it("returns undefined when absent", () => {
    expect(parseTokensPerSec("nothing")).toBeUndefined();
  });
});

describe("computeSpeedup", () => {
  it("is the GPU/CPU throughput ratio", () => {
    expect(computeSpeedup(132, 18)).toBeCloseTo(7.33, 1);
  });
  it("is undefined when a baseline is missing or zero", () => {
    expect(computeSpeedup(132, 0)).toBeUndefined();
    expect(computeSpeedup(undefined, 18)).toBeUndefined();
  });
});

describe("buildTestReport", () => {
  it("summarizes a winning GPU run with the speedup and an all-clear", () => {
    const report = buildTestReport({
      gpu: { device: "gpu", backend: "cuda-12.4", tokensPerSec: 132 },
      cpu: { device: "cpu", tokensPerSec: 18 },
      llm: { ok: true, message: "ok", metrics: { device: "gpu", tokensPerSec: 132 } },
      stt: { ok: true, message: "ok", metrics: { device: "gpu", realtimeFactor: 2.1 } },
    });
    expect(report.ok).toBe(true);
    expect(report.speedup).toBeCloseTo(7.33, 1);
    expect(report.summary.toLowerCase()).toMatch(/faster|works/);
  });

  it("reports a failure honestly when the GPU leg did not pass", () => {
    const report = buildTestReport({
      cpu: { device: "cpu", tokensPerSec: 18 },
      llm: { ok: false, message: "GPU support didn't pass." },
      stt: { ok: true, message: "ok" },
    });
    expect(report.ok).toBe(false);
    expect(report.summary.length).toBeGreaterThan(0);
  });
});
