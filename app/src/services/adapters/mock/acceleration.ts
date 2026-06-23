import type {
  AccelerationEngine,
  AccelerationMode,
  AccelerationPlan,
  AccelerationProgress,
  AccelerationService,
  AccelerationState,
  AccelerationTestReport,
  EngineAcceleration,
  GpuDevice,
  GpuProfile,
} from "@services/ports";

/**
 * Stateful mock acceleration port. Backs the browser preview with a deterministic "GPU found, not
 * yet on" NVIDIA RTX 4090, and drives the full one-click flow (progress -> on -> test) synchronously
 * so the acceleration UX can be exercised end-to-end without real hardware. The real detection +
 * provisioning runs in the Electron main process.
 */
const GIB = 1024 * 1024 * 1024;
const MIB = 1024 * 1024;

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
  downloadBytes: 250 * MIB,
  diskBytes: 900 * MIB,
  requiresDownload: true,
};

function createMockAccelerationService(): AccelerationService {
  let mode: AccelerationMode = "auto";
  let llmOnGpu = false;
  let notice: AccelerationState["notice"];
  const stateListeners = new Set<(s: AccelerationState) => void>();
  const progressListeners = new Set<(e: AccelerationProgress) => void>();

  function computeState(): AccelerationState {
    const llm: EngineAcceleration =
      llmOnGpu && mode !== "off"
        ? { engine: "llama", device: "gpu", activeBackend: "cuda-13.3", state: "active", message: "Running language model on the GPU.", metrics: { device: "gpu", backend: "cuda-13.3", tokensPerSec: 132 } }
        : { engine: "llama", device: "cpu", state: "none", message: "Running language model on the CPU." };
    const stt: EngineAcceleration = { engine: "whisper", device: "cpu", state: "none", message: "Running voice typing on the CPU." };
    const gpuActive = llm.device === "gpu";
    const summary = mode === "off" ? "Running on the CPU (acceleration is off)." : gpuActive ? "Running on your graphics card." : "Running on the CPU.";
    return { mode, llm, stt, gpuActive, online: true, notice, summary };
  }

  function notifyState(): void {
    const next = computeState();
    for (const cb of stateListeners) cb(next);
    notice = undefined;
  }

  function emit(event: AccelerationProgress): void {
    for (const cb of progressListeners) cb(event);
  }

  async function enable(engine: AccelerationEngine): Promise<void> {
    emit({ engine, backend: "cuda-13.3", state: "planning", message: "Checking your graphics card" });
    emit({ engine, backend: "cuda-13.3", state: "downloading", bytesDone: 148 * MIB, bytesTotal: 250 * MIB, message: "Downloading GPU support" });
    emit({ engine, backend: "cuda-13.3", state: "probing", message: "Testing it on your machine" });
    llmOnGpu = true;
    notice = { kind: "enabled", message: "Your graphics card is now making Khonjel about 7x faster." };
    emit({ engine, backend: "cuda-13.3", state: "active", message: "Acceleration is on." });
    notifyState();
  }

  async function disable(): Promise<void> {
    llmOnGpu = false;
    notifyState();
  }

  return {
    profile: async () => mockProfile,
    rescan: async () => mockProfile,
    plan: async () => mockPlan,
    state: async () => computeState(),
    setMode: async (next) => {
      mode = next;
      if (mode === "off") llmOnGpu = false;
      notifyState();
    },
    enable,
    disable,
    retry: (engine) => enable(engine),
    runTest: async (): Promise<AccelerationTestReport> => ({
      ok: true,
      gpu: { device: "gpu", backend: "cuda-13.3", tokensPerSec: 132 },
      cpu: { device: "cpu", tokensPerSec: 18 },
      speedup: 132 / 18,
      llm: { ok: true, message: "Works on GPU.", metrics: { device: "gpu", tokensPerSec: 132 } },
      stt: { ok: true, message: "Works on GPU.", metrics: { device: "gpu", realtimeFactor: 2.1 } },
      summary: "Your GPU is about 7x faster. Everything works.",
    }),
    removeGpuBackends: () => disable(),
    reset: async () => {
      llmOnGpu = false;
      mode = "auto";
      notifyState();
    },
    onProgress: (cb) => {
      progressListeners.add(cb);
      return () => progressListeners.delete(cb);
    },
    onState: (cb) => {
      stateListeners.add(cb);
      return () => stateListeners.delete(cb);
    },
  };
}

export const mockAccelerationService: AccelerationService = createMockAccelerationService();
