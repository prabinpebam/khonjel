/**
 * The typed IPC contract — the single source of truth for channel names, payload/response
 * TYPES, the contract version, and the structured error model. Imported by the renderer `ipc`
 * adapter, the main-process dispatch/handlers, and the preload allow-list.
 *
 * This file is PURE (no electron, node, zod, or DOM imports) so it is safe to bundle into the
 * renderer and to import from tests. Runtime validation schemas live next to it in
 * `ipc-schemas.ts` (main + tests only, keeping zod out of the renderer bundle).
 *
 * See docs/product-spec/04-architecture-and-delivery/backend/08-ipc-and-ports-contracts.md.
 */
import type {
  ChatMessage,
  ChatTurn,
  CleanupOptions,
  CleanupResult,
  ConnectionProfile,
  ConnectionTestResult,
  DictionaryEntry,
  Folder,
  HistoryDraft,
  HistoryEntry,
  InjectionOutcome,
  InsightsAggregate,
  Integration,
  ModelInfo,
  ModelCompatibilityReport,
  ModelReadiness,
  ActiveModelReport,
  ModelStatus,
  ModelStorageReport,
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

/** Bumped only on breaking channel changes; preload sends it, main rejects mismatches. */
export const CONTRACT_VERSION = 1;

/** Request/response channels (invoke). One namespace per port. Phase 0 = the seam proof. */
export const CHANNELS = {
  profileGet: "profile:get",
  systemGetAppVersion: "system:getAppVersion",
  systemGetPlatform: "system:getPlatform",
  systemInjectText: "system:injectText",
  systemCaptureSelection: "system:captureSelection",
  settingsGet: "settings:get",
  settingsPatch: "settings:patch",
  inferenceCleanup: "inference:cleanup",
  inferenceChat: "inference:chat",
  transcriptionTranscribe: "transcription:transcribe",
  connectionsList: "connections:list",
  connectionsUpsert: "connections:upsert",
  connectionsRemove: "connections:remove",
  connectionsTest: "connections:test",
  secretsSet: "secrets:set",
  secretsHas: "secrets:has",
  secretsRemove: "secrets:remove",
  contentHistory: "content:history",
  contentInsights: "content:insights",
  contentChat: "content:chat",
  contentFolders: "content:folders",
  contentNotes: "content:notes",
  contentUploads: "content:uploads",
  contentDictionary: "content:dictionary",
  contentSnippets: "content:snippets",
  contentTransforms: "content:transforms",
  contentIntegrations: "content:integrations",
  contentSttModels: "content:sttModels",
  contentLlmModels: "content:llmModels",
  contentAddHistory: "content:addHistory",
  contentReplace: "content:replace",
  modelsStatus: "models:status",
  modelsCompatibility: "models:compatibility",
  modelsReadiness: "models:readiness",
  modelsActive: "models:active",
  modelsPrepare: "models:prepare",
  modelsDownload: "models:download",
  modelsCancel: "models:cancel",
  modelsVerify: "models:verify",
  modelsRemove: "models:remove",
  modelsStorage: "models:storage",
  captureStart: "capture:start",
  captureStop: "capture:stop",
} as const;

export type Channel = (typeof CHANNELS)[keyof typeof CHANNELS];

/** Per-channel request argument tuples and response types. */
export interface ChannelContract {
  "profile:get": { request: []; response: Profile };
  "system:getAppVersion": { request: []; response: string };
  "system:getPlatform": { request: []; response: Platform };
  "system:injectText": { request: [string]; response: InjectionOutcome };
  "system:captureSelection": { request: []; response: string };
  "settings:get": { request: []; response: SettingsSnapshot };
  "settings:patch": { request: [SettingsPatch]; response: SettingsSnapshot };
  "inference:cleanup": { request: [string, CleanupOptions]; response: CleanupResult };
  "inference:chat": { request: [ChatTurn[]]; response: { text: string } };
  "transcription:transcribe": { request: [TranscriptionRequest]; response: TranscriptionResult };
  "connections:list": { request: []; response: ConnectionProfile[] };
  "connections:upsert": { request: [ConnectionProfile]; response: ConnectionProfile[] };
  "connections:remove": { request: [string]; response: ConnectionProfile[] };
  "connections:test": { request: [string, string, "chat" | "transcription"]; response: ConnectionTestResult };
  "secrets:set": { request: [string, string]; response: void };
  "secrets:has": { request: [string]; response: boolean };
  "secrets:remove": { request: [string]; response: void };
  "content:history": { request: []; response: HistoryEntry[] };
  "content:insights": { request: []; response: InsightsAggregate };
  "content:chat": { request: []; response: ChatMessage[] };
  "content:folders": { request: []; response: Folder[] };
  "content:notes": { request: []; response: Note[] };
  "content:uploads": { request: []; response: UploadJob[] };
  "content:dictionary": { request: []; response: DictionaryEntry[] };
  "content:snippets": { request: []; response: Snippet[] };
  "content:transforms": { request: []; response: Transform[] };
  "content:integrations": { request: []; response: Integration[] };
  "content:sttModels": { request: []; response: ModelInfo[] };
  "content:llmModels": { request: []; response: ModelInfo[] };
  "content:addHistory": { request: [HistoryDraft]; response: HistoryEntry[] };
  "content:replace": { request: [string, unknown[]]; response: void };
  "models:status": { request: []; response: ModelStatus[] };
  "models:compatibility": { request: []; response: ModelCompatibilityReport };
  "models:readiness": { request: []; response: ModelReadiness[] };
  "models:active": { request: []; response: ActiveModelReport };
  "models:prepare": { request: [string]; response: void };
  "models:download": { request: [string]; response: void };
  "models:cancel": { request: [string]; response: void };
  "models:verify": { request: [string]; response: { ok: boolean } };
  "models:remove": { request: [string]; response: { freedBytes: number } };
  "models:storage": { request: []; response: ModelStorageReport };
  "capture:start": { request: []; response: string };
  "capture:stop": { request: [string]; response: { text: string } };
}

export type RequestOf<C extends Channel> = ChannelContract[C]["request"];
export type ResponseOf<C extends Channel> = ChannelContract[C]["response"];

/** Structured error model carried across IPC (handlers never throw raw across the boundary). */
export type IpcErrorCode =
  | "unauthorized"
  | "provider_error"
  | "model_unavailable"
  | "offline"
  | "validation"
  | "cancelled"
  | "not_found"
  | "conflict"
  | "internal";

export interface IpcError {
  readonly __ipcError: true;
  code: IpcErrorCode;
  message: string;
  detail?: unknown;
}

export function ipcError(code: IpcErrorCode, message: string, detail?: unknown): IpcError {
  return { __ipcError: true, code, message, detail };
}

export function isIpcError(value: unknown): value is IpcError {
  return typeof value === "object" && value !== null && (value as { __ipcError?: unknown }).__ipcError === true;
}

/**
 * Boundary guard: the preload sends `CONTRACT_VERSION` on every call and the main process calls
 * this to reject a renderer/main contract mismatch (08 §1). Pure + testable; the electron binding
 * invokes it before dispatch.
 */
export function checkContractVersion(received: unknown): void {
  if (received !== CONTRACT_VERSION) {
    throw ipcError(
      "validation",
      `IPC contract version mismatch: renderer sent ${String(received)}, main expects ${CONTRACT_VERSION}`,
    );
  }
}
