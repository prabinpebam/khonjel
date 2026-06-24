// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { createAccelerationService, defaultAvailableBackends, type AccelerationDeps } from "./service";
import type { GpuProfile } from "../../../src/services/ports";

const MIB = 1024 * 1024;

function nvidiaProfile(): GpuProfile {
  return {
    os: "win32",
    arch: "x64",
    devices: [
      { index: 0, name: "NVIDIA GeForce RTX 4090", vendor: "nvidia", vendorId: "10DE", vramBytes: 24 * 1024 * MIB, maxCudaVersion: "13.0", driverVersion: "581.15", source: ["os", "nvidia-smi"] },
    ],
    primary: { index: 0, name: "NVIDIA GeForce RTX 4090", vendor: "nvidia", vendorId: "10DE", vramBytes: 24 * 1024 * MIB, maxCudaVersion: "13.0", driverVersion: "581.15", source: ["os", "nvidia-smi"] },
    detectedAt: "2026-06-23T00:00:00.000Z",
    warnings: [],
  };
}

function depsWith(over: Partial<AccelerationDeps>): AccelerationDeps {
  return {
    detectProfile: () => nvidiaProfile(),
    loadCachedProfile: () => undefined,
    saveProfile: () => {},
    availableBackends: () => ["cuda-13.3", "cuda-12.4", "vulkan", "cpu"],
    ...over,
  };
}

describe("createAccelerationService", () => {
  it("profile() returns a fresh cache without re-detecting", async () => {
    const detectProfile = vi.fn(() => nvidiaProfile());
    const svc = createAccelerationService(
      depsWith({ detectProfile, loadCachedProfile: () => nvidiaProfile(), isCacheFresh: () => true }),
    );
    await svc.profile();
    expect(detectProfile).not.toHaveBeenCalled();
  });

  it("profile() detects + saves when there is no cache", async () => {
    const saveProfile = vi.fn();
    const detectProfile = vi.fn(() => nvidiaProfile());
    const svc = createAccelerationService(depsWith({ detectProfile, saveProfile, loadCachedProfile: () => undefined }));
    const p = await svc.profile();
    expect(detectProfile).toHaveBeenCalledOnce();
    expect(saveProfile).toHaveBeenCalledWith(p);
  });

  it("profile() re-detects when the cache is stale", async () => {
    const detectProfile = vi.fn(() => nvidiaProfile());
    const svc = createAccelerationService(
      depsWith({ detectProfile, loadCachedProfile: () => nvidiaProfile(), isCacheFresh: () => false }),
    );
    await svc.profile();
    expect(detectProfile).toHaveBeenCalledOnce();
  });

  it("rescan() always re-detects, saves, and updates the in-memory profile", async () => {
    const saveProfile = vi.fn();
    const detectProfile = vi.fn(() => nvidiaProfile());
    const svc = createAccelerationService(
      depsWith({ detectProfile, saveProfile, loadCachedProfile: () => nvidiaProfile(), isCacheFresh: () => true }),
    );
    await svc.profile(); // seeds from cache, no detect
    await svc.rescan();
    expect(detectProfile).toHaveBeenCalledOnce();
    expect(saveProfile).toHaveBeenCalledOnce();
  });

  it("plan() composes the recommendation from the profile + available backends", async () => {
    const svc = createAccelerationService(
      depsWith({
        installedBackends: () => [],
        sizeOf: (_e, b) => (b.startsWith("cuda") ? { downloadBytes: 250 * MIB, diskBytes: 900 * MIB } : {}),
      }),
    );
    const plan = await svc.plan();
    expect(plan.llm[0]?.backend).toBe("cuda-13.3");
    expect(plan.recommendedLevel).toBe("gpu-great");
    expect(plan.downloadBytes).toBe(250 * MIB);
    expect(plan.requiresDownload).toBe(true);
  });
});

describe("defaultAvailableBackends", () => {
  it("ships CUDA + Vulkan + CPU on Windows x64", () => {
    const list = defaultAvailableBackends("win32", "x64");
    expect(list).toEqual(expect.arrayContaining(["cuda-12.4", "vulkan", "cpu"]));
  });
  it("ships Metal + CPU on Apple Silicon", () => {
    expect(defaultAvailableBackends("darwin", "arm64")).toEqual(["metal", "cpu"]);
  });
  it("ships Vulkan + CPU on Linux x64", () => {
    expect(defaultAvailableBackends("linux", "x64")).toEqual(expect.arrayContaining(["vulkan", "cpu"]));
  });
});
