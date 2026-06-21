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
});

// The typed seam the renderer's `ipc` adapter calls. Only a single generic `invoke` crosses the
// bridge; it sends the contract version on every call (main rejects a mismatch), then the
// main-process dispatch validates channel + payload (the allow-list lives there).
contextBridge.exposeInMainWorld("khonjel", {
  invoke: (channel: string, ...args: unknown[]) =>
    ipcRenderer.invoke("khonjel:invoke", CONTRACT_VERSION, channel, args),
  contractVersion: CONTRACT_VERSION,
});
