// Electron main process (TypeScript, bundled to ../main.cjs by scripts/build-electron.mjs).
// Frameless window hosting the Vite build + the composition root for the IPC seam.
import { app, BrowserWindow, ipcMain, shell } from "electron";
import * as path from "node:path";
import type { Platform, SettingsPatch, SettingsSnapshot } from "../../src/services/ports";
import { checkContractVersion } from "../shared/ipc-contract";
import { createDispatch } from "../shared/dispatch";

let mainWindow: BrowserWindow | null = null;

/**
 * In-memory settings used by the live composition root for now. The durable, SQLite-backed store
 * is built and BE1-tested in electron/main/services/settings.ts; it is wired into live boot under
 * Electron (with the better-sqlite3 native rebuild) in T0.8, alongside the renderer adoption and
 * the S3 "persists across restart" EDD gate.
 */
function createMemorySettings() {
  const snapshot: SettingsSnapshot = { toggles: {}, values: {} };
  return {
    get: (): SettingsSnapshot => ({ toggles: { ...snapshot.toggles }, values: { ...snapshot.values } }),
    patch: (patch: SettingsPatch): SettingsSnapshot => {
      Object.assign(snapshot.toggles, patch.toggles ?? {});
      Object.assign(snapshot.values, patch.values ?? {});
      return { toggles: { ...snapshot.toggles }, values: { ...snapshot.values } };
    },
  };
}

/**
 * Composition root: construct the real dependencies and the pure dispatch layer.
 * Phase 0 wires profile + system + settings; later phases inject the db, keychain, inference, etc.
 */
const dispatch = createDispatch({
  profile: {
    get: () => ({ id: "local", name: "You" }),
  },
  system: {
    getAppVersion: () => app.getVersion(),
    getPlatform: () => {
      const plat = process.platform;
      return (plat === "win32" || plat === "darwin" || plat === "linux" ? plat : "web") as Platform;
    },
  },
  settings: createMemorySettings(),
});

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 720,
    minHeight: 560,
    frame: false,
    backgroundColor: "#f2f1ee",
    icon: path.join(__dirname, "..", "build", "icon.png"),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow?.show());

  if (app.isPackaged) {
    void mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  } else {
    void mainWindow.loadURL("http://localhost:5173");
  }

  // External links open in the OS browser, never inside the app window.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http")) void shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

void app.whenReady().then(() => {
  // The single allow-listed request/response bridge. The preload sends the contract version on
  // every call (rejected on mismatch); `dispatch` then validates channel + payload (unknown
  // channel -> not_found; bad payload -> validation). Together these are the allow-list.
  ipcMain.handle("khonjel:invoke", (_event, version: unknown, channel: string, args: unknown[]) => {
    checkContractVersion(version);
    return dispatch(channel, ...(Array.isArray(args) ? args : []));
  });

  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// Frameless window controls.
ipcMain.on("window:minimize", () => mainWindow?.minimize());
ipcMain.on("window:toggle-maximize", () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});
ipcMain.on("window:close", () => mainWindow?.close());
