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

/** Request argument tuples (Phase 0 channels take no arguments). */
export const RequestSchemas: Record<Channel, z.ZodTypeAny> = {
  [CHANNELS.profileGet]: z.tuple([]),
  [CHANNELS.systemGetAppVersion]: z.tuple([]),
  [CHANNELS.systemGetPlatform]: z.tuple([]),
};

/** Response payload schemas. */
export const ResponseSchemas: Record<Channel, z.ZodTypeAny> = {
  [CHANNELS.profileGet]: ProfileSchema,
  [CHANNELS.systemGetAppVersion]: z.string(),
  [CHANNELS.systemGetPlatform]: PlatformSchema,
};
