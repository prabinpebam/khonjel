// @vitest-environment node
import { describe, expect, it } from "vitest";
import { computeOffloadPlan, oomLadder, nextRung, NGL_ALL, resolveGpuLayers, offloadCacheKey, readCachedNgl, writeCachedNgl } from "./offload";

const GIB = 1024 * 1024 * 1024;

describe("computeOffloadPlan", () => {
  it("offloads all layers when the model fits in VRAM with headroom", () => {
    const plan = computeOffloadPlan({ vramBytes: 24 * GIB, modelBytes: 4 * GIB, layerCount: 32, contextTokens: 4096, perTokenKvBytes: 64 * 1024, vendor: "nvidia" });
    expect(plan.ngl).toBe(NGL_ALL);
    expect(plan.estimate.fitsFully).toBe(true);
  });

  it("offloads a partial layer count when the model is bigger than the budget", () => {
    const plan = computeOffloadPlan({ vramBytes: 6 * GIB, modelBytes: 8 * GIB, layerCount: 32, contextTokens: 4096, perTokenKvBytes: 64 * 1024, vendor: "nvidia" });
    expect(plan.ngl).toBeGreaterThan(0);
    expect(plan.ngl).toBeLessThan(32);
    expect(plan.estimate.fitsFully).toBe(false);
  });

  it("uses a conservative floor when VRAM is unknown", () => {
    const plan = computeOffloadPlan({ modelBytes: 8 * GIB, layerCount: 32, contextTokens: 4096, vendor: "nvidia" });
    expect(plan.ngl).toBeGreaterThan(0);
    expect(plan.reason.toLowerCase()).toMatch(/unknown|safe/);
  });

  it("returns ngl 0 (CPU) when almost nothing fits", () => {
    const plan = computeOffloadPlan({ vramBytes: 2 * GIB, modelBytes: 30 * GIB, layerCount: 80, contextTokens: 8192, perTokenKvBytes: 200 * 1024, vendor: "nvidia" });
    expect(plan.ngl).toBe(0);
  });

  it("reserves VRAM for STT when both engines share the GPU (fewer LLM layers)", () => {
    const base = computeOffloadPlan({ vramBytes: 8 * GIB, modelBytes: 8 * GIB, layerCount: 32, contextTokens: 4096, perTokenKvBytes: 64 * 1024, vendor: "nvidia" });
    const shared = computeOffloadPlan({ vramBytes: 8 * GIB, modelBytes: 8 * GIB, layerCount: 32, contextTokens: 4096, perTokenKvBytes: 64 * 1024, vendor: "nvidia", sttReservedBytes: 2 * GIB });
    expect(shared.ngl).toBeLessThan(base.ngl);
  });

  it("treats Apple unified memory like a VRAM budget", () => {
    const plan = computeOffloadPlan({ vramBytes: 20 * GIB, modelBytes: 6 * GIB, layerCount: 40, contextTokens: 4096, perTokenKvBytes: 64 * 1024, vendor: "apple", unifiedMemory: true });
    expect(plan.ngl).toBe(NGL_ALL);
  });
});

describe("oomLadder", () => {
  it("steps down from all layers: 100 -> 80 -> 60 -> 40 -> 20 -> 0 percent", () => {
    expect(oomLadder(NGL_ALL, 32)).toEqual([32, 25, 19, 12, 6, 0]);
  });

  it("starts from the planned ngl when it is a partial offload", () => {
    expect(oomLadder(20, 32)).toEqual([20, 16, 12, 8, 4, 0]);
  });
});

describe("nextRung", () => {
  const ladder = [32, 25, 19, 12, 6, 0];
  it("returns the next lower rung", () => {
    expect(nextRung(ladder, 32)).toBe(25);
    expect(nextRung(ladder, 25)).toBe(19);
  });
  it("returns the largest rung strictly below an off-ladder value", () => {
    expect(nextRung(ladder, 30)).toBe(25);
  });
  it("returns 0 (CPU) once it bottoms out", () => {
    expect(nextRung(ladder, 6)).toBe(0);
    expect(nextRung(ladder, 0)).toBeUndefined();
  });
});

describe("resolveGpuLayers (precedence)", () => {
  it("an env override wins over everything (power users / evals)", () => {
    expect(resolveGpuLayers({ envOverride: "20", cachedNgl: 10, plannedNgl: 999 })).toBe(20);
  });
  it("uses the cached best-working rung over the fresh plan", () => {
    expect(resolveGpuLayers({ cachedNgl: 12, plannedNgl: 999 })).toBe(12);
  });
  it("falls back to the computed plan, then to CPU (0)", () => {
    expect(resolveGpuLayers({ plannedNgl: 999 })).toBe(999);
    expect(resolveGpuLayers({})).toBe(0);
  });
  it("ignores a malformed env override", () => {
    expect(resolveGpuLayers({ envOverride: "abc", plannedNgl: 8 })).toBe(8);
  });
});

describe("offload cache", () => {
  it("keys by model + backend + engine version and round-trips", () => {
    const key = offloadCacheKey("qwen2.5-1.5b", "cuda-12.4", "b9744");
    expect(key).toBe("qwen2.5-1.5b|cuda-12.4|b9744");
    const cache = writeCachedNgl({}, key, 19);
    expect(readCachedNgl(cache, key)).toBe(19);
  });
  it("writes immutably (returns a new object)", () => {
    const a = {};
    const b = writeCachedNgl(a, "k", 5);
    expect(a).toEqual({});
    expect(readCachedNgl(b, "k")).toBe(5);
  });
});
