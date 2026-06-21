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
}

export interface ConnectionService {
  list(): Promise<ConnectionProfile[]>;
  upsert(profile: ConnectionProfile): Promise<ConnectionProfile[]>;
  remove(id: string): Promise<ConnectionProfile[]>;
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
} from "./types";

import type {
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
}
