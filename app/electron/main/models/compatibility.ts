import type {
  ActiveModelReport,
  CompatibilityLevel,
  HardwareProfile,
  ModelCompatibility,
  ModelCompatibilityReport,
  ModelReadiness,
  ModelStatus,
  RuntimeStatus,
} from "../../../src/services/ports";
import { modelManifest } from "./catalog";

const GB = 1024 * 1024 * 1024;

interface Requirement {
  minRamBytes?: number;
  recommendedRamBytes?: number;
  minFreeDiskBytes: number;
  support: "supported" | "experimental" | "not-yet-supported";
}

const REQUIREMENTS: Record<string, Requirement> = {
  "ggml-base.en.bin": {
    minRamBytes: 2 * GB,
    recommendedRamBytes: 4 * GB,
    minFreeDiskBytes: 300 * 1024 * 1024,
    support: "supported",
  },
  "ggml-small.bin": {
    minRamBytes: 4 * GB,
    recommendedRamBytes: 8 * GB,
    minFreeDiskBytes: 800 * 1024 * 1024,
    support: "supported",
  },
  "ggml-large-v3-turbo.bin": {
    minRamBytes: 8 * GB,
    recommendedRamBytes: 16 * GB,
    minFreeDiskBytes: 2 * GB,
    support: "supported",
  },
  "sherpa-onnx-nemo-parakeet-tdt-0.6b-v3": {
    minRamBytes: 8 * GB,
    recommendedRamBytes: 12 * GB,
    minFreeDiskBytes: 2 * GB,
    support: "supported",
  },
  "qwen2.5-1.5b-instruct-q4_k_m.gguf": {
    minRamBytes: 3 * GB,
    recommendedRamBytes: 4 * GB,
    minFreeDiskBytes: 2 * GB,
    support: "supported",
  },
  "qwen2.5-3b-instruct-q4_k_m.gguf": {
    minRamBytes: 6 * GB,
    recommendedRamBytes: 8 * GB,
    minFreeDiskBytes: 3 * GB,
    support: "supported",
  },
  "llama-3.2-3b-instruct-q4_k_m.gguf": {
    minRamBytes: 6 * GB,
    recommendedRamBytes: 8 * GB,
    minFreeDiskBytes: 3 * GB,
    support: "supported",
  },
  "qwen2.5-7b-instruct-q4_k_m.gguf": {
    minRamBytes: 12 * GB,
    recommendedRamBytes: 16 * GB,
    minFreeDiskBytes: 6 * GB,
    support: "supported",
  },
  "mistral-7b-instruct-v0.3.q4_k_m.gguf": {
    minRamBytes: 12 * GB,
    recommendedRamBytes: 16 * GB,
    minFreeDiskBytes: 6 * GB,
    support: "supported",
  },
};

function runtimeFor(model: ModelStatus): RuntimeStatus | undefined {
  const manifest = modelManifest(model.id);
  if (!manifest) return undefined;
  return { engine: manifest.engine, state: model.engineReady ? "ready" : "missing", message: "" };
}

function runtimeFromList(model: ModelStatus, runtimes: RuntimeStatus[]): RuntimeStatus | undefined {
  const engine = modelManifest(model.id)?.engine;
  return engine ? runtimes.find((r) => r.engine === engine) ?? runtimeFor(model) : undefined;
}

function bytesFor(model: ModelStatus): number {
  return model.bytesTotal ?? model.installedBytes ?? REQUIREMENTS[model.id]?.minFreeDiskBytes ?? 512 * 1024 * 1024;
}

function compareLevel(a: CompatibilityLevel, b: CompatibilityLevel): number {
  const order: Record<CompatibilityLevel, number> = { recommended: 4, works: 3, limited: 2, unknown: 1, unsupported: 0 };
  return (order[a] ?? 0) - (order[b] ?? 0);
}

export function chooseRecommendedModels(models: ModelCompatibility[]): { stt?: string; llm?: string } {
  const choose = (kind: "stt" | "llm") =>
    models
      .filter((m) => m.kind === kind && m.level !== "unsupported")
      .sort((a, b) => compareLevel(b.level, a.level))[0]?.modelId;
  return { stt: choose("stt"), llm: choose("llm") };
}

export function buildModelCompatibilityReport(args: {
  hardware: HardwareProfile;
  runtimes: RuntimeStatus[];
  statuses: ModelStatus[];
}): ModelCompatibilityReport {
  const models = args.statuses.map((model) => compatibilityFor(model, args.hardware, args.runtimes));
  const recommended = chooseRecommendedModels(models);
  const hasReadyRecommendation = Boolean(recommended.stt || recommended.llm);
  const hasUnsupportedOnly = models.length > 0 && models.every((m) => m.level === "unsupported");
  const availableRam = args.hardware.availableRamBytes ?? args.hardware.totalRamBytes;
  const summary = hasUnsupportedOnly
    ? {
        level: "not-ready" as const,
        title: "Local models need setup",
        message: "This computer needs a supported runtime, more space, or a smaller model.",
      }
    : !hasReadyRecommendation
      ? {
          level: "unknown" as const,
          title: "Hardware check incomplete",
          message: "Khonjel could not pick a local model yet, but you can try a smaller model.",
        }
      : availableRam != null && availableRam < 4 * GB
        ? {
            level: "limited" as const,
            title: "Use smaller local models",
            message: "This PC can use local models, but smaller models are recommended.",
          }
        : availableRam != null && availableRam >= 8 * GB
          ? {
              level: "great" as const,
              title: "Great for local models",
              message: "This PC can run the recommended private local setup.",
            }
          : {
              level: "good" as const,
              title: "Good for local models",
              message: "This PC can run local models. Larger models may be slower.",
            };
  return { hardware: args.hardware, runtimes: args.runtimes, summary, recommended, models };
}

function compatibilityFor(model: ModelStatus, hardware: HardwareProfile, runtimes: RuntimeStatus[]): ModelCompatibility {
  const req = REQUIREMENTS[model.id] ?? {
    minFreeDiskBytes: bytesFor(model),
    support: "supported" as const,
  };
  const reasons: ModelCompatibility["reasons"] = [];
  let level: CompatibilityLevel = model.recommended ? "recommended" : "works";
  const runtime = runtimeFromList(model, runtimes);
  if (req.support === "not-yet-supported" || runtime?.state === "unsupported") {
    reasons.push({ code: "runtime-unsupported", message: runtime?.message || `${model.name} runtime is not bundled in this version.` });
    level = "unsupported";
  } else if (runtime?.state && runtime.state !== "ready") {
    reasons.push({ code: "runtime-missing", message: runtime.message || "Runtime missing." });
    level = "unsupported";
  } else {
    reasons.push({ code: "runtime-ready", message: "Runtime ready." });
  }

  const freeDisk = hardware.freeDiskBytes;
  const neededDisk = Math.max(req.minFreeDiskBytes, bytesFor(model));
  if (freeDisk == null) {
    reasons.push({ code: "hardware-unknown", message: "Free disk could not be detected." });
    if (level !== "unsupported") level = "unknown";
  } else if (freeDisk < neededDisk) {
    reasons.push({ code: "not-enough-disk", message: `Not enough free disk space. Needs ${formatBytes(neededDisk)}.` });
    level = "unsupported";
  } else {
    reasons.push({ code: "enough-disk", message: "Enough free disk space." });
  }

  const ram = hardware.availableRamBytes ?? hardware.totalRamBytes;
  if (ram == null) {
    reasons.push({ code: "hardware-unknown", message: "Memory could not be detected." });
    if (level !== "unsupported") level = "unknown";
  } else if (req.minRamBytes && ram < req.minRamBytes) {
    reasons.push({ code: "not-enough-memory", message: `Not enough memory. Use a smaller model.` });
    level = "unsupported";
  } else if (req.recommendedRamBytes && ram < req.recommendedRamBytes) {
    reasons.push({ code: "low-memory", message: "Works, but may be slower on this PC." });
    if (level === "recommended" || level === "works") level = "limited";
  } else {
    reasons.push({ code: "enough-memory", message: "Enough memory." });
  }

  const hasGpu = hardware.gpus.some((g) => g.vendor !== "unknown");
  reasons.push(hasGpu ? { code: "gpu-available", message: "GPU detected." } : { code: "cpu-only", message: "CPU mode is available." });

  return {
    modelId: model.id,
    kind: model.kind,
    level,
    summary: reasons.find((r) => r.code === "runtime-unsupported")?.message ?? summaryFor(level, model.name),
    reasons,
    estimated: {
      speed: level === "recommended" ? "fast" : level === "works" ? "good" : level === "limited" ? "slow" : "unknown",
      firstLoad: model.kind === "llm" ? (level === "limited" ? "long" : "medium") : "short",
    },
  };
}

export function buildModelReadiness(args: {
  statuses: ModelStatus[];
  runtimes: RuntimeStatus[];
  activeModelIds: { stt?: string; llm?: string };
  selectedModelIds: { stt?: string; llm?: string };
}): ModelReadiness[] {
  return args.statuses.map((model): ModelReadiness => {
    const selected = args.selectedModelIds[model.kind] === model.id;
    const active = args.activeModelIds[model.kind] === model.id;
    const runtime = runtimeFromList(model, args.runtimes);
    if (runtime?.state === "unsupported") {
      return { modelId: model.id, kind: model.kind, state: "unsupported", selected, active, reason: runtime.message, nextAction: "choose-another" };
    }
    if (model.state === "error") {
      return { modelId: model.id, kind: model.kind, state: "failed", selected, active, reason: model.error?.message ?? "Model needs attention.", nextAction: "retry" };
    }
    if (model.state === "downloading" || model.state === "queued" || model.state === "paused") {
      return { modelId: model.id, kind: model.kind, state: "downloading", selected, active, reason: "Downloading model." };
    }
    if (model.state === "verifying") {
      return { modelId: model.id, kind: model.kind, state: "verifying", selected, active, reason: "Verifying download." };
    }
    if (model.state !== "installed") {
      return { modelId: model.id, kind: model.kind, state: "not-installed", selected, active, reason: "Download needed.", nextAction: "download" };
    }
    if (!model.engineReady || runtime?.state === "missing") {
      return { modelId: model.id, kind: model.kind, state: "runtime-missing", selected, active, reason: runtime?.message || "Runtime missing.", nextAction: "install-runtime" };
    }
    return { modelId: model.id, kind: model.kind, state: active || selected ? "ready" : "installed", selected, active, reason: active ? "Ready." : "Installed." };
  });
}

export function buildActiveModelReport(args: {
  readiness: ModelReadiness[];
  selectedModelIds: { stt?: string; llm?: string };
  activeModelIds: { stt?: string; llm?: string };
}): ActiveModelReport {
  const slot = (kind: "stt" | "llm") => {
    const selected = args.selectedModelIds[kind];
    const active = args.activeModelIds[kind];
    const ready = args.readiness.find((r) => r.modelId === selected);
    if (!selected) return { state: "none" as const, message: kind === "stt" ? "No speech model selected." : "No language model selected." };
    if (ready?.state === "ready") return { selectedModelId: selected, activeModelId: active ?? selected, state: "ready" as const, message: "Ready." };
    if (active && active !== selected) return { selectedModelId: selected, activeModelId: active, state: "fallback" as const, message: "Still using previous model while the selected model gets ready." };
    return { selectedModelId: selected, activeModelId: active, state: "failed" as const, message: ready?.reason ?? "Model is not ready." };
  };
  return { speech: slot("stt"), language: slot("llm") };
}

function summaryFor(level: CompatibilityLevel, name: string): string {
  switch (level) {
    case "recommended":
      return `Recommended for this PC.`;
    case "works":
      return `${name} works on this PC.`;
    case "limited":
      return `Works, but may be slower.`;
    case "unsupported":
      return `Not supported or not ready on this PC.`;
    default:
      return `Compatibility unknown.`;
  }
}

function formatBytes(bytes: number): string {
  const gb = bytes / GB;
  if (gb >= 1) return `${gb.toFixed(gb >= 10 ? 0 : 1)} GB`;
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}