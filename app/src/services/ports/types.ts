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
