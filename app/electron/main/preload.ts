// Preload bridge (TypeScript, bundled to ../preload.cjs). Exposes the real window.electronAPI
// (window controls, mirroring the mock shim) and the allow-listed window.khonjel IPC bridge.
import { contextBridge, ipcRenderer } from "electron";
import { CONTRACT_VERSION } from "../shared/ipc-contract";

contextBridge.exposeInMainWorld("electronAPI", {
  getPlatform: () => process.platform,
  hideWindow: () => ipcRenderer.send("window:minimize"),
  minimize: () => ipcRenderer.send("window:minimize"),
  toggleMaximize: () => ipcRenderer.send("window:toggle-maximize"),
  close: () => ipcRenderer.send("window:close"),
  floatingIdle: () => ipcRenderer.send("floating:idle"),
  getVersion: () => ipcRenderer.sendSync("app:version"),
  openDevTools: () => ipcRenderer.send("system:open-devtools"),
  openLogs: () => ipcRenderer.send("system:open-logs"),
  openModelsFolder: () => ipcRenderer.send("system:open-models"),
  clearModelCache: () => ipcRenderer.send("system:clear-cache"),
  resetAllData: () => ipcRenderer.send("system:reset-data"),
});

// The typed seam the renderer's `ipc` adapter calls. Only a single generic `invoke` crosses the
// bridge; it sends the contract version on every call (main rejects a mismatch), then the
// main-process dispatch validates channel + payload (the allow-list lives there).
contextBridge.exposeInMainWorld("khonjel", {
  invoke: (channel: string, ...args: unknown[]) =>
    ipcRenderer.invoke("khonjel:invoke", CONTRACT_VERSION, channel, args),
  contractVersion: CONTRACT_VERSION,
  // Global hotkey relay: main sends "khonjel:hotkey" with an action; returns an unsubscribe fn.
  onHotkey: (callback: (action: string) => void) => {
    const listener = (_event: unknown, action: string) => callback(action);
    ipcRenderer.on("khonjel:hotkey", listener);
    return () => ipcRenderer.removeListener("khonjel:hotkey", listener);
  },
  // Local-model download progress relay: main streams "khonjel:model-progress" ticks.
  onModelProgress: (callback: (progress: unknown) => void) => {
    const listener = (_event: unknown, progress: unknown) => callback(progress);
    ipcRenderer.on("khonjel:model-progress", listener);
    return () => ipcRenderer.removeListener("khonjel:model-progress", listener);
  },
});
