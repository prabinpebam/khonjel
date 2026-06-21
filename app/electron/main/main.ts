// Electron main process (TypeScript, bundled to ../main.cjs by scripts/build-electron.mjs).
// Frameless window hosting the Vite build + the composition root for the IPC seam.
import { app, BrowserWindow, ipcMain, shell } from "electron";
import * as path from "node:path";
import type { Platform } from "../../src/services/ports";
import { checkContractVersion } from "../shared/ipc-contract";
import { createDispatch } from "../shared/dispatch";
import { createSettingsStore, fileSettingsIO } from "./services/settings";
import { createInferenceService, stubInferenceEngine } from "./services/inference";
import { createConnectionStore } from "./services/connections";
import { createContentStore } from "./services/content";
import { listModels } from "./models/catalog";
import { computeInsights } from "./insights/compute";

let mainWindow: BrowserWindow | null = null;

/**
 * Composition root: construct the real dependencies and the pure dispatch layer. Built after the
 * app is ready so `userData` paths resolve. Phase 0 wires profile + system + durable settings
 * (JSON file); later phases inject the db, keychain, inference, etc.
 */
function buildDispatch() {
  return createDispatch({
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
    settings: createSettingsStore(fileSettingsIO(path.join(app.getPath("userData"), "settings.json"))),
    inference: createInferenceService(stubInferenceEngine),
    connections: createConnectionStore(
      fileSettingsIO(path.join(app.getPath("userData"), "connections.json")),
    ),
    content: createContentStore(
      fileSettingsIO(path.join(app.getPath("userData"), "content.json")),
      { listModels, computeInsights },
    ),
  });
}

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

  if (app.isPackaged || process.env.KHONJEL_LOAD_DIST === "1") {
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
  const dispatch = buildDispatch();
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
