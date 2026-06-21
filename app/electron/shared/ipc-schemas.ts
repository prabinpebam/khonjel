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
});

const ConnectionListSchema = z.array(ConnectionProfileSchema);

/** Request argument tuples (Phase 0 channels take no arguments; settings:patch takes a patch). */
export const RequestSchemas: Record<Channel, z.ZodTypeAny> = {
  [CHANNELS.profileGet]: z.tuple([]),
  [CHANNELS.systemGetAppVersion]: z.tuple([]),
  [CHANNELS.systemGetPlatform]: z.tuple([]),
  [CHANNELS.settingsGet]: z.tuple([]),
  [CHANNELS.settingsPatch]: z.tuple([SettingsPatchSchema]),
  [CHANNELS.inferenceCleanup]: z.tuple([z.string(), CleanupOptionsSchema]),
  [CHANNELS.connectionsList]: z.tuple([]),
  [CHANNELS.connectionsUpsert]: z.tuple([ConnectionProfileSchema]),
  [CHANNELS.connectionsRemove]: z.tuple([z.string()]),
};

/** Response payload schemas. */
export const ResponseSchemas: Record<Channel, z.ZodTypeAny> = {
  [CHANNELS.profileGet]: ProfileSchema,
  [CHANNELS.systemGetAppVersion]: z.string(),
  [CHANNELS.systemGetPlatform]: PlatformSchema,
  [CHANNELS.settingsGet]: SettingsSnapshotSchema,
  [CHANNELS.settingsPatch]: SettingsSnapshotSchema,
  [CHANNELS.inferenceCleanup]: CleanupResultSchema,
  [CHANNELS.connectionsList]: ConnectionListSchema,
  [CHANNELS.connectionsUpsert]: ConnectionListSchema,
  [CHANNELS.connectionsRemove]: ConnectionListSchema,
};
