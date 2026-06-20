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
}

export const electronAPI: ElectronAPIShim = {
  getPlatform: () => "win32",
  hideWindow: () => {},
};

declare global {
  interface Window {
    electronAPI?: ElectronAPIShim;
  }
}

if (typeof window !== "undefined") {
  window.electronAPI = electronAPI;
}
