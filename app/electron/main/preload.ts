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
  setRecordingActive: (active: boolean) => ipcRenderer.send("recording:active", active),
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
  // Streaming capture: push high-rate 16 kHz PCM frames (one-way, no per-chunk validation) and
  // subscribe to the live transcript the capture session broadcasts.
  capturePushChunk: (sessionId: string, base64Pcm16: string) =>
    ipcRenderer.send("khonjel:capture-chunk", sessionId, base64Pcm16),
  onTranscript: (callback: (event: unknown) => void) => {
    const listener = (_event: unknown, payload: unknown) => callback(payload);
    ipcRenderer.on("khonjel:transcript", listener);
    return () => ipcRenderer.removeListener("khonjel:transcript", listener);
  },
  // Content-mutation relay: main sends "khonjel:content-changed" (with the collection) after a
  // mutation (e.g. a new dictation appended to history), so views can refresh live.
  onContentChanged: (callback: (collection: string) => void) => {
    const listener = (_event: unknown, collection: string) => callback(collection);
    ipcRenderer.on("khonjel:content-changed", listener);
    return () => ipcRenderer.removeListener("khonjel:content-changed", listener);
  },
});
