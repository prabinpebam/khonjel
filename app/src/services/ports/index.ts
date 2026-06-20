/**
 * Service ports (the seam).
 *
 * UI and features import ONLY these interfaces via `@services` — never an adapter
 * directly (enforced by ESLint `no-restricted-imports`). Mock adapters back them
 * today; real Electron/IPC adapters will back them later with zero UI change.
 *
 * The `Services` container grows one port at a time, per delivery phase. Phase 0
 * wires `profile` + `system` to prove the seam end-to-end.
 */

export type Platform = "win32" | "darwin" | "linux" | "web";

export interface Profile {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string;
}

export interface ProfileService {
  /** The local user profile (local-first: no account required). */
  get(): Promise<Profile>;
}

export interface SystemService {
  getAppVersion(): Promise<string>;
  getPlatform(): Promise<Platform>;
}

/** The full set of ports available to the app at runtime. */
export interface Services {
  profile: ProfileService;
  system: SystemService;
}
