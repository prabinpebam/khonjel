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
