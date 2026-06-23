// @vitest-environment node
import { describe, expect, it } from "vitest";
import { buildModelCompatibilityReport, buildModelReadiness, chooseRecommendedModels } from "./compatibility";
import type { HardwareProfile, ModelStatus, RuntimeStatus } from "../../../src/services/ports";

const GB = 1024 * 1024 * 1024;

function hardware(overrides: Partial<HardwareProfile> = {}): HardwareProfile {
  return {
    os: "win32",
    arch: "x64",
    cpuName: "Test CPU",
    physicalCores: 8,
    logicalCores: 16,
    totalRamBytes: 16 * GB,
    availableRamBytes: 10 * GB,
    freeDiskBytes: 100 * GB,
    gpus: [{ name: "NVIDIA RTX", vendor: "nvidia", vramBytes: 8 * GB }],
    power: "plugged",
    detectionWarnings: [],
    ...overrides,
  };
}

const runtimes: RuntimeStatus[] = [
  { engine: "whisper", state: "ready", message: "Speech runtime ready." },
  { engine: "llama", state: "ready", message: "Language runtime ready." },
  { engine: "parakeet", state: "unsupported", message: "Parakeet local runtime is not bundled yet." },
];

const baseStatuses: ModelStatus[] = [
  {
    id: "ggml-base.en.bin",
    name: "Whisper Base (English)",
    sizeLabel: "142 MB",
    recommended: false,
    kind: "stt",
    state: "not-installed",
    engineReady: true,
    bytesTotal: 142 * 1024 * 1024,
  },
  {
    id: "ggml-small.bin",
    name: "Whisper Small",
    sizeLabel: "466 MB",
    recommended: true,
    kind: "stt",
    state: "not-installed",
    engineReady: true,
    bytesTotal: 466 * 1024 * 1024,
  },
  {
    id: "sherpa-onnx-nemo-parakeet-tdt-0.6b-v3",
    name: "Parakeet TDT 0.6B v3",
    sizeLabel: "0.6 GB",
    recommended: false,
    kind: "stt",
    state: "not-installed",
    engineReady: false,
    bytesTotal: 600 * 1024 * 1024,
  },
  {
    id: "qwen2.5-1.5b-instruct-q4_k_m.gguf",
    name: "Qwen2.5 1.5B Instruct",
    sizeLabel: "1.1 GB",
    recommended: false,
    kind: "llm",
    state: "installed",
    engineReady: true,
    installedBytes: 1100 * 1024 * 1024,
  },
  {
    id: "qwen2.5-3b-instruct-q4_k_m.gguf",
    name: "Qwen2.5 3B Instruct",
    sizeLabel: "2.0 GB",
    recommended: true,
    kind: "llm",
    state: "not-installed",
    engineReady: true,
    bytesTotal: 2 * GB,
  },
  {
    id: "qwen2.5-7b-instruct-q4_k_m.gguf",
    name: "Qwen2.5 7B Instruct",
    sizeLabel: "4.7 GB",
    recommended: false,
    kind: "llm",
    state: "not-installed",
    engineReady: true,
    bytesTotal: Math.round(4.7 * GB),
  },
];

describe("model compatibility", () => {
  it("recommends balanced local speech and language models on capable hardware", () => {
    const report = buildModelCompatibilityReport({ hardware: hardware(), runtimes, statuses: baseStatuses });
    expect(report.summary.level).toBe("great");
    expect(report.recommended.stt).toBe("ggml-small.bin");
    expect(report.recommended.llm).toBe("qwen2.5-3b-instruct-q4_k_m.gguf");
    expect(report.models.find((m) => m.modelId === "qwen2.5-3b-instruct-q4_k_m.gguf")?.level).toBe("recommended");
  });

  it("falls back to smaller recommendations on limited RAM", () => {
    const report = buildModelCompatibilityReport({
      hardware: hardware({ totalRamBytes: 6 * GB, availableRamBytes: 3 * GB }),
      runtimes,
      statuses: baseStatuses,
    });
    expect(report.summary.level).toBe("limited");
    expect(report.recommended.llm).toBe("qwen2.5-1.5b-instruct-q4_k_m.gguf");
    expect(report.models.find((m) => m.modelId === "qwen2.5-7b-instruct-q4_k_m.gguf")?.level).toBe("unsupported");
  });

  it("marks not-yet-supported runtimes as unsupported with plain copy", () => {
    const report = buildModelCompatibilityReport({ hardware: hardware(), runtimes, statuses: baseStatuses });
    const parakeet = report.models.find((m) => m.modelId === "sherpa-onnx-nemo-parakeet-tdt-0.6b-v3");
    expect(parakeet?.level).toBe("unsupported");
    expect(parakeet?.summary).toMatch(/runtime is not bundled/i);
    expect(parakeet?.reasons.some((r) => r.code === "runtime-unsupported")).toBe(true);
  });

  it("detects not-enough-disk before a download starts", () => {
    const report = buildModelCompatibilityReport({
      hardware: hardware({ freeDiskBytes: 300 * 1024 * 1024 }),
      runtimes,
      statuses: baseStatuses,
    });
    const llm = report.models.find((m) => m.modelId === "qwen2.5-3b-instruct-q4_k_m.gguf");
    expect(llm?.level).toBe("unsupported");
    expect(llm?.reasons.some((r) => r.code === "not-enough-disk")).toBe(true);
  });
});

describe("model readiness", () => {
  it("projects installed + runtime-ready + active as ready", () => {
    const readiness = buildModelReadiness({
      statuses: baseStatuses,
      runtimes,
      activeModelIds: { llm: "qwen2.5-1.5b-instruct-q4_k_m.gguf" },
      selectedModelIds: { llm: "qwen2.5-1.5b-instruct-q4_k_m.gguf" },
    });
    const active = readiness.find((r) => r.modelId === "qwen2.5-1.5b-instruct-q4_k_m.gguf");
    expect(active?.state).toBe("ready");
    expect(active?.active).toBe(true);
  });

  it("explains runtime-missing separately from not-installed", () => {
    const readiness = buildModelReadiness({
      statuses: [{ ...baseStatuses[0]!, state: "installed", engineReady: false }],
      runtimes: [{ engine: "whisper", state: "missing", message: "Speech runtime missing." }],
      activeModelIds: {},
      selectedModelIds: { stt: "ggml-base.en.bin" },
    });
    expect(readiness[0]?.state).toBe("runtime-missing");
    expect(readiness[0]?.reason).toMatch(/runtime/i);
  });
});

describe("recommendation helper", () => {
  it("chooses one recommended model per kind", () => {
    const report = buildModelCompatibilityReport({ hardware: hardware(), runtimes, statuses: baseStatuses });
    expect(chooseRecommendedModels(report.models)).toEqual({ stt: "ggml-small.bin", llm: "qwen2.5-3b-instruct-q4_k_m.gguf" });
  });
});
