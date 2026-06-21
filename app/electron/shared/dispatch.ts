/**
 * The pure IPC dispatch layer: maps a channel + args to a handler, validating the request
 * payload with zod and returning the typed result. It throws a structured `IpcError` (never a
 * raw Error) so the electron binding and the renderer adapter can render it consistently.
 *
 * PURE + dependency-injected: handlers receive their collaborators (`DispatchDeps`) so this
 * file never imports better-sqlite3, the keychain, or electron. The composition root
 * (electron main) constructs the real deps; tests pass fakes. This is what makes the whole
 * seam unit-testable without launching Electron (BE1/BE2/BE3).
 */
import { CHANNELS, type Channel, ipcError } from "./ipc-contract";
import { RequestSchemas } from "./ipc-schemas";
import type {
  ChatMessage,
  ChatTurn,
  CleanupOptions,
  CleanupResult,
  ConnectionProfile,
  DictionaryEntry,
  Folder,
  HistoryDraft,
  HistoryEntry,
  InjectionOutcome,
  InsightsAggregate,
  Integration,
  ModelInfo,
  Note,
  Platform,
  Profile,
  SettingsPatch,
  SettingsSnapshot,
  Snippet,
  Transform,
  TranscriptionRequest,
  TranscriptionResult,
  UploadJob,
} from "../../src/services/ports";

export interface DispatchDeps {
  profile: { get: () => Profile | Promise<Profile> };
  system: {
    getAppVersion: () => string | Promise<string>;
    getPlatform: () => Platform | Promise<Platform>;
    injectText: (text: string) => InjectionOutcome | Promise<InjectionOutcome>;
  };
  settings: {
    get: () => SettingsSnapshot | Promise<SettingsSnapshot>;
    patch: (patch: SettingsPatch) => SettingsSnapshot | Promise<SettingsSnapshot>;
  };
  inference: {
    cleanup: (input: string, options: CleanupOptions) => CleanupResult | Promise<CleanupResult>;
    chat: (messages: ChatTurn[]) => { text: string } | Promise<{ text: string }>;
  };
  transcription: {
    transcribe: (req: TranscriptionRequest) => TranscriptionResult | Promise<TranscriptionResult>;
  };
  connections: {
    list: () => ConnectionProfile[] | Promise<ConnectionProfile[]>;
    upsert: (profile: ConnectionProfile) => ConnectionProfile[] | Promise<ConnectionProfile[]>;
    remove: (id: string) => ConnectionProfile[] | Promise<ConnectionProfile[]>;
  };
  content: {
    history: () => HistoryEntry[] | Promise<HistoryEntry[]>;
    insights: () => InsightsAggregate | Promise<InsightsAggregate>;
    chat: () => ChatMessage[] | Promise<ChatMessage[]>;
    folders: () => Folder[] | Promise<Folder[]>;
    notes: () => Note[] | Promise<Note[]>;
    uploads: () => UploadJob[] | Promise<UploadJob[]>;
    dictionary: () => DictionaryEntry[] | Promise<DictionaryEntry[]>;
    snippets: () => Snippet[] | Promise<Snippet[]>;
    transforms: () => Transform[] | Promise<Transform[]>;
    integrations: () => Integration[] | Promise<Integration[]>;
    sttModels: () => ModelInfo[] | Promise<ModelInfo[]>;
    llmModels: () => ModelInfo[] | Promise<ModelInfo[]>;
    addHistory: (draft: HistoryDraft) => HistoryEntry[] | Promise<HistoryEntry[]>;
  };
  // Grows one slice per phase (meetings, transcription, agent, ...).
}

export type Dispatch = (channel: string, ...args: unknown[]) => Promise<unknown>;

export function createDispatch(deps: DispatchDeps): Dispatch {
  const handlers: Record<Channel, (args: unknown[]) => unknown> = {
    [CHANNELS.profileGet]: () => deps.profile.get(),
    [CHANNELS.systemGetAppVersion]: () => deps.system.getAppVersion(),
    [CHANNELS.systemGetPlatform]: () => deps.system.getPlatform(),
    [CHANNELS.systemInjectText]: (args) => deps.system.injectText(args[0] as string),
    [CHANNELS.settingsGet]: () => deps.settings.get(),
    [CHANNELS.settingsPatch]: (args) => deps.settings.patch(args[0] as SettingsPatch),
    [CHANNELS.inferenceCleanup]: (args) => deps.inference.cleanup(args[0] as string, args[1] as CleanupOptions),
    [CHANNELS.inferenceChat]: (args) => deps.inference.chat(args[0] as ChatTurn[]),
    [CHANNELS.transcriptionTranscribe]: (args) =>
      deps.transcription.transcribe(args[0] as TranscriptionRequest),
    [CHANNELS.connectionsList]: () => deps.connections.list(),
    [CHANNELS.connectionsUpsert]: (args) => deps.connections.upsert(args[0] as ConnectionProfile),
    [CHANNELS.connectionsRemove]: (args) => deps.connections.remove(args[0] as string),
    [CHANNELS.contentHistory]: () => deps.content.history(),
    [CHANNELS.contentInsights]: () => deps.content.insights(),
    [CHANNELS.contentChat]: () => deps.content.chat(),
    [CHANNELS.contentFolders]: () => deps.content.folders(),
    [CHANNELS.contentNotes]: () => deps.content.notes(),
    [CHANNELS.contentUploads]: () => deps.content.uploads(),
    [CHANNELS.contentDictionary]: () => deps.content.dictionary(),
    [CHANNELS.contentSnippets]: () => deps.content.snippets(),
    [CHANNELS.contentTransforms]: () => deps.content.transforms(),
    [CHANNELS.contentIntegrations]: () => deps.content.integrations(),
    [CHANNELS.contentSttModels]: () => deps.content.sttModels(),
    [CHANNELS.contentLlmModels]: () => deps.content.llmModels(),
    [CHANNELS.contentAddHistory]: (args) => deps.content.addHistory(args[0] as HistoryDraft),
  };

  return async function dispatch(channel: string, ...args: unknown[]): Promise<unknown> {
    const handler = handlers[channel as Channel];
    if (!handler) {
      throw ipcError("not_found", `Unknown IPC channel: ${channel}`);
    }
    const schema = RequestSchemas[channel as Channel];
    const parsed = schema.safeParse(args);
    if (!parsed.success) {
      throw ipcError("validation", `Invalid payload for ${channel}`, parsed.error.issues);
    }
    return handler(args);
  };
}
