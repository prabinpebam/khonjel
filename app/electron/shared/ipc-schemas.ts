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

/** Request argument tuples (Phase 0 channels take no arguments; settings:patch takes a patch). */
export const RequestSchemas: Record<Channel, z.ZodTypeAny> = {
  [CHANNELS.profileGet]: z.tuple([]),
  [CHANNELS.systemGetAppVersion]: z.tuple([]),
  [CHANNELS.systemGetPlatform]: z.tuple([]),
  [CHANNELS.settingsGet]: z.tuple([]),
  [CHANNELS.settingsPatch]: z.tuple([SettingsPatchSchema]),
};

/** Response payload schemas. */
export const ResponseSchemas: Record<Channel, z.ZodTypeAny> = {
  [CHANNELS.profileGet]: ProfileSchema,
  [CHANNELS.systemGetAppVersion]: z.string(),
  [CHANNELS.systemGetPlatform]: PlatformSchema,
  [CHANNELS.settingsGet]: SettingsSnapshotSchema,
  [CHANNELS.settingsPatch]: SettingsSnapshotSchema,
};
