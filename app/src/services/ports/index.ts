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
 * Read-only content the views render. Mock adapter returns seed data synchronously;
 * a real adapter can return async and we revisit the call sites then.
 */
export interface ContentService {
  history(): HistoryEntry[];
  insights(): InsightsAggregate;
  chat(): ChatMessage[];
  folders(): Folder[];
  notes(): Note[];
  uploads(): UploadJob[];
  dictionary(): DictionaryEntry[];
  snippets(): Snippet[];
  transforms(): Transform[];
  integrations(): Integration[];
  sttModels(): ModelInfo[];
  llmModels(): ModelInfo[];
}

/** The full set of ports available to the app at runtime. */
export interface Services {
  profile: ProfileService;
  system: SystemService;
  content: ContentService;
  settings: SettingsService;
  inference: InferenceService;
  connections: ConnectionService;
}
