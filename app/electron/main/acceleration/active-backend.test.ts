// @vitest-environment node
import { describe, expect, it } from "vitest";
import { activeGpuBackend, plannedGpuLayers } from "./active-backend";
import type { EngineBackends } from "./backends";
import type { GpuProfile } from "../../../src/services/ports";

const GIB = 1024 * 1024 * 1024;

function index(over: Partial<EngineBackends> = {}): EngineBackends {
  return { engine: "llama", installed: {}, ...over };
}

describe("activeGpuBackend", () => {
  it("returns undefined when there is no active key", () => {
    expect(activeGpuBackend(undefined)).toBeUndefined();
    expect(activeGpuBackend(index())).toBeUndefined();
  });

  it("returns undefined when the active backend is the CPU floor", () => {
    const idx = index({
      active: "cpu@b9744",
      installed: { "cpu@b9744": { backend: "cpu", version: "b9744", dir: "/r/llama/cpu", state: "active" } },
    });
    expect(activeGpuBackend(idx)).toBeUndefined();
  });

  it("returns undefined when the active GPU backend is not in the active state (e.g. quarantined)", () => {
    const idx = index({
      active: "vulkan@b9744",
      installed: { "vulkan@b9744": { backend: "vulkan", version: "b9744", dir: "/r/llama/vulkan-b9744", state: "quarantined" } },
    });
    expect(activeGpuBackend(idx)).toBeUndefined();
  });

  it("returns the active GPU backend dir/backend/version", () => {
    const idx = index({
      active: "vulkan@b9744",
      installed: { "vulkan@b9744": { backend: "vulkan", version: "b9744", dir: "/r/llama/vulkan-b9744", state: "active" } },
    });
    expect(activeGpuBackend(idx)).toEqual({ backend: "vulkan", version: "b9744", dir: "/r/llama/vulkan-b9744" });
  });
});

describe("plannedGpuLayers", () => {
  const profile = (vramBytes?: number): GpuProfile => ({
    os: "win32",
    arch: "x64",
    devices: [],
    primary: vramBytes != null ? { index: 0, name: "GPU", vendor: "nvidia", vramBytes, source: ["os"] } : undefined,
    detectedAt: "2026-06-24T00:00:00.000Z",
    warnings: [],
  });

  it("offloads all layers when the model fits comfortably in VRAM", () => {
    // 24 GB VRAM, a ~2 GB model -> NGL_ALL (999).
    expect(plannedGpuLayers({ profile: profile(24 * GIB), modelBytes: 2 * GIB })).toBe(999);
  });

  it("falls back to a safe layer count when VRAM is unknown", () => {
    expect(plannedGpuLayers({ profile: profile(undefined), modelBytes: 2 * GIB })).toBeGreaterThan(0);
  });

  it("honours an explicit env override", () => {
    expect(plannedGpuLayers({ profile: profile(24 * GIB), modelBytes: 2 * GIB, envOverride: "10" })).toBe(10);
  });

  it("lets an env override of 0 force the CPU path", () => {
    expect(plannedGpuLayers({ profile: profile(24 * GIB), modelBytes: 2 * GIB, envOverride: "0" })).toBe(0);
  });
});
