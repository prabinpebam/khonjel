import type { AccelerationPlan, AccelerationService, GpuDevice, GpuProfile } from "@services/ports";

/**
 * Mock acceleration port. Backs the browser preview with a deterministic "GPU found, not yet on"
 * state (an NVIDIA RTX 4090) so the acceleration UX renders without real hardware. The real
 * detection + recommendation runs in the Electron main process.
 */
const GIB = 1024 * 1024 * 1024;

const primary: GpuDevice = {
  index: 0,
  name: "NVIDIA GeForce RTX 4090",
  vendor: "nvidia",
  vendorId: "10DE",
  vramBytes: 24 * GIB,
  driverVersion: "581.15",
  computeCapability: "8.9",
  maxCudaVersion: "13.0",
  source: ["os", "nvidia-smi"],
};

const mockProfile: GpuProfile = {
  os: "win32",
  arch: "x64",
  devices: [primary],
  primary,
  detectedAt: "2026-06-23T00:00:00.000Z",
  warnings: [],
};

const mockPlan: AccelerationPlan = {
  llm: [
    { backend: "cuda-13.3", reason: "Best for your NVIDIA graphics card.", confidence: "high", requires: ["cudart"] },
    { backend: "vulkan", reason: "Broad GPU acceleration for your graphics card.", confidence: "medium" },
    { backend: "cpu", reason: "Runs on the processor. Always available.", confidence: "low" },
  ],
  stt: [
    { backend: "cuda-12.4", reason: "Speeds up voice typing on your NVIDIA graphics card.", confidence: "high", requires: ["cudart"] },
    { backend: "cpu", reason: "Runs on the processor. Always available.", confidence: "low" },
  ],
  recommendedLevel: "gpu-great",
  summary: "Your NVIDIA graphics card can make Khonjel 5-10x faster.",
  estimatedSpeedup: "5-10x",
  downloadBytes: 250 * 1024 * 1024,
  diskBytes: 900 * 1024 * 1024,
  requiresDownload: true,
};

export const mockAccelerationService: AccelerationService = {
  profile: async () => mockProfile,
  rescan: async () => mockProfile,
  plan: async () => mockPlan,
};
