/**
 * Mock of the Electron preload bridge (`window.electronAPI`).
 *
 * In the real desktop app, the preload script exposes a typed IPC surface here.
 * In the mock frontend there is NO backend — this shim returns plausible values
 * so adapters can be written exactly as they will be against the real bridge.
 * It grows one method at a time, as features need it.
 */

export interface ElectronAPIShim {
  getPlatform: () => "win32" | "darwin" | "linux";
  /** Hide the floating window (no-op in the mock). */
  hideWindow: () => void;
  minimize?: () => void;
  toggleMaximize?: () => void;
  close?: () => void;
  /** The floating bar signals it returned to idle so the main process can auto-hide it. */
  floatingIdle?: () => void;
}

export const electronAPI: ElectronAPIShim = {
  getPlatform: () => "win32",
  hideWindow: () => {},
  minimize: () => {},
  toggleMaximize: () => {},
  close: () => {},
  floatingIdle: () => {},
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
