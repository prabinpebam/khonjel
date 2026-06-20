// Preload bridge: the real window.electronAPI exposed to the renderer.
// Mirrors the mock in src/mock/electron-api-shim.ts so the UI is identical.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  getPlatform: () => process.platform,
  hideWindow: () => ipcRenderer.send("window:minimize"),
  minimize: () => ipcRenderer.send("window:minimize"),
  toggleMaximize: () => ipcRenderer.send("window:toggle-maximize"),
  close: () => ipcRenderer.send("window:close"),
});
