/** Domain entities surfaced by the content service (mock today, real adapters later). */

export type CaptureMode = "dictation" | "note-recording" | "upload";

export interface HistoryEntry {
  id: string;
  createdAt: string;
  finalText: string;
  app: string;
  language: string;
  wordCount: number;
  durationSec: number;
  mode: CaptureMode;
  hasAudio: boolean;
  cleanupApplied: boolean;
}

export interface InsightsAggregate {
  wpm: number;
  wpmPercentile: number;
  wordsCorrected: number;
  dictionaryFixes: number;
  totalWords: number;
  appUsage: { category: string; count: number; pct: number }[];
  streak: { current: number; longest: number };
  heatmap: { date: string; count: number }[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface Folder {
  id: string;
  name: string;
  count: number;
}

export interface Note {
  id: string;
  title: string;
  preview: string;
  body: string;
  folderId: string;
  updatedAt: string;
  fromRecording: boolean;
}

export type UploadState = "queued" | "transcribing" | "done" | "error";

export interface UploadJob {
  id: string;
  filename: string;
  durationSec: number;
  format: string;
  state: UploadState;
  progress: number;
  result?: string;
  error?: string;
}

export type LibraryScope = "personal" | "team";

export interface DictionaryEntry {
  id: string;
  type: "term" | "substitution";
  term?: string;
  trigger?: string;
  replacement?: string;
  scope: LibraryScope;
  source: "manual" | "auto-learn";
}

export interface Snippet {
  id: string;
  trigger: string;
  expansion: string;
  scope: LibraryScope;
}

export interface Transform {
  id: string;
  name: string;
  description: string;
  hotkey: string;
  builtin: boolean;
  enabled: boolean;
  /** System instruction sent to the LLM with the selected text when the hotkey fires. */
  prompt: string;
}

export type IntegrationStatus = "connected" | "disconnected";

export interface Integration {
  id: string;
  name: string;
  description: string;
  icon: "calendar" | "code" | "blocks" | "terminal";
  status: IntegrationStatus;
  detail?: string;
}

export interface ModelInfo {
  id: string;
  name: string;
  sizeLabel: string;
  recommended: boolean;
}

/**
 * Install lifecycle of a local model asset (07 §2). Internal; the UI projects it to four visible
 * states — Available (`not-installed`), Downloading (`queued`/`downloading`/`paused`/`verifying`),
 * Installed, Failed (`error`). `removing` is transient during delete.
 */
export type ModelInstallState =
  | "not-installed"
  | "queued"
  | "downloading"
  | "paused"
  | "verifying"
  | "installed"
  | "error"
  | "removing";

/** Internal failure codes (07 §4); the user only ever sees `message`. */
export type ModelErrorCode =
  | "offline"
  | "source-unavailable"
  | "disk-full"
  | "checksum-mismatch"
  | "corrupt"
  | "permission"
  | "internal";

export interface ModelError {
  code: ModelErrorCode;
  message: string;
}

/** A catalog model joined with its live install state (07 §7). */
export interface ModelStatus extends ModelInfo {
  kind: "stt" | "llm";
  state: ModelInstallState;
  /** downloading/paused — drives the only progress text ("289 / 466 MB"). */
  bytesDone?: number;
  /** == manifest.bytes when known. */
  bytesTotal?: number;
  /** Its runtime (whisper/llama) is present, so an installed model can actually run. */
  engineReady: boolean;
  error?: ModelError;
  /** On-disk size once installed. */
  installedBytes?: number;
  /** ISO timestamp of the last successful integrity check. */
  verifiedAt?: string;
  /** Bound by at least one slot (drives the "In use" tag + remove-safety). */
  inUse?: boolean;
}

/** The one storage summary the UI shows (07 §6). */
export interface ModelStorageReport {
  cachePath: string;
  usedBytes: number;
  freeBytes: number;
}

/** A live progress tick streamed during a download (07 §7). */
export interface ModelProgress {
  id: string;
  state: ModelInstallState;
  bytesDone?: number;
  bytesTotal?: number;
  error?: ModelError;
}

export interface HardwareGpu {
  name: string;
  vendor: "nvidia" | "amd" | "intel" | "apple" | "unknown";
  vramBytes?: number;
  driverVersion?: string;
}

export interface HardwareProfile {
  os: "win32" | "darwin" | "linux";
  arch: string;
  cpuName?: string;
  physicalCores?: number;
  logicalCores?: number;
  totalRamBytes?: number;
  availableRamBytes?: number;
  freeDiskBytes?: number;
  gpus: HardwareGpu[];
  power: "plugged" | "battery" | "unknown";
  detectionWarnings: string[];
}

export interface RuntimeStatus {
  engine: "whisper" | "llama" | "parakeet";
  state: "ready" | "missing" | "downloadable" | "unsupported" | "failed";
  message: string;
  path?: string;
  version?: string;
  reason?: string;
  action?: "download-runtime" | "choose-another" | "open-folder" | "retry";
}

export type CompatibilityLevel = "recommended" | "works" | "limited" | "unsupported" | "unknown";

export interface CompatibilityReason {
  code:
    | "enough-memory"
    | "low-memory"
    | "not-enough-memory"
    | "enough-disk"
    | "not-enough-disk"
    | "gpu-available"
    | "cpu-only"
    | "runtime-ready"
    | "runtime-missing"
    | "runtime-unsupported"
    | "hardware-unknown";
  message: string;
  action?: string;
}

export interface ModelCompatibility {
  modelId: string;
  kind: "stt" | "llm";
  level: CompatibilityLevel;
  summary: string;
  reasons: CompatibilityReason[];
  estimated: {
    speed: "fast" | "good" | "slow" | "unknown";
    firstLoad: "short" | "medium" | "long" | "unknown";
  };
}

export interface ModelCompatibilityReport {
  hardware: HardwareProfile;
  runtimes: RuntimeStatus[];
  summary: {
    level: "great" | "good" | "limited" | "not-ready" | "unknown";
    title: string;
    message: string;
  };
  recommended: { stt?: string; llm?: string };
  models: ModelCompatibility[];
}

export type ModelReadinessState =
  | "not-installed"
  | "downloading"
  | "verifying"
  | "installed"
  | "runtime-missing"
  | "starting"
  | "ready"
  | "failed"
  | "unsupported";

export interface ModelReadiness {
  modelId: string;
  kind: "stt" | "llm";
  state: ModelReadinessState;
  active: boolean;
  selected: boolean;
  previousActiveModelId?: string;
  reason?: string;
  nextAction?: "download" | "install-runtime" | "retry" | "choose-another" | "manage-storage";
}

export interface ActiveModelSlot {
  selectedModelId?: string;
  activeModelId?: string;
  state: "none" | "starting" | "ready" | "fallback" | "failed";
  message: string;
}

export interface ActiveModelReport {
  speech?: ActiveModelSlot;
  language?: ActiveModelSlot;
}

export interface ModelRuntimeEvent {
  modelId: string;
  kind: "stt" | "llm";
  state: "starting" | "ready" | "fallback" | "failed";
  message: string;
  activeModelId?: string;
}

/**
 * A streamed transcript update during a long-form capture session (12 §2A.6). `final` is a closed
 * window's text; `partial` is reserved for true streaming engines. `fullText` is the running
 * transcript (finalized windows joined) the surface renders live.
 */
export interface TranscriptEvent {
  sessionId: string;
  kind: "partial" | "final";
  segmentId: number;
  text: string;
  fullText: string;
}

/* ------------------------------------------------------------------ *
 * GPU acceleration (docs/product-spec/04-architecture-and-delivery/   *
 * gpu-acceleration). Local-model GPU support: detect -> decide ->     *
 * provision -> validate -> run, with graceful CPU fallback.           *
 * ------------------------------------------------------------------ */

export type GpuVendor = "nvidia" | "amd" | "intel" | "apple" | "unknown";

/** A local inference engine that can be accelerated. */
export type AccelerationEngine = "llama" | "whisper";

/** An engine build variant targeting a compute API. One per engine. */
export type Backend = "cuda-13.3" | "cuda-12.4" | "vulkan" | "metal" | "hip" | "sycl" | "cpu";

/** User-facing acceleration setting. `auto` is the default (smart, zero-click). */
export type AccelerationMode = "auto" | "on" | "off";

/** Which detection tier/source contributed a field (for diagnostics + confidence). */
export type GpuDetectionSource = "os" | "nvidia-smi" | "registry" | "system_profiler" | "lspci";

export interface GpuDevice {
  /** Ordinal for multi-GPU machines. */
  index: number;
  name: string;
  vendor: GpuVendor;
  /** PCI vendor id (e.g. "10DE" NVIDIA, "1002" AMD, "8086" Intel). */
  vendorId?: string;
  /** Accurate VRAM where a trustworthy source exists; undefined when unknown. */
  vramBytes?: number;
  /** Apple Silicon shares system RAM as GPU memory. */
  unifiedMemory?: boolean;
  driverVersion?: string;
  /** NVIDIA compute capability, e.g. "8.9". */
  computeCapability?: string;
  /** Max CUDA version the installed driver supports, e.g. "13.0". */
  maxCudaVersion?: string;
  isIntegrated?: boolean;
  source: GpuDetectionSource[];
}

export interface GpuProfile {
  os: "win32" | "darwin" | "linux";
  arch: string;
  devices: GpuDevice[];
  /** The device we plan to use (discrete > integrated, most accurate VRAM). */
  primary?: GpuDevice;
  /** ISO timestamp; drives cache invalidation. */
  detectedAt: string;
  warnings: string[];
}

export interface BackendCandidate {
  backend: Backend;
  /** Plain-language rationale, e.g. "Best for your NVIDIA graphics card". */
  reason: string;
  confidence: "high" | "medium" | "low";
  /** Soft driver gate (ordering/tips only; the probe is the hard gate). */
  minDriver?: string;
  /** Extra parts the backend needs, e.g. ["cudart-12.4"]. */
  requires?: string[];
}

export type AccelerationLevel = "gpu-great" | "gpu-ok" | "cpu-only" | "unknown";

export interface AccelerationPlan {
  /** Ordered best-first candidate backends for the local LLM. */
  llm: BackendCandidate[];
  /** Ordered best-first candidate backends for local STT. */
  stt: BackendCandidate[];
  recommendedLevel: AccelerationLevel;
  /** Plain-language summary for the acceleration card. */
  summary: string;
  /** Pre-commit benefit hint from VRAM + model fit, e.g. "5-10x". */
  estimatedSpeedup?: string;
  /** Total bytes to fetch to enable the recommended backend (engine + redist). */
  downloadBytes?: number;
  /** Installed footprint of the recommended backend. */
  diskBytes?: number;
  /** False when already provisioned or offline-ready (no download needed). */
  requiresDownload: boolean;
}

/** Local, never-transmitted runtime measurements that power the test UX + honest status. */
export interface RuntimeMetrics {
  device: "gpu" | "cpu";
  backend?: Backend;
  tokensPerSec?: number;
  offloadedLayers?: number;
  vramUsedBytes?: number;
  firstTokenMs?: number;
  realtimeFactor?: number;
}

export type BackendState =
  | "none"
  | "planning"
  | "downloading"
  | "verifying"
  | "installing"
  | "probing"
  | "active"
  | "deferred"
  | "quarantined"
  | "failed";

export interface EngineAcceleration {
  engine: AccelerationEngine;
  device: "gpu" | "cpu";
  activeBackend?: Backend;
  state: BackendState;
  /** User-facing one-liner. */
  message: string;
  metrics?: RuntimeMetrics;
  lastError?: { code: string; message: string };
}

export interface AccelerationState {
  mode: AccelerationMode;
  llm: EngineAcceleration;
  stt: EngineAcceleration;
  /** Any engine currently on the GPU. */
  gpuActive: boolean;
  /** Network reachable for provisioning (drives offline copy). */
  online: boolean;
  /** Present while `auto` mode provisions in the background. */
  autoSetup?: { active: boolean; message: string; bytesDone?: number; bytesTotal?: number };
  /** One-shot, surfaced as a toast then cleared. */
  notice?: { kind: "enabled" | "rolled-back" | "updated"; message: string };
  /** "Running on your NVIDIA RTX 4090" / "Running on CPU". */
  summary: string;
}

export interface AccelerationProgress {
  engine: AccelerationEngine;
  backend: Backend;
  state: BackendState;
  bytesDone?: number;
  bytesTotal?: number;
  message: string;
  /** Present on a rollback. */
  rolledBackTo?: Backend;
}

export interface AccelerationTestLeg {
  ok: boolean;
  message: string;
  metrics?: RuntimeMetrics;
}

export interface AccelerationTestReport {
  ok: boolean;
  gpu?: RuntimeMetrics;
  cpu?: RuntimeMetrics;
  /** gpu.tokensPerSec / cpu.tokensPerSec. */
  speedup?: number;
  llm: AccelerationTestLeg;
  stt: AccelerationTestLeg;
  summary: string;
}
