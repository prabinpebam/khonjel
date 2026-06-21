/**
 * Runtime zod schemas for IPC payload validation. Imported by the main-process dispatch layer
 * and by contract tests — NOT by the renderer adapter, so zod stays out of the renderer bundle.
 *
 * Keep these in lockstep with `ipc-contract.ts`: every `Channel` must have a request (argument
 * tuple) schema and a response schema. The contract test enforces completeness.
 */
import { z } from "zod";
import { CHANNELS, type Channel } from "./ipc-contract";

const PlatformSchema = z.enum(["win32", "darwin", "linux", "web"]);

const InjectionOutcomeSchema = z.object({
  strategy: z.enum(["paste", "type", "clipboard"]),
  app: z.string().optional(),
});

const ProfileSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().optional(),
  avatarUrl: z.string().optional(),
});

const SettingsSnapshotSchema = z.object({
  toggles: z.record(z.string(), z.boolean()),
  values: z.record(z.string(), z.string()),
});

const SettingsPatchSchema = z.object({
  toggles: z.record(z.string(), z.boolean()).optional(),
  values: z.record(z.string(), z.string()).optional(),
});

const DictionaryEntrySchema = z
  .object({
    type: z.enum(["term", "substitution"]),
    term: z.string().optional(),
    trigger: z.string().optional(),
    replacement: z.string().optional(),
  })
  .passthrough();

const SnippetSchema = z.object({ trigger: z.string(), expansion: z.string() }).passthrough();

const CleanupOptionsSchema = z.object({
  cleanupEnabled: z.boolean().optional(),
  agentName: z.string().optional(),
  dictionary: z.array(DictionaryEntrySchema).optional(),
  snippets: z.array(SnippetSchema).optional(),
});

const CleanupResultSchema = z.object({
  text: z.string(),
  cleaned: z.boolean(),
  mode: z.enum(["dictation", "agent"]),
});

const ChatTurnSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

const ChatReplySchema = z.object({ text: z.string() });

const TranscriptionRequestSchema = z.object({
  audioBase64: z.string(),
  language: z.string().optional(),
  translate: z.boolean().optional(),
});

const TranscriptionResultSchema = z.object({ text: z.string() });

const ConnectionProfileSchema = z.object({
  id: z.string(),
  kind: z.enum([
    "openai",
    "openai-compatible",
    "azure-openai",
    "anthropic",
    "gemini",
    "groq",
    "deepgram",
    "xai",
    "bedrock",
    "vertex",
  ]),
  baseEndpoint: z.string(),
  apiVersion: z.string().optional(),
  authMode: z.enum(["api-key-header", "bearer-token", "aad"]),
  headerName: z.string().optional(),
  model: z.string().optional(),
});

const ConnectionListSchema = z.array(ConnectionProfileSchema);

const ConnectionTestResultSchema = z.object({ ok: z.boolean(), message: z.string().optional() });

const HistoryEntrySchema = z
  .object({
    id: z.string(),
    createdAt: z.string(),
    finalText: z.string(),
    wordCount: z.number(),
    durationSec: z.number(),
  })
  .passthrough();

const InsightsAggregateSchema = z
  .object({
    wpm: z.number(),
    wpmPercentile: z.number(),
    wordsCorrected: z.number(),
    dictionaryFixes: z.number(),
    totalWords: z.number(),
    appUsage: z.array(
      z.object({ category: z.string(), count: z.number(), pct: z.number() }).passthrough(),
    ),
    streak: z.object({ current: z.number(), longest: z.number() }),
    heatmap: z.array(z.object({ date: z.string(), count: z.number() })),
  })
  .passthrough();

const ChatMessageSchema = z
  .object({
    id: z.string(),
    role: z.enum(["user", "assistant"]),
    content: z.string(),
    createdAt: z.string(),
  })
  .passthrough();

const FolderSchema = z.object({ id: z.string(), name: z.string(), count: z.number() }).passthrough();

const NoteSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    preview: z.string(),
    body: z.string(),
    folderId: z.string(),
    updatedAt: z.string(),
    fromRecording: z.boolean(),
  })
  .passthrough();

const UploadJobSchema = z
  .object({
    id: z.string(),
    filename: z.string(),
    durationSec: z.number(),
    format: z.string(),
    state: z.enum(["queued", "transcribing", "done", "error"]),
    progress: z.number(),
  })
  .passthrough();

const TransformSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    hotkey: z.string(),
    builtin: z.boolean(),
    enabled: z.boolean(),
    prompt: z.string().default(""),
  })
  .passthrough();

const IntegrationSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    icon: z.enum(["calendar", "code", "blocks", "terminal"]),
    status: z.enum(["connected", "disconnected"]),
    detail: z.string().optional(),
  })
  .passthrough();

const ModelInfoSchema = z
  .object({ id: z.string(), name: z.string(), sizeLabel: z.string(), recommended: z.boolean() })
  .passthrough();

const HistoryDraftSchema = z.object({
  finalText: z.string(),
  app: z.string(),
  language: z.string(),
  durationSec: z.number(),
  mode: z.enum(["dictation", "note-recording", "upload"]),
  hasAudio: z.boolean(),
  cleanupApplied: z.boolean(),
});

const ContentCollectionSchema = z.enum([
  "history",
  "chat",
  "folders",
  "notes",
  "uploads",
  "dictionary",
  "snippets",
  "transforms",
  "integrations",
]);

/** Request argument tuples (Phase 0 channels take no arguments; settings:patch takes a patch). */
export const RequestSchemas: Record<Channel, z.ZodTypeAny> = {
  [CHANNELS.profileGet]: z.tuple([]),
  [CHANNELS.systemGetAppVersion]: z.tuple([]),
  [CHANNELS.systemGetPlatform]: z.tuple([]),
  [CHANNELS.systemInjectText]: z.tuple([z.string()]),
  [CHANNELS.systemCaptureSelection]: z.tuple([]),
  [CHANNELS.settingsGet]: z.tuple([]),
  [CHANNELS.settingsPatch]: z.tuple([SettingsPatchSchema]),
  [CHANNELS.inferenceCleanup]: z.tuple([z.string(), CleanupOptionsSchema]),
  [CHANNELS.inferenceChat]: z.tuple([z.array(ChatTurnSchema)]),
  [CHANNELS.transcriptionTranscribe]: z.tuple([TranscriptionRequestSchema]),
  [CHANNELS.connectionsList]: z.tuple([]),
  [CHANNELS.connectionsUpsert]: z.tuple([ConnectionProfileSchema]),
  [CHANNELS.connectionsRemove]: z.tuple([z.string()]),
  [CHANNELS.connectionsTest]: z.tuple([z.string(), z.string(), z.enum(["chat", "transcription"])]),
  [CHANNELS.secretsSet]: z.tuple([z.string(), z.string()]),
  [CHANNELS.secretsHas]: z.tuple([z.string()]),
  [CHANNELS.secretsRemove]: z.tuple([z.string()]),
  [CHANNELS.contentHistory]: z.tuple([]),
  [CHANNELS.contentInsights]: z.tuple([]),
  [CHANNELS.contentChat]: z.tuple([]),
  [CHANNELS.contentFolders]: z.tuple([]),
  [CHANNELS.contentNotes]: z.tuple([]),
  [CHANNELS.contentUploads]: z.tuple([]),
  [CHANNELS.contentDictionary]: z.tuple([]),
  [CHANNELS.contentSnippets]: z.tuple([]),
  [CHANNELS.contentTransforms]: z.tuple([]),
  [CHANNELS.contentIntegrations]: z.tuple([]),
  [CHANNELS.contentSttModels]: z.tuple([]),
  [CHANNELS.contentLlmModels]: z.tuple([]),
  [CHANNELS.contentAddHistory]: z.tuple([HistoryDraftSchema]),
  [CHANNELS.contentReplace]: z.tuple([ContentCollectionSchema, z.array(z.unknown())]),
};

/** Response payload schemas. */
export const ResponseSchemas: Record<Channel, z.ZodTypeAny> = {
  [CHANNELS.profileGet]: ProfileSchema,
  [CHANNELS.systemGetAppVersion]: z.string(),
  [CHANNELS.systemGetPlatform]: PlatformSchema,
  [CHANNELS.systemInjectText]: InjectionOutcomeSchema,
  [CHANNELS.systemCaptureSelection]: z.string(),
  [CHANNELS.settingsGet]: SettingsSnapshotSchema,
  [CHANNELS.settingsPatch]: SettingsSnapshotSchema,
  [CHANNELS.inferenceCleanup]: CleanupResultSchema,
  [CHANNELS.inferenceChat]: ChatReplySchema,
  [CHANNELS.transcriptionTranscribe]: TranscriptionResultSchema,
  [CHANNELS.connectionsList]: ConnectionListSchema,
  [CHANNELS.connectionsUpsert]: ConnectionListSchema,
  [CHANNELS.connectionsRemove]: ConnectionListSchema,
  [CHANNELS.connectionsTest]: ConnectionTestResultSchema,
  [CHANNELS.secretsSet]: z.void(),
  [CHANNELS.secretsHas]: z.boolean(),
  [CHANNELS.secretsRemove]: z.void(),
  [CHANNELS.contentHistory]: z.array(HistoryEntrySchema),
  [CHANNELS.contentInsights]: InsightsAggregateSchema,
  [CHANNELS.contentChat]: z.array(ChatMessageSchema),
  [CHANNELS.contentFolders]: z.array(FolderSchema),
  [CHANNELS.contentNotes]: z.array(NoteSchema),
  [CHANNELS.contentUploads]: z.array(UploadJobSchema),
  [CHANNELS.contentDictionary]: z.array(DictionaryEntrySchema),
  [CHANNELS.contentSnippets]: z.array(SnippetSchema),
  [CHANNELS.contentTransforms]: z.array(TransformSchema),
  [CHANNELS.contentIntegrations]: z.array(IntegrationSchema),
  [CHANNELS.contentSttModels]: z.array(ModelInfoSchema),
  [CHANNELS.contentLlmModels]: z.array(ModelInfoSchema),
  [CHANNELS.contentAddHistory]: z.array(HistoryEntrySchema),
  [CHANNELS.contentReplace]: z.void(),
};
