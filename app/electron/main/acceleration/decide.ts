/**
 * GPU backend decision (gpu-acceleration 01 §6). PURE capability -> ordered backend recommendation,
 * plus the pre-commit plan (level, estimate, download size). No IO; fully BE1-testable.
 *
 * Driver gating only ORDERS candidates and produces tips. The real activation gate is the functional
 * probe (02 §5), so a wrong gate never blocks a backend that works, and a passing gate never
 * activates one that fails.
 */
import type {
  AccelerationEngine,
  AccelerationLevel,
  AccelerationPlan,
  Backend,
  BackendCandidate,
  GpuProfile,
} from "../../../src/services/ports";

const GIB = 1024 * 1024 * 1024;

const VENDOR_LABEL: Record<string, string> = {
  nvidia: "NVIDIA",
  amd: "AMD",
  intel: "Intel",
  apple: "Apple",
  unknown: "",
};

function cudaTiers(maxCudaVersion: string | undefined): Backend[] {
  const max = Number.parseFloat(maxCudaVersion ?? "");
  if (!Number.isFinite(max)) return [];
  const tiers: Backend[] = [];
  if (max >= 13) tiers.push("cuda-13.3");
  if (max >= 12.4) tiers.push("cuda-12.4");
  return tiers;
}

function candidate(backend: Backend, reason: string, confidence: BackendCandidate["confidence"], requires?: string[]): BackendCandidate {
  return { backend, reason, confidence, requires };
}

const CPU_CANDIDATE = candidate("cpu", "Runs on the processor. Always available.", "low");

/** Ordered best-first backends for an engine, filtered to what the manifest actually ships. */
export function planBackends(profile: GpuProfile, engine: AccelerationEngine, available: Backend[]): BackendCandidate[] {
  const has = (b: Backend) => available.includes(b);
  const primary = profile.primary;
  const ordered: BackendCandidate[] = [];

  if (primary && primary.vendor !== "unknown") {
    const vendor = primary.vendor;
    const cuda = cudaTiers(primary.maxCudaVersion);

    if (engine === "whisper") {
      // STT GPU is NVIDIA cuBLAS only today; everything else is CPU-first.
      if (vendor === "nvidia") {
        for (const b of cuda) ordered.push(candidate(b, "Speeds up voice typing on your NVIDIA graphics card.", "high", ["cudart"]));
      }
    } else if (vendor === "apple") {
      ordered.push(candidate("metal", "Built-in acceleration for Apple Silicon.", "high"));
    } else if (vendor === "nvidia") {
      if (cuda.length > 0) {
        for (const b of cuda) ordered.push(candidate(b, "Best for your NVIDIA graphics card.", "high", ["cudart"]));
        ordered.push(candidate("vulkan", "Broad GPU acceleration for your graphics card.", "medium"));
      } else {
        ordered.push(candidate("vulkan", "Update your NVIDIA driver to unlock the fastest path; using Vulkan for now.", "medium"));
      }
    } else if (vendor === "amd") {
      ordered.push(candidate("vulkan", "Broad GPU acceleration for your AMD graphics card.", "medium"));
    } else if (vendor === "intel") {
      ordered.push(candidate("vulkan", "GPU acceleration for your Intel graphics.", primary.isIntegrated ? "low" : "medium"));
    }
  }

  ordered.push(CPU_CANDIDATE);
  // Keep only backends the manifest ships (cpu is always available); preserve order + de-dupe.
  const seen = new Set<Backend>();
  return ordered.filter((c) => {
    if (seen.has(c.backend)) return false;
    seen.add(c.backend);
    return c.backend === "cpu" || has(c.backend);
  });
}

/** The headline level for the acceleration card. */
export function recommendedLevel(profile: GpuProfile): AccelerationLevel {
  const primary = profile.primary;
  if (!primary || primary.vendor === "unknown") return "cpu-only";
  const great = (primary.vendor === "nvidia" || primary.vendor === "amd" || primary.vendor === "apple") && (primary.vramBytes ?? 0) >= 12 * GIB;
  return great ? "gpu-great" : "gpu-ok";
}

/** Pre-commit speedup hint (a deliberately wide range; the real number comes from the on-device test). */
export function estimateSpeedup(level: AccelerationLevel): string | undefined {
  if (level === "gpu-great") return "5-10x";
  if (level === "gpu-ok") return "2-4x";
  return undefined;
}

export interface PlanInputs {
  profile: GpuProfile;
  /** Backends the manifest ships for this os/arch. */
  available: Backend[];
  /** Backends already provisioned (no download needed). */
  installed?: Backend[];
  /** Optional sizing from the manifest, for honest download/disk copy. */
  sizeOf?: (engine: AccelerationEngine, backend: Backend) => { downloadBytes?: number; diskBytes?: number };
}

/** The smart recommendation: ordered backends, level, plain-language summary, and pre-commit sizing. */
export function buildAccelerationPlan(inputs: PlanInputs): AccelerationPlan {
  const { profile, available, installed = [], sizeOf } = inputs;
  const llm = planBackends(profile, "llama", available);
  const stt = planBackends(profile, "whisper", available);
  const level = recommendedLevel(profile);
  const recommended = llm[0]?.backend ?? "cpu";
  const requiresDownload = recommended !== "cpu" && !installed.includes(recommended);
  const size = recommended !== "cpu" ? sizeOf?.("llama", recommended) : undefined;
  const speedup = estimateSpeedup(level);

  const vendorLabel = VENDOR_LABEL[profile.primary?.vendor ?? "unknown"] || "";
  const summary =
    level === "cpu-only"
      ? "Running on the CPU. No compatible graphics card was found."
      : `Your ${vendorLabel} graphics card can make Khonjel ${speedup ?? "much"} faster.`;

  return {
    llm,
    stt,
    recommendedLevel: level,
    summary,
    estimatedSpeedup: speedup,
    downloadBytes: requiresDownload ? size?.downloadBytes : 0,
    diskBytes: size?.diskBytes,
    requiresDownload,
  };
}
