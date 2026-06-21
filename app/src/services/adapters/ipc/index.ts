import type {
  CleanupResult,
  ConnectionProfile,
  Platform,
  Profile,
  Services,
  SettingsSnapshot,
} from "@services/ports";
import { CHANNELS } from "@ipc/ipc-contract";

/**
 * The renderer-side `ipc` adapter: implements the `@services` ports by calling the injected
 * `invoke` (a request/response IPC call). It imports ONLY the pure contract (channel names) —
 * never the dispatch/handlers/zod — so no main-process or node code reaches the renderer bundle.
 *
 * `invoke` is provided by the preload bridge (`window.khonjel.invoke`) under Electron, and by an
 * in-memory loopback in tests. Ports not yet implemented in the backend fall back to the provided
 * `fallback` services (the mock), so the app keeps working under Electron before later phases land
 * (e.g. `content` stays mock until Phase 4). See backend/08 + 14 (T0.4).
 */
export type Invoke = (channel: string, ...args: unknown[]) => Promise<unknown>;

export function createIpcServices(invoke: Invoke, fallback: Services): Services {
  return {
    profile: {
      get: () => invoke(CHANNELS.profileGet) as Promise<Profile>,
    },
    system: {
      getAppVersion: () => invoke(CHANNELS.systemGetAppVersion) as Promise<string>,
      getPlatform: () => invoke(CHANNELS.systemGetPlatform) as Promise<Platform>,
    },
    settings: {
      get: () => invoke(CHANNELS.settingsGet) as Promise<SettingsSnapshot>,
      patch: (patch) => invoke(CHANNELS.settingsPatch, patch) as Promise<SettingsSnapshot>,
    },
    inference: {
      cleanup: (input, options) => invoke(CHANNELS.inferenceCleanup, input, options ?? {}) as Promise<CleanupResult>,
    },
    connections: {
      list: () => invoke(CHANNELS.connectionsList) as Promise<ConnectionProfile[]>,
      upsert: (profile) => invoke(CHANNELS.connectionsUpsert, profile) as Promise<ConnectionProfile[]>,
      remove: (id) => invoke(CHANNELS.connectionsRemove, id) as Promise<ConnectionProfile[]>,
    },
    // Not yet backed by the backend — keep the mock until its phase implements it.
    content: fallback.content,
  };
}
