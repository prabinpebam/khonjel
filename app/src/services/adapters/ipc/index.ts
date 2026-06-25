import type {
  ChatMessage,
  ChatThread,
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
  ModelCompatibilityReport,
  ModelReadiness,
  ActiveModelReport,
  ModelRuntimeEvent,
  ModelProgress,
  ModelStatus,
  ModelStorageReport,
  Note,
  Platform,
  Services,
  SettingsSnapshot,
  Snippet,
  TranscriptEvent,
  Transform,
  TranscriptionRequest,
  TranscriptionResult,
  UploadJob,
  GpuProfile,
  AccelerationPlan,
  AccelerationState,
  AccelerationProgress,
  AccelerationTestReport,
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

/** Subscribe to main-process progress events (preload `window.khonjel.onModelProgress`). */
export type SubscribeModelProgress = (callback: (progress: ModelProgress) => void) => () => void;

/** Subscribe to main-process runtime readiness/switching events. */
export type SubscribeModelRuntime = (callback: (event: ModelRuntimeEvent) => void) => () => void;

/** Subscribe to content-mutation relays (preload `window.khonjel.onContentChanged`). */
export type SubscribeContentChanged = (callback: (collection: string) => void) => () => void;

/** Subscribe to acceleration progress + state relays (preload bridges). */
export type SubscribeAccelerationProgress = (callback: (event: AccelerationProgress) => void) => () => void;
export type SubscribeAccelerationState = (callback: (state: AccelerationState) => void) => () => void;

/** The capture bridge (preload): push high-rate frames + subscribe to the live transcript. */
export interface CaptureBridge {
  pushChunk: (sessionId: string, base64Pcm16: string) => void;
  onTranscript: (callback: (event: TranscriptEvent) => void) => () => void;
}

export function createIpcServices(
  invoke: Invoke,
  subscribeModelProgress?: SubscribeModelProgress,
  subscribeContentChanged?: SubscribeContentChanged,
  captureBridge?: CaptureBridge,
  subscribeModelRuntime?: SubscribeModelRuntime,
  subscribeAccelerationProgress?: SubscribeAccelerationProgress,
  subscribeAccelerationState?: SubscribeAccelerationState,
): Services {
  return {
    system: {
      getAppVersion: () => invoke(CHANNELS.systemGetAppVersion) as Promise<string>,
      getPlatform: () => invoke(CHANNELS.systemGetPlatform) as Promise<Platform>,
      getAccountName: () => invoke(CHANNELS.systemGetAccountName) as Promise<string>,
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
      chatThreads: () => invoke(CHANNELS.contentChatThreads) as Promise<ChatThread[]>,
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
      saveHistory: (entries) => invoke(CHANNELS.contentReplace, "history", entries) as Promise<void>,
      saveNotes: (notes) => invoke(CHANNELS.contentReplace, "notes", notes) as Promise<void>,
      saveFolders: (folders) => invoke(CHANNELS.contentReplace, "folders", folders) as Promise<void>,
      saveDictionary: (entries) => invoke(CHANNELS.contentReplace, "dictionary", entries) as Promise<void>,
      saveSnippets: (snippets) => invoke(CHANNELS.contentReplace, "snippets", snippets) as Promise<void>,
      saveTransforms: (transforms) => invoke(CHANNELS.contentReplace, "transforms", transforms) as Promise<void>,
      saveIntegrations: (integrations) =>
        invoke(CHANNELS.contentReplace, "integrations", integrations) as Promise<void>,
      saveChat: (messages) => invoke(CHANNELS.contentReplace, "chat", messages) as Promise<void>,
      saveChatThreads: (threads) =>
        invoke(CHANNELS.contentReplace, "chatThreads", threads) as Promise<void>,
      saveUploads: (jobs) => invoke(CHANNELS.contentReplace, "uploads", jobs) as Promise<void>,
      onChanged: (callback) => subscribeContentChanged?.(callback) ?? (() => {}),
    },
    models: {
      status: () => invoke(CHANNELS.modelsStatus) as Promise<ModelStatus[]>,
      compatibility: () => invoke(CHANNELS.modelsCompatibility) as Promise<ModelCompatibilityReport>,
      readiness: () => invoke(CHANNELS.modelsReadiness) as Promise<ModelReadiness[]>,
      active: () => invoke(CHANNELS.modelsActive) as Promise<ActiveModelReport>,
      prepare: (id) => invoke(CHANNELS.modelsPrepare, id) as Promise<void>,
      download: (id) => invoke(CHANNELS.modelsDownload, id) as Promise<void>,
      cancel: (id) => invoke(CHANNELS.modelsCancel, id) as Promise<void>,
      verify: (id) => invoke(CHANNELS.modelsVerify, id) as Promise<{ ok: boolean }>,
      remove: (id) => invoke(CHANNELS.modelsRemove, id) as Promise<{ freedBytes: number }>,
      storage: () => invoke(CHANNELS.modelsStorage) as Promise<ModelStorageReport>,
      onProgress: (callback) => subscribeModelProgress?.(callback) ?? (() => {}),
      onRuntime: (callback) => subscribeModelRuntime?.(callback) ?? (() => {}),
    },
    capture: {
      start: () => invoke(CHANNELS.captureStart) as Promise<string>,
      stop: (id) => invoke(CHANNELS.captureStop, id) as Promise<{ text: string }>,
      pushChunk: (id, base64Pcm16) => captureBridge?.pushChunk(id, base64Pcm16),
      onTranscript: (callback) => captureBridge?.onTranscript(callback) ?? (() => {}),
    },
    acceleration: {
      profile: () => invoke(CHANNELS.accelerationProfile) as Promise<GpuProfile>,
      rescan: () => invoke(CHANNELS.accelerationRescan) as Promise<GpuProfile>,
      plan: () => invoke(CHANNELS.accelerationPlan) as Promise<AccelerationPlan>,
      state: () => invoke(CHANNELS.accelerationState) as Promise<AccelerationState>,
      setMode: (mode) => invoke(CHANNELS.accelerationSetMode, mode) as Promise<void>,
      enable: (engine, backend) =>
        invoke(CHANNELS.accelerationEnable, ...(backend ? [engine, backend] : [engine])) as Promise<void>,
      disable: (engine) => invoke(CHANNELS.accelerationDisable, engine) as Promise<void>,
      retry: (engine, backend) => invoke(CHANNELS.accelerationRetry, engine, backend) as Promise<void>,
      runTest: (opts) => invoke(CHANNELS.accelerationRunTest, ...(opts ? [opts] : [])) as Promise<AccelerationTestReport>,
      removeGpuBackends: (engine) => invoke(CHANNELS.accelerationRemoveGpu, engine) as Promise<void>,
      reset: () => invoke(CHANNELS.accelerationReset) as Promise<void>,
      onProgress: (callback) => subscribeAccelerationProgress?.(callback) ?? (() => {}),
      onState: (callback) => subscribeAccelerationState?.(callback) ?? (() => {}),
    },
  };
}
