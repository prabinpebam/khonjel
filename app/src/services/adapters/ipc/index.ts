import type {
  ChatMessage,
  CleanupResult,
  ConnectionProfile,
  ConnectionTestResult,
  DictionaryEntry,
  Folder,
  HistoryEntry,
  InjectionOutcome,
  InsightsAggregate,
  Integration,
  ModelInfo,
  Note,
  Platform,
  Profile,
  Services,
  SettingsSnapshot,
  Snippet,
  Transform,
  TranscriptionRequest,
  TranscriptionResult,
  UploadJob,
} from "@services/ports";
import { CHANNELS } from "@ipc/ipc-contract";

/**
 * The renderer-side `ipc` adapter: implements the `@services` ports by calling the injected
 * `invoke` (a request/response IPC call). It imports ONLY the pure contract (channel names) —
 * never the dispatch/handlers/zod — so no main-process or node code reaches the renderer bundle.
 *
 * `invoke` is provided by the preload bridge (`window.khonjel.invoke`) under Electron, and by an
 * in-memory loopback in tests. Every port is now backed by the main-process dispatch, so this
 * adapter routes the whole `Services` contract over IPC. See backend/08 + 14 (T0.4).
 */
export type Invoke = (channel: string, ...args: unknown[]) => Promise<unknown>;

export function createIpcServices(invoke: Invoke): Services {
  return {
    profile: {
      get: () => invoke(CHANNELS.profileGet) as Promise<Profile>,
    },
    system: {
      getAppVersion: () => invoke(CHANNELS.systemGetAppVersion) as Promise<string>,
      getPlatform: () => invoke(CHANNELS.systemGetPlatform) as Promise<Platform>,
      injectText: (text) => invoke(CHANNELS.systemInjectText, text) as Promise<InjectionOutcome>,
      captureSelection: () => invoke(CHANNELS.systemCaptureSelection) as Promise<string>,
    },
    settings: {
      get: () => invoke(CHANNELS.settingsGet) as Promise<SettingsSnapshot>,
      patch: (patch) => invoke(CHANNELS.settingsPatch, patch) as Promise<SettingsSnapshot>,
    },
    inference: {
      cleanup: (input, options) => invoke(CHANNELS.inferenceCleanup, input, options ?? {}) as Promise<CleanupResult>,
      chat: (messages) => invoke(CHANNELS.inferenceChat, messages) as Promise<{ text: string }>,
    },
    transcription: {
      transcribe: (req: TranscriptionRequest) =>
        invoke(CHANNELS.transcriptionTranscribe, req) as Promise<TranscriptionResult>,
    },
    connections: {
      list: () => invoke(CHANNELS.connectionsList) as Promise<ConnectionProfile[]>,
      upsert: (profile) => invoke(CHANNELS.connectionsUpsert, profile) as Promise<ConnectionProfile[]>,
      remove: (id) => invoke(CHANNELS.connectionsRemove, id) as Promise<ConnectionProfile[]>,
      test: (id, target, operation) =>
        invoke(CHANNELS.connectionsTest, id, target, operation) as Promise<ConnectionTestResult>,
    },
    secrets: {
      set: (id, secret) => invoke(CHANNELS.secretsSet, id, secret) as Promise<void>,
      has: (id) => invoke(CHANNELS.secretsHas, id) as Promise<boolean>,
      remove: (id) => invoke(CHANNELS.secretsRemove, id) as Promise<void>,
    },
    content: {
      history: () => invoke(CHANNELS.contentHistory) as Promise<HistoryEntry[]>,
      insights: () => invoke(CHANNELS.contentInsights) as Promise<InsightsAggregate>,
      chat: () => invoke(CHANNELS.contentChat) as Promise<ChatMessage[]>,
      folders: () => invoke(CHANNELS.contentFolders) as Promise<Folder[]>,
      notes: () => invoke(CHANNELS.contentNotes) as Promise<Note[]>,
      uploads: () => invoke(CHANNELS.contentUploads) as Promise<UploadJob[]>,
      dictionary: () => invoke(CHANNELS.contentDictionary) as Promise<DictionaryEntry[]>,
      snippets: () => invoke(CHANNELS.contentSnippets) as Promise<Snippet[]>,
      transforms: () => invoke(CHANNELS.contentTransforms) as Promise<Transform[]>,
      integrations: () => invoke(CHANNELS.contentIntegrations) as Promise<Integration[]>,
      sttModels: () => invoke(CHANNELS.contentSttModels) as Promise<ModelInfo[]>,
      llmModels: () => invoke(CHANNELS.contentLlmModels) as Promise<ModelInfo[]>,
      addHistory: (entry) => invoke(CHANNELS.contentAddHistory, entry) as Promise<HistoryEntry[]>,
      saveNotes: (notes) => invoke(CHANNELS.contentReplace, "notes", notes) as Promise<void>,
      saveFolders: (folders) => invoke(CHANNELS.contentReplace, "folders", folders) as Promise<void>,
      saveDictionary: (entries) => invoke(CHANNELS.contentReplace, "dictionary", entries) as Promise<void>,
      saveSnippets: (snippets) => invoke(CHANNELS.contentReplace, "snippets", snippets) as Promise<void>,
      saveTransforms: (transforms) => invoke(CHANNELS.contentReplace, "transforms", transforms) as Promise<void>,
      saveIntegrations: (integrations) =>
        invoke(CHANNELS.contentReplace, "integrations", integrations) as Promise<void>,
      saveChat: (messages) => invoke(CHANNELS.contentReplace, "chat", messages) as Promise<void>,
      saveUploads: (jobs) => invoke(CHANNELS.contentReplace, "uploads", jobs) as Promise<void>,
    },
  };
}
