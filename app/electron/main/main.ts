// Electron main process (TypeScript, bundled to ../main.cjs by scripts/build-electron.mjs).
// Frameless window hosting the Vite build + the composition root for the IPC seam.
import { app, BrowserWindow, ipcMain, shell } from "electron";
import * as path from "node:path";
import { writeFileSync, unlinkSync } from "node:fs";
import type { Platform } from "../../src/services/ports";
import { checkContractVersion } from "../shared/ipc-contract";
import { createDispatch } from "../shared/dispatch";
import { createSettingsStore, fileSettingsIO } from "./services/settings";
import { createInferenceService } from "./services/inference";
import { createInferenceRuntime, type InferenceRuntime } from "./inference/runtime";
import { createTranscriptionService } from "./services/transcription";
import { resolveTranscriber } from "./stt/runtime";
import { createInjector } from "./injection/injector";
import * as win32 from "./injection/win32";
import { createHotkeyManager, type HotkeyManager } from "./hotkeys";
import { createConnectionStore } from "./services/connections";
import { createContentStore } from "./services/content";
import { createSecretStore } from "./secrets/store";
import { safeStorageCipher } from "./secrets/safeStorageCipher";
import { createProviderRouter } from "./providers/router";
import { proxyFetch } from "./providers/proxyFetch";
import { testConnection } from "./providers/test";
import { listModels } from "./models/catalog";
import { computeInsights } from "./insights/compute";

let mainWindow: BrowserWindow | null = null;
let inferenceRuntime: InferenceRuntime | null = null;
let hotkeyManager: HotkeyManager | null = null;

/**
 * Composition root: construct the real dependencies and the pure dispatch layer. Built after the
 * app is ready so `userData` paths resolve. Phase 0 wires profile + system + durable settings
 * (JSON file); later phases inject the db, keychain, inference, etc.
 */
function buildDispatch(inferenceRuntime: InferenceRuntime) {
  const userData = app.getPath("userData");
  const injector = createInjector({
    writeClipboard: win32.writeClipboard,
    paste: win32.paste,
    typeText: win32.typeText,
    getForegroundApp: win32.getForegroundApp,
  });

  // Durable stores (native-free JSON files) + the secret keychain (Electron safeStorage).
  const settingsStore = createSettingsStore(fileSettingsIO(path.join(userData, "settings.json")));
  const connectionStore = createConnectionStore(fileSettingsIO(path.join(userData, "connections.json")));
  const secretStore = createSecretStore(fileSettingsIO(path.join(userData, "secrets.json")), safeStorageCipher);

  // The provider router resolves a slot's binding (settings) -> connection + secret -> proxyFetch.
  const router = createProviderRouter({
    getSettings: () => settingsStore.get(),
    getConnection: (id) => connectionStore.list().find((c) => c.id === id),
    getSecret: (id) => secretStore.get(id),
    fetch: proxyFetch,
  });

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
      injectText: (text) => injector.inject(text),
    },
    settings: settingsStore,
    inference: createInferenceService(inferenceRuntime.engine, router),
    transcription: createTranscriptionService({
      transcriber: resolveTranscriber({
        userDataDir: userData,
        appDir: path.join(__dirname, ".."),
        isWindows: process.platform === "win32",
        env: process.env,
      }),
      router,
      writeTempWav: (bytes) => {
        const file = path.join(
          app.getPath("temp"),
          `khonjel-${Date.now()}-${Math.random().toString(36).slice(2)}.wav`,
        );
        writeFileSync(file, bytes);
        return file;
      },
      cleanup: (file) => {
        try {
          unlinkSync(file);
        } catch {
          // best-effort temp cleanup
        }
      },
    }),
    connections: {
      list: () => connectionStore.list(),
      upsert: (profile) => connectionStore.upsert(profile),
      remove: (id) => {
        secretStore.remove(id); // drop the orphaned key with the profile
        return connectionStore.remove(id);
      },
      test: (id, target, operation) =>
        testConnection(
          connectionStore.list().find((c) => c.id === id),
          secretStore.get(id) ?? "",
          target,
          operation,
          proxyFetch,
        ),
    },
    secrets: {
      set: (id, secret) => secretStore.set(id, secret),
      has: (id) => secretStore.has(id),
      remove: (id) => secretStore.remove(id),
    },
    content: createContentStore(
      fileSettingsIO(path.join(userData, "content.json")),
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

  // Load the built renderer by default (works for `npm run electron` and the packaged app).
  // Opt into the Vite dev server for HMR with `electron . --dev-server` (see `npm run electron:dev`)
  // while `npm run dev` is running.
  const useDevServer = !app.isPackaged && process.argv.includes("--dev-server");
  if (useDevServer) {
    void mainWindow.loadURL("http://localhost:5173");
  } else {
    void mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
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
  inferenceRuntime = createInferenceRuntime({
    userDataDir: app.getPath("userData"),
    appDir: path.join(__dirname, ".."),
    isWindows: process.platform === "win32",
    env: process.env,
  });
  const dispatch = buildDispatch(inferenceRuntime);
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

  // Register the global dictation hotkey from settings; a press toggles the renderer's dictation.
  hotkeyManager = createHotkeyManager();
  const settingsStore = createSettingsStore(
    fileSettingsIO(path.join(app.getPath("userData"), "settings.json")),
  );
  const hotkeySetting = settingsStore.get().values["hotkey.dictation"] ?? "Ctrl+Shift+D";
  const liveAccelerator = hotkeyManager.register(hotkeySetting, () => {
    mainWindow?.webContents.send("khonjel:hotkey", "dictation");
  });
  console.log(`[khonjel] dictation hotkey: ${liveAccelerator ?? "none (registration failed)"}`);

  // Upgrade from the deterministic stub to the local LLM in the background (never blocks startup).
  void inferenceRuntime.start().then((mode) => {
    console.log(`[khonjel] inference engine: ${mode}`);
  });
});

app.on("before-quit", () => {
  inferenceRuntime?.stop();
  hotkeyManager?.unregisterAll();
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
