/**
 * Service ports (the seam).
 *
 * UI and features import ONLY these interfaces via `@services` — never an adapter
 * directly (enforced by ESLint `no-restricted-imports`). Mock adapters back them
 * today; real Electron/IPC adapters will back them later with zero UI change.
 *
 * The `Services` container grows one port at a time, per delivery phase. Phase 0
 * wires `profile` + `system` to prove the seam end-to-end.
 */

export type Platform = "win32" | "darwin" | "linux" | "web";

/** How dictated text was delivered to the focused app (see backend injection table). */
export type InjectionStrategy = "paste" | "type" | "clipboard";

export interface InjectionOutcome {
  strategy: InjectionStrategy;
  /** Lowercased executable that had focus, when detectable. */
  app?: string;
}

export interface Profile {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string;
}

export interface ProfileService {
  /** The local user profile (local-first: no account required). */
  get(): Promise<Profile>;
}

export interface SystemService {
  getAppVersion(): Promise<string>;
  getPlatform(): Promise<Platform>;
  /** Inject text into the currently focused app (clipboard/paste/type per the app table). */
  injectText(text: string): Promise<InjectionOutcome>;
  /** Copy the current selection from the focused app and return it (for hotkey-bound transforms). */
  captureSelection(): Promise<string>;
}

/**
 * Settings: the renderer's two flat dotted-key maps. The backend owns the durable copy
 * (SQLite, main process); the mock backs it with local state. Shape mirrors
 * `src/stores/settings.ts` exactly. See backend/08 §3.4 + 09 §4.
 */
export interface SettingsSnapshot {
  toggles: Record<string, boolean>;
  values: Record<string, string>;
}

export interface SettingsPatch {
  toggles?: Record<string, boolean>;
  values?: Record<string, string>;
}

export interface SettingsService {
  /** The current settings (both flat maps). */
  get(): Promise<SettingsSnapshot>;
  /** Shallow-merge the provided toggles/values, persist, and return the new snapshot. */
  patch(patch: SettingsPatch): Promise<SettingsSnapshot>;
}

/**
 * Inference: the deterministic-then-LLM text pipeline. Phase 1 ships `cleanup` (the dictation hot
 * path: dictionary -> dictated punctuation -> skip-if-clean -> LLM refine -> snippets). The agent,
 * chat, note-format, and transform purposes are added in Phase 5. See backend/03 §4 + 08 §3.2.
 */
export interface CleanupOptions {
  cleanupEnabled?: boolean;
  agentName?: string;
  dictionary?: DictionaryEntry[];
  snippets?: Snippet[];
}

export interface CleanupResult {
  text: string;
  cleaned: boolean;
  mode: "dictation" | "agent";
}

export interface InferenceService {
  cleanup(input: string, options?: CleanupOptions): Promise<CleanupResult>;
  /** Multi-turn chat against the local (or configured) LLM. Returns the assistant reply text. */
  chat(messages: ChatTurn[]): Promise<{ text: string }>;
}

/** A single conversation turn for {@link InferenceService.chat}. */
export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

/**
 * Speech-to-text. The renderer captures mic audio and sends it as base64 WAV (16kHz mono PCM16);
 * the main process runs it through the local whisper.cpp engine. A missing model surfaces as an
 * IpcError with code `model_unavailable`. See backend/10 (local STT).
 */
export interface TranscriptionRequest {
  audioBase64: string;
  /** Whisper language code or "auto". */
  language?: string;
  /** Translate to English instead of transcribing in-language. */
  translate?: boolean;
}

export interface TranscriptionResult {
  text: string;
}

export interface TranscriptionService {
  transcribe(req: TranscriptionRequest): Promise<TranscriptionResult>;
}

/**
 * Provider connection profiles (cloud/self-hosted, incl. Azure OpenAI). The non-secret profile is
 * configured here; the key/token is set separately into the OS keychain (Phase 2 runtime). The URL
 * and auth construction is pure backend logic. See backend/10 §3a.
 */
export type ConnectionKind =
  | "openai"
  | "openai-compatible"
  | "azure-openai"
  | "anthropic"
  | "gemini"
  | "groq"
  | "deepgram"
  | "xai"
  | "bedrock"
  | "vertex";

export type ConnectionAuthMode = "api-key-header" | "bearer-token" | "aad";

export interface ConnectionProfile {
  id: string;
  kind: ConnectionKind;
  /** Base URL, no path (e.g. https://<resource>.cognitiveservices.azure.com). */
  baseEndpoint: string;
  /** Required for azure-openai (query param); unused for most others. */
  apiVersion?: string;
  authMode: ConnectionAuthMode;
  /** Header name for api-key-header mode (Azure uses "api-key"). */
  headerName?: string;
  /** Default model id / Azure deployment name for this connection; a slot may override it. */
  model?: string;
}

export interface ConnectionService {
  list(): Promise<ConnectionProfile[]>;
  upsert(profile: ConnectionProfile): Promise<ConnectionProfile[]>;
  remove(id: string): Promise<ConnectionProfile[]>;
  /** Validate a connection + model/deployment, pinging the operation the slot will use. */
  test(id: string, target: string, operation: ConnectionTestOperation): Promise<ConnectionTestResult>;
}

/** Which endpoint a connection test should exercise (matches the slot's kind). */
export type ConnectionTestOperation = "chat" | "transcription";

export interface ConnectionTestResult {
  ok: boolean;
  message?: string;
}

/**
 * Provider API keys. The secret is sent once to main (set), encrypted at rest with the OS keychain
 * (Electron safeStorage), and NEVER read back to the renderer — only presence (has) + delete.
 */
export interface SecretsService {
  set(id: string, secret: string): Promise<void>;
  has(id: string): Promise<boolean>;
  remove(id: string): Promise<void>;
}

export type {
  CaptureMode,
  HistoryEntry,
  InsightsAggregate,
  ChatMessage,
  Folder,
  Note,
  UploadState,
  UploadJob,
  LibraryScope,
  DictionaryEntry,
  Snippet,
  Transform,
  IntegrationStatus,
  Integration,
  ModelInfo,
  ModelInstallState,
  ModelErrorCode,
  ModelError,
  ModelStatus,
  ModelStorageReport,
  ModelProgress,
  HardwareProfile,
  RuntimeStatus,
  CompatibilityLevel,
  ModelCompatibility,
  ModelCompatibilityReport,
  ModelReadinessState,
  ModelReadiness,
  ActiveModelSlot,
  ActiveModelReport,
  ModelRuntimeEvent,
  TranscriptEvent,
} from "./types";

import type {
  CaptureMode,
  HistoryEntry,
  InsightsAggregate,
  ChatMessage,
  Folder,
  Note,
  UploadJob,
  DictionaryEntry,
  Snippet,
  Transform,
  Integration,
  ModelInfo,
  ModelStatus,
  ModelStorageReport,
  ModelProgress,
  ModelCompatibilityReport,
  ModelReadiness,
  ActiveModelReport,
  ModelRuntimeEvent,
  TranscriptEvent,
} from "./types";

/**
 * Read-only content the views render. Async: the mock resolves immediately; the real ipc adapter
 * fetches from the main process. Views load via the `useAsync` hook.
 */
export interface ContentService {
  history(): Promise<HistoryEntry[]>;
  insights(): Promise<InsightsAggregate>;
  chat(): Promise<ChatMessage[]>;
  folders(): Promise<Folder[]>;
  notes(): Promise<Note[]>;
  uploads(): Promise<UploadJob[]>;
  dictionary(): Promise<DictionaryEntry[]>;
  snippets(): Promise<Snippet[]>;
  transforms(): Promise<Transform[]>;
  integrations(): Promise<Integration[]>;
  sttModels(): Promise<ModelInfo[]>;
  llmModels(): Promise<ModelInfo[]>;
  /** Append a completed dictation to history (id/createdAt/wordCount are filled by the backend). */
  addHistory(entry: HistoryDraft): Promise<HistoryEntry[]>;
  /** Persist a user-owned collection wholesale (the caller holds the full array). */
  saveHistory(entries: HistoryEntry[]): Promise<void>;
  saveNotes(notes: Note[]): Promise<void>;
  saveFolders(folders: Folder[]): Promise<void>;
  saveDictionary(entries: DictionaryEntry[]): Promise<void>;
  saveSnippets(snippets: Snippet[]): Promise<void>;
  saveTransforms(transforms: Transform[]): Promise<void>;
  saveIntegrations(integrations: Integration[]): Promise<void>;
  saveChat(messages: ChatMessage[]): Promise<void>;
  saveUploads(jobs: UploadJob[]): Promise<void>;
  /** Subscribe to content mutations (e.g. a new dictation appended to history) for live refresh. */
  onChanged(callback: (collection: string) => void): () => void;
}

/** The fields a caller supplies for a new history entry; the store derives id/createdAt/wordCount. */
export interface HistoryDraft {
  finalText: string;
  app: string;
  language: string;
  durationSec: number;
  mode: CaptureMode;
  hasAudio: boolean;
  cleanupApplied: boolean;
}

/**
 * Local model management (07 §7). Acquire, verify, remove on-device model assets and report
 * storage. `onProgress` streams live download ticks (the ipc adapter bridges them from main; the
 * mock drives them from its simulated downloads). Resume, queueing, and orphan cleanup are internal
 * automatic mechanics — not part of this surface.
 */
export interface ModelManagementService {
  status(): Promise<ModelStatus[]>;
  compatibility(): Promise<ModelCompatibilityReport>;
  readiness(): Promise<ModelReadiness[]>;
  active(): Promise<ActiveModelReport>;
  prepare(id: string): Promise<void>;
  download(id: string): Promise<void>;
  cancel(id: string): Promise<void>;
  verify(id: string): Promise<{ ok: boolean }>;
  remove(id: string): Promise<{ freedBytes: number }>;
  storage(): Promise<ModelStorageReport>;
  /** Subscribe to live progress; returns an unsubscribe fn. */
  onProgress(callback: (progress: ModelProgress) => void): () => void;
  /** Subscribe to runtime readiness/switching events; returns an unsubscribe fn. */
  onRuntime(callback: (event: ModelRuntimeEvent) => void): () => void;
}

/**
 * Long-form capture session (12 §2A.6). Streams 16 kHz mono 16-bit PCM frames to the backend and
 * surfaces a live, growing transcript via `onTranscript`. `pushChunk` is fire-and-forget (high-rate
 * frames); `start`/`stop` bound a session. The ipc adapter bridges frames + events to main; the mock
 * simulates them so the browser preview shows live partials.
 */
export interface CaptureService {
  start(): Promise<string>;
  pushChunk(sessionId: string, base64Pcm16: string): void;
  stop(sessionId: string): Promise<{ text: string }>;
  onTranscript(callback: (event: TranscriptEvent) => void): () => void;
}

/** The full set of ports available to the app at runtime. */
export interface Services {
  profile: ProfileService;
  system: SystemService;
  content: ContentService;
  settings: SettingsService;
  inference: InferenceService;
  transcription: TranscriptionService;
  connections: ConnectionService;
  secrets: SecretsService;
  models: ModelManagementService;
  capture: CaptureService;
}
