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
import type { Platform, Profile } from "../../src/services/ports";

export interface DispatchDeps {
  profile: { get: () => Profile | Promise<Profile> };
  system: {
    getAppVersion: () => string | Promise<string>;
    getPlatform: () => Platform | Promise<Platform>;
  };
  // Grows one slice per phase (settings, db-backed content, inference, …).
}

export type Dispatch = (channel: string, ...args: unknown[]) => Promise<unknown>;

export function createDispatch(deps: DispatchDeps): Dispatch {
  const handlers: Record<Channel, (args: unknown[]) => unknown> = {
    [CHANNELS.profileGet]: () => deps.profile.get(),
    [CHANNELS.systemGetAppVersion]: () => deps.system.getAppVersion(),
    [CHANNELS.systemGetPlatform]: () => deps.system.getPlatform(),
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
