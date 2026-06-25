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

const ChatThreadSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
    titleStatus: z.enum(["pending", "auto", "manual"]),
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

const ModelErrorSchema = z.object({
  code: z.enum([
    "offline",
    "source-unavailable",
    "disk-full",
    "checksum-mismatch",
    "corrupt",
    "permission",
    "internal",
  ]),
  message: z.string(),
});

const ModelStatusSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    sizeLabel: z.string(),
    recommended: z.boolean(),
    kind: z.enum(["stt", "llm"]),
    state: z.enum([
      "not-installed",
      "queued",
      "downloading",
      "paused",
      "verifying",
      "installed",
      "error",
      "removing",
    ]),
    bytesDone: z.number().optional(),
    bytesTotal: z.number().optional(),
    engineReady: z.boolean(),
    error: ModelErrorSchema.optional(),
    installedBytes: z.number().optional(),
    verifiedAt: z.string().optional(),
    inUse: z.boolean().optional(),
  })
  .passthrough();

const ModelStorageReportSchema = z.object({
  cachePath: z.string(),
  usedBytes: z.number(),
  freeBytes: z.number(),
});

const HardwareGpuSchema = z.object({
  name: z.string(),
  vendor: z.enum(["nvidia", "amd", "intel", "apple", "unknown"]),
  vramBytes: z.number().optional(),
  driverVersion: z.string().optional(),
});

const HardwareProfileSchema = z.object({
  os: z.enum(["win32", "darwin", "linux"]),
  arch: z.string(),
  cpuName: z.string().optional(),
  physicalCores: z.number().optional(),
  logicalCores: z.number().optional(),
  totalRamBytes: z.number().optional(),
  availableRamBytes: z.number().optional(),
  freeDiskBytes: z.number().optional(),
  gpus: z.array(HardwareGpuSchema),
  power: z.enum(["plugged", "battery", "unknown"]),
  detectionWarnings: z.array(z.string()),
});

const RuntimeStatusSchema = z.object({
  engine: z.enum(["whisper", "llama", "parakeet"]),
  state: z.enum(["ready", "missing", "downloadable", "unsupported", "failed"]),
  message: z.string(),
  path: z.string().optional(),
  version: z.string().optional(),
  reason: z.string().optional(),
  action: z.enum(["download-runtime", "choose-another", "open-folder", "retry"]).optional(),
});

const CompatibilityReasonSchema = z.object({
  code: z.enum([
    "enough-memory",
    "low-memory",
    "not-enough-memory",
    "enough-disk",
    "not-enough-disk",
    "gpu-available",
    "cpu-only",
    "runtime-ready",
    "runtime-missing",
    "runtime-unsupported",
    "hardware-unknown",
  ]),
  message: z.string(),
  action: z.string().optional(),
});

const ModelCompatibilitySchema = z.object({
  modelId: z.string(),
  kind: z.enum(["stt", "llm"]),
  level: z.enum(["recommended", "works", "limited", "unsupported", "unknown"]),
  summary: z.string(),
  reasons: z.array(CompatibilityReasonSchema),
  estimated: z.object({
    speed: z.enum(["fast", "good", "slow", "unknown"]),
    firstLoad: z.enum(["short", "medium", "long", "unknown"]),
  }),
});

const ModelCompatibilityReportSchema = z.object({
  hardware: HardwareProfileSchema,
  runtimes: z.array(RuntimeStatusSchema),
  summary: z.object({
    level: z.enum(["great", "good", "limited", "not-ready", "unknown"]),
    title: z.string(),
    message: z.string(),
  }),
  recommended: z.object({ stt: z.string().optional(), llm: z.string().optional() }),
  models: z.array(ModelCompatibilitySchema),
});

const ModelReadinessSchema = z.object({
  modelId: z.string(),
  kind: z.enum(["stt", "llm"]),
  state: z.enum([
    "not-installed",
    "downloading",
    "verifying",
    "installed",
    "runtime-missing",
    "starting",
    "ready",
    "failed",
    "unsupported",
  ]),
  active: z.boolean(),
  selected: z.boolean(),
  previousActiveModelId: z.string().optional(),
  reason: z.string().optional(),
  nextAction: z.enum(["download", "install-runtime", "retry", "choose-another", "manage-storage"]).optional(),
});

const ActiveModelSlotSchema = z.object({
  selectedModelId: z.string().optional(),
  activeModelId: z.string().optional(),
  state: z.enum(["none", "starting", "ready", "fallback", "failed"]),
  message: z.string(),
});

const ActiveModelReportSchema = z.object({
  speech: ActiveModelSlotSchema.optional(),
  language: ActiveModelSlotSchema.optional(),
});

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
  "chatThreads",
  "folders",
  "notes",
  "uploads",
  "dictionary",
  "snippets",
  "transforms",
  "integrations",
]);

// ---- GPU acceleration (bounded; audit F3) ----
const GpuVendorSchema = z.enum(["nvidia", "amd", "intel", "apple", "unknown"]);
const BackendSchema = z.enum(["cuda-13.3", "cuda-12.4", "vulkan", "metal", "hip", "sycl", "cpu"]);

const GpuDeviceSchema = z.object({
  index: z.number().int().min(0).max(64),
  name: z.string().max(200),
  vendor: GpuVendorSchema,
  vendorId: z.string().max(8).optional(),
  vramBytes: z.number().nonnegative().optional(),
  unifiedMemory: z.boolean().optional(),
  driverVersion: z.string().max(64).optional(),
  computeCapability: z.string().max(16).optional(),
  maxCudaVersion: z.string().max(16).optional(),
  isIntegrated: z.boolean().optional(),
  source: z.array(z.enum(["os", "nvidia-smi", "registry", "system_profiler", "lspci"])).max(8),
});

const GpuProfileSchema = z.object({
  os: z.enum(["win32", "darwin", "linux"]),
  arch: z.string().max(32),
  devices: z.array(GpuDeviceSchema).max(16),
  primary: GpuDeviceSchema.optional(),
  detectedAt: z.string().max(40),
  warnings: z.array(z.string().max(300)).max(16),
});

const BackendCandidateSchema = z.object({
  backend: BackendSchema,
  reason: z.string().max(300),
  confidence: z.enum(["high", "medium", "low"]),
  minDriver: z.string().max(64).optional(),
  requires: z.array(z.string().max(64)).max(8).optional(),
});

const AccelerationPlanSchema = z.object({
  llm: z.array(BackendCandidateSchema).max(8),
  stt: z.array(BackendCandidateSchema).max(8),
  recommendedLevel: z.enum(["gpu-great", "gpu-ok", "cpu-only", "unknown"]),
  summary: z.string().max(300),
  estimatedSpeedup: z.string().max(32).optional(),
  downloadBytes: z.number().nonnegative().optional(),
  diskBytes: z.number().nonnegative().optional(),
  requiresDownload: z.boolean(),
});

const AccelerationModeSchema = z.enum(["auto", "on", "off"]);
const AccelerationEngineSchema = z.enum(["llama", "whisper"]);
const DeviceSchema = z.enum(["gpu", "cpu"]);
const BackendStateSchema = z.enum([
  "none", "planning", "downloading", "verifying", "installing", "probing", "active", "deferred", "quarantined", "failed",
]);

const RuntimeMetricsSchema = z.object({
  device: DeviceSchema,
  backend: BackendSchema.optional(),
  tokensPerSec: z.number().optional(),
  offloadedLayers: z.number().optional(),
  vramUsedBytes: z.number().optional(),
  firstTokenMs: z.number().optional(),
  realtimeFactor: z.number().optional(),
});

const EngineAccelerationSchema = z.object({
  engine: AccelerationEngineSchema,
  device: DeviceSchema,
  activeBackend: BackendSchema.optional(),
  state: BackendStateSchema,
  message: z.string().max(300),
  metrics: RuntimeMetricsSchema.optional(),
  lastError: z.object({ code: z.string().max(64), message: z.string().max(300) }).optional(),
});

const AccelerationStateSchema = z.object({
  mode: AccelerationModeSchema,
  llm: EngineAccelerationSchema,
  stt: EngineAccelerationSchema,
  gpuActive: z.boolean(),
  online: z.boolean(),
  autoSetup: z
    .object({ active: z.boolean(), message: z.string().max(300), bytesDone: z.number().optional(), bytesTotal: z.number().optional() })
    .optional(),
  notice: z.object({ kind: z.enum(["enabled", "rolled-back", "updated"]), message: z.string().max(300) }).optional(),
  summary: z.string().max(300),
});

const AccelerationTestLegSchema = z.object({ ok: z.boolean(), message: z.string().max(300), metrics: RuntimeMetricsSchema.optional() });
const AccelerationTestReportSchema = z.object({
  ok: z.boolean(),
  gpu: RuntimeMetricsSchema.optional(),
  cpu: RuntimeMetricsSchema.optional(),
  speedup: z.number().optional(),
  llm: AccelerationTestLegSchema,
  stt: AccelerationTestLegSchema,
  summary: z.string().max(300),
});
const RunTestOptsSchema = z.object({ tokens: z.number().optional(), warmup: z.boolean().optional() });

/** Request argument tuples (Phase 0 channels take no arguments; settings:patch takes a patch). */
export const RequestSchemas: Record<Channel, z.ZodTypeAny> = {
  [CHANNELS.systemGetAppVersion]: z.tuple([]),
  [CHANNELS.systemGetPlatform]: z.tuple([]),
  [CHANNELS.systemGetAccountName]: z.tuple([]),
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
  [CHANNELS.contentChatThreads]: z.tuple([]),
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
  [CHANNELS.modelsStatus]: z.tuple([]),
  [CHANNELS.modelsCompatibility]: z.tuple([]),
  [CHANNELS.modelsReadiness]: z.tuple([]),
  [CHANNELS.modelsActive]: z.tuple([]),
  [CHANNELS.modelsPrepare]: z.tuple([z.string()]),
  [CHANNELS.modelsDownload]: z.tuple([z.string()]),
  [CHANNELS.modelsCancel]: z.tuple([z.string()]),
  [CHANNELS.modelsVerify]: z.tuple([z.string()]),
  [CHANNELS.modelsRemove]: z.tuple([z.string()]),
  [CHANNELS.modelsStorage]: z.tuple([]),
  [CHANNELS.captureStart]: z.tuple([]),
  [CHANNELS.captureStop]: z.tuple([z.string()]),
  [CHANNELS.accelerationProfile]: z.tuple([]),
  [CHANNELS.accelerationRescan]: z.tuple([]),
  [CHANNELS.accelerationPlan]: z.tuple([]),
  [CHANNELS.accelerationState]: z.tuple([]),
  [CHANNELS.accelerationSetMode]: z.tuple([AccelerationModeSchema]),
  [CHANNELS.accelerationEnable]: z.union([z.tuple([AccelerationEngineSchema, BackendSchema]), z.tuple([AccelerationEngineSchema])]),
  [CHANNELS.accelerationDisable]: z.tuple([AccelerationEngineSchema]),
  [CHANNELS.accelerationRetry]: z.tuple([AccelerationEngineSchema, BackendSchema]),
  [CHANNELS.accelerationRunTest]: z.union([z.tuple([RunTestOptsSchema]), z.tuple([])]),
  [CHANNELS.accelerationRemoveGpu]: z.tuple([AccelerationEngineSchema]),
  [CHANNELS.accelerationReset]: z.tuple([]),
};

/** Response payload schemas. */
export const ResponseSchemas: Record<Channel, z.ZodTypeAny> = {
  [CHANNELS.systemGetAppVersion]: z.string(),
  [CHANNELS.systemGetPlatform]: PlatformSchema,
  [CHANNELS.systemGetAccountName]: z.string(),
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
  [CHANNELS.contentChatThreads]: z.array(ChatThreadSchema),
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
  [CHANNELS.modelsStatus]: z.array(ModelStatusSchema),
  [CHANNELS.modelsCompatibility]: ModelCompatibilityReportSchema,
  [CHANNELS.modelsReadiness]: z.array(ModelReadinessSchema),
  [CHANNELS.modelsActive]: ActiveModelReportSchema,
  [CHANNELS.modelsPrepare]: z.void(),
  [CHANNELS.modelsDownload]: z.void(),
  [CHANNELS.modelsCancel]: z.void(),
  [CHANNELS.modelsVerify]: z.object({ ok: z.boolean() }),
  [CHANNELS.modelsRemove]: z.object({ freedBytes: z.number() }),
  [CHANNELS.modelsStorage]: ModelStorageReportSchema,
  [CHANNELS.captureStart]: z.string(),
  [CHANNELS.captureStop]: z.object({ text: z.string() }),
  [CHANNELS.accelerationProfile]: GpuProfileSchema,
  [CHANNELS.accelerationRescan]: GpuProfileSchema,
  [CHANNELS.accelerationPlan]: AccelerationPlanSchema,
  [CHANNELS.accelerationState]: AccelerationStateSchema,
  [CHANNELS.accelerationSetMode]: z.void(),
  [CHANNELS.accelerationEnable]: z.void(),
  [CHANNELS.accelerationDisable]: z.void(),
  [CHANNELS.accelerationRetry]: z.void(),
  [CHANNELS.accelerationRunTest]: AccelerationTestReportSchema,
  [CHANNELS.accelerationRemoveGpu]: z.void(),
  [CHANNELS.accelerationReset]: z.void(),
};
