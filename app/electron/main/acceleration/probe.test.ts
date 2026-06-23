// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import {
  classifyProbeStderr,
  evaluateLlmProbe,
  evaluateSttProbe,
  shouldDemote,
  probeLlm,
  type LlmProbeIo,
} from "./probe";

describe("classifyProbeStderr", () => {
  it("maps CUDA out-of-memory", () => {
    expect(classifyProbeStderr("ggml_cuda: CUDA error: out of memory")).toBe("oom");
  });
  it("maps an insufficient driver", () => {
    expect(classifyProbeStderr("cudaErrorInsufficientDriver: CUDA driver version is insufficient")).toBe("driver-too-old");
  });
  it("maps a missing DLL load failure", () => {
    expect(classifyProbeStderr("LoadLibrary failed: The specified module could not be found (cudart64_12.dll)")).toBe("load-failed");
  });
  it("falls back to unknown", () => {
    expect(classifyProbeStderr("something else")).toBe("unknown");
  });
});

describe("evaluateLlmProbe", () => {
  it("passes when health is ok, a token returns, and GPU layers offloaded", () => {
    const r = evaluateLlmProbe({ backend: "cuda-12.4", expectGpu: true, healthOk: true, tokenReturned: true, offloadedLayers: 32 });
    expect(r.ok).toBe(true);
    expect(r.metrics?.offloadedLayers).toBe(32);
  });

  it("FAILS a GPU build that silently ran on CPU (no offloaded layers)", () => {
    const r = evaluateLlmProbe({ backend: "cuda-12.4", expectGpu: true, healthOk: true, tokenReturned: true, offloadedLayers: 0 });
    expect(r.ok).toBe(false);
    expect(r.failCode).toBe("no-gpu-offload");
  });

  it("accepts zero offloaded layers for the CPU backend", () => {
    const r = evaluateLlmProbe({ backend: "cpu", expectGpu: false, healthOk: true, tokenReturned: true, offloadedLayers: 0 });
    expect(r.ok).toBe(true);
  });

  it("fails when the server never became healthy", () => {
    const r = evaluateLlmProbe({ backend: "cuda-12.4", expectGpu: true, healthOk: false, tokenReturned: false, offloadedLayers: 0, stderr: "CUDA error: out of memory" });
    expect(r.ok).toBe(false);
    expect(r.failCode).toBe("oom");
  });

  it("fails when no token came back in time", () => {
    const r = evaluateLlmProbe({ backend: "cuda-12.4", expectGpu: true, healthOk: true, tokenReturned: false, offloadedLayers: 32 });
    expect(r.ok).toBe(false);
    expect(r.failCode).toBe("timeout");
  });
});

describe("evaluateSttProbe", () => {
  it("passes on a clean exit with output", () => {
    expect(evaluateSttProbe({ backend: "cuda-12.4", exitCode: 0, hasOutput: true }).ok).toBe(true);
  });
  it("fails on a non-zero exit", () => {
    const r = evaluateSttProbe({ backend: "cuda-12.4", exitCode: 1, hasOutput: false, stderr: "CUDA error: out of memory" });
    expect(r.ok).toBe(false);
    expect(r.failCode).toBe("oom");
  });
  it("fails on a clean exit but empty output", () => {
    expect(evaluateSttProbe({ backend: "cuda-12.4", exitCode: 0, hasOutput: false }).ok).toBe(false);
  });
});

describe("shouldDemote (crash-loop guard)", () => {
  const T = 120_000;
  it("demotes after N crashes within the window", () => {
    const now = 200_000;
    expect(shouldDemote([150_000, 190_000], now, 2, T)).toBe(true);
  });
  it("does NOT demote a single crash", () => {
    expect(shouldDemote([190_000], 200_000, 2, T)).toBe(false);
  });
  it("ignores crashes older than the window", () => {
    const now = 400_000;
    expect(shouldDemote([100_000, 150_000], now, 2, T)).toBe(false);
  });
});

describe("probeLlm (orchestration)", () => {
  it("starts, asks for a token, reads offloaded layers, then stops — and passes", async () => {
    const io: LlmProbeIo = {
      start: vi.fn(async () => ({ ok: true })),
      oneToken: vi.fn(async () => ({ tokenReturned: true })),
      offloadedLayers: vi.fn(async () => 32),
      stderr: () => "",
      stop: vi.fn(),
    };
    const r = await probeLlm("cuda-12.4", true, io);
    expect(r.ok).toBe(true);
    expect(io.stop).toHaveBeenCalledOnce();
  });

  it("stops the server even when the probe fails", async () => {
    const io: LlmProbeIo = {
      start: vi.fn(async () => ({ ok: false })),
      oneToken: vi.fn(async () => ({ tokenReturned: false })),
      offloadedLayers: vi.fn(async () => 0),
      stderr: () => "CUDA error: out of memory",
      stop: vi.fn(),
    };
    const r = await probeLlm("cuda-12.4", true, io);
    expect(r.ok).toBe(false);
    expect(r.failCode).toBe("oom");
    expect(io.stop).toHaveBeenCalledOnce();
  });
});
