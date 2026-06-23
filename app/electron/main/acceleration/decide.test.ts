// @vitest-environment node
import { describe, expect, it } from "vitest";
import { planBackends, recommendedLevel, buildAccelerationPlan } from "./decide";
import type { Backend, GpuDevice, GpuProfile } from "../../../src/services/ports";

const MIB = 1024 * 1024;

function profileOf(primary: Partial<GpuDevice> | undefined, os: GpuProfile["os"] = "win32"): GpuProfile {
  const device: GpuDevice | undefined = primary
    ? { index: 0, name: "GPU", vendor: "unknown", source: ["os"], ...primary }
    : undefined;
  return {
    os,
    arch: os === "darwin" ? "arm64" : "x64",
    devices: device ? [device] : [],
    primary: device,
    detectedAt: "2026-06-23T00:00:00.000Z",
    warnings: [],
  };
}

const ALL: Backend[] = ["cuda-13.3", "cuda-12.4", "vulkan", "metal", "hip", "sycl", "cpu"];
const ids = (cs: { backend: Backend }[]) => cs.map((c) => c.backend);

describe("planBackends — LLM", () => {
  it("NVIDIA with a modern driver prefers the newest CUDA, then older CUDA, Vulkan, CPU", () => {
    const p = profileOf({ vendor: "nvidia", vendorId: "10DE", maxCudaVersion: "13.0", driverVersion: "581.15", vramBytes: 24 * 1024 * MIB });
    expect(ids(planBackends(p, "llama", ALL))).toEqual(["cuda-13.3", "cuda-12.4", "vulkan", "cpu"]);
  });

  it("NVIDIA limited to CUDA 12.4 does not offer cuda-13.3", () => {
    const p = profileOf({ vendor: "nvidia", vendorId: "10DE", maxCudaVersion: "12.4", driverVersion: "552.0", vramBytes: 12 * 1024 * MIB });
    expect(ids(planBackends(p, "llama", ALL))).toEqual(["cuda-12.4", "vulkan", "cpu"]);
  });

  it("NVIDIA with a too-old driver falls back to Vulkan + CPU and explains why", () => {
    const p = profileOf({ vendor: "nvidia", vendorId: "10DE", driverVersion: "470.0", vramBytes: 8 * 1024 * MIB });
    const cands = planBackends(p, "llama", ALL);
    expect(ids(cands)).toEqual(["vulkan", "cpu"]);
    expect(cands[0]?.reason.toLowerCase()).toMatch(/driver|update|vulkan/);
  });

  it("AMD prefers Vulkan then CPU", () => {
    const p = profileOf({ vendor: "amd", vendorId: "1002", vramBytes: 16 * 1024 * MIB });
    expect(ids(planBackends(p, "llama", ALL))).toEqual(["vulkan", "cpu"]);
  });

  it("Intel prefers Vulkan then CPU", () => {
    const p = profileOf({ vendor: "intel", vendorId: "8086", isIntegrated: true });
    expect(ids(planBackends(p, "llama", ALL))).toEqual(["vulkan", "cpu"]);
  });

  it("Apple Silicon prefers Metal then CPU", () => {
    const p = profileOf({ vendor: "apple", unifiedMemory: true, vramBytes: 32 * 1024 * MIB }, "darwin");
    expect(ids(planBackends(p, "llama", ALL))).toEqual(["metal", "cpu"]);
  });

  it("unknown / no GPU is CPU only", () => {
    expect(ids(planBackends(profileOf(undefined), "llama", ALL))).toEqual(["cpu"]);
    expect(ids(planBackends(profileOf({ vendor: "unknown" }), "llama", ALL))).toEqual(["cpu"]);
  });

  it("only offers backends present in the manifest (available)", () => {
    const p = profileOf({ vendor: "nvidia", vendorId: "10DE", maxCudaVersion: "13.0", driverVersion: "581.15", vramBytes: 24 * 1024 * MIB });
    // CUDA not shipped for this os/arch -> Vulkan first
    expect(ids(planBackends(p, "llama", ["vulkan", "cpu"]))).toEqual(["vulkan", "cpu"]);
  });
});

describe("planBackends — STT", () => {
  it("NVIDIA uses a CUDA whisper build when available, else CPU", () => {
    const p = profileOf({ vendor: "nvidia", vendorId: "10DE", maxCudaVersion: "13.0", driverVersion: "581.15", vramBytes: 24 * 1024 * MIB });
    expect(ids(planBackends(p, "whisper", ["cuda-12.4", "cpu"]))).toEqual(["cuda-12.4", "cpu"]);
    expect(ids(planBackends(p, "whisper", ["cpu"]))).toEqual(["cpu"]);
  });

  it("non-NVIDIA STT is CPU first today", () => {
    const p = profileOf({ vendor: "amd", vendorId: "1002", vramBytes: 16 * 1024 * MIB });
    expect(ids(planBackends(p, "whisper", ALL))).toEqual(["cpu"]);
  });
});

describe("recommendedLevel", () => {
  it("is gpu-great for a high-VRAM discrete GPU", () => {
    const p = profileOf({ vendor: "nvidia", vendorId: "10DE", maxCudaVersion: "13.0", driverVersion: "581.15", vramBytes: 24 * 1024 * MIB });
    expect(recommendedLevel(p)).toBe("gpu-great");
  });
  it("is cpu-only with no usable GPU", () => {
    expect(recommendedLevel(profileOf(undefined))).toBe("cpu-only");
  });
});

describe("buildAccelerationPlan", () => {
  it("recommends CUDA for NVIDIA with a pre-commit estimate + download size", () => {
    const p = profileOf({ vendor: "nvidia", vendorId: "10DE", maxCudaVersion: "13.0", driverVersion: "581.15", vramBytes: 24 * 1024 * MIB });
    const plan = buildAccelerationPlan({
      profile: p,
      available: ALL,
      installed: [],
      sizeOf: (_engine, backend) =>
        backend.startsWith("cuda") ? { downloadBytes: 250 * MIB, diskBytes: 900 * MIB } : { downloadBytes: 0, diskBytes: 0 },
    });
    expect(plan.llm[0]?.backend).toBe("cuda-13.3");
    expect(plan.recommendedLevel).toBe("gpu-great");
    expect(plan.estimatedSpeedup).toBeTruthy();
    expect(plan.downloadBytes).toBe(250 * MIB);
    expect(plan.requiresDownload).toBe(true);
    expect(plan.summary.toLowerCase()).toMatch(/nvidia|graphics|faster/);
  });

  it("requiresDownload is false when the recommended backend is already installed", () => {
    const p = profileOf({ vendor: "nvidia", vendorId: "10DE", maxCudaVersion: "13.0", driverVersion: "581.15", vramBytes: 24 * 1024 * MIB });
    const plan = buildAccelerationPlan({ profile: p, available: ALL, installed: ["cuda-13.3"] });
    expect(plan.requiresDownload).toBe(false);
  });

  it("is cpu-only with no GPU and never requires a download", () => {
    const plan = buildAccelerationPlan({ profile: profileOf(undefined), available: ["cpu"], installed: [] });
    expect(plan.recommendedLevel).toBe("cpu-only");
    expect(plan.llm[0]?.backend).toBe("cpu");
    expect(plan.requiresDownload).toBe(false);
  });
});
