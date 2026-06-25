/**
 * Mock of the Electron preload bridge (`window.electronAPI`).
 *
 * In the real desktop app, the preload script exposes a typed IPC surface here.
 * In the mock frontend there is NO backend — this shim returns plausible values
 * so adapters can be written exactly as they will be against the real bridge.
 * It grows one method at a time, as features need it.
 */

/** Coarse auto-update lifecycle surfaced in Settings -> System (mirrors the main-process updater). */
export type UpdateStatus =
  | { state: "idle" }
  | { state: "unsupported" }
  | { state: "checking" }
  | { state: "available"; version: string }
  | { state: "none" }
  | { state: "downloading"; percent: number }
  | { state: "ready"; version: string }
  | { state: "error"; message: string };

export interface ElectronAPIShim {
  getPlatform: () => "win32" | "darwin" | "linux";
  /** Hide the floating window (no-op in the mock). */
  hideWindow: () => void;
  minimize?: () => void;
  toggleMaximize?: () => void;
  close?: () => void;
  /** The floating bar signals it returned to idle so the main process can auto-hide it. */
  floatingIdle?: () => void;
  getVersion?: () => string;
  openDevTools?: () => void;
  openLogs?: () => void;
  openModelsFolder?: () => void;
  clearModelCache?: () => void;
  resetAllData?: () => void;
  /** The floating bar reports recording start/stop so other system audio can be muted. */
  setRecordingActive?: (active: boolean) => void;
  /** Manually trigger an update check (no-op in the browser preview). */
  checkForUpdates?: () => void;
  /** Quit and install a downloaded update. */
  installUpdate?: () => void;
  /** Subscribe to update lifecycle changes; returns an unsubscribe fn. */
  onUpdateStatus?: (callback: (status: UpdateStatus) => void) => () => void;
  /** Write text to the system clipboard. */
  copyText?: (text: string) => void;
}

export const electronAPI: ElectronAPIShim = {
  getPlatform: () => "win32",
  hideWindow: () => {},
  minimize: () => {},
  toggleMaximize: () => {},
  close: () => {},
  floatingIdle: () => {},
  getVersion: () => "0.0.0-browser",
  openDevTools: () => {},
  openLogs: () => {},
  openModelsFolder: () => {},
  clearModelCache: () => {},
  resetAllData: () => {},
  setRecordingActive: () => {},
  checkForUpdates: () => {},
  installUpdate: () => {},
  // The browser preview has no updater; report "unsupported" so the UI says so instead of spinning.
  onUpdateStatus: (callback) => {
    queueMicrotask(() => callback({ state: "unsupported" }));
    return () => {};
  },
  copyText: (text) => {
    void navigator.clipboard?.writeText?.(text);
  },
};

declare global {
  interface Window {
    electronAPI?: ElectronAPIShim;
  }
}

// In Electron a real preload bridge already exists on window.electronAPI; never
// clobber it. Only install the mock in a plain browser (Vite dev/preview).
if (typeof window !== "undefined" && !window.electronAPI) {
  window.electronAPI = electronAPI;
}
