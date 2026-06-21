// Electron main process (TypeScript, bundled to ../main.cjs by scripts/build-electron.mjs).
// Frameless window hosting the Vite build + the composition root for the IPC seam.
import { app, BrowserWindow, dialog, ipcMain, screen, session, shell } from "electron";
import * as path from "node:path";
import { writeFileSync, unlinkSync, mkdirSync, rmSync } from "node:fs";
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
let floatingBarWindow: BrowserWindow | null = null;
let inferenceRuntime: InferenceRuntime | null = null;
let hotkeyManager: HotkeyManager | null = null;

// Eval harness only: provide a fake microphone so getUserMedia resolves headlessly (no real device
// or user gesture needed). Must be set before the app is ready. Never enabled in normal runs.
if (process.env.KHONJEL_EVAL === "1") {
  app.commandLine.appendSwitch("use-fake-ui-for-media-stream");
  app.commandLine.appendSwitch("use-fake-device-for-media-stream");
}

/**
 * Composition root: construct the real dependencies and the pure dispatch layer. Built after the
 * app is ready so `userData` paths resolve. Phase 0 wires profile + system + durable settings
 * (JSON file); later phases inject the db, keychain, inference, etc.
 */
function buildDispatch(inferenceRuntime: InferenceRuntime, onTransformsChanged: () => void) {
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

  // Hoisted so the composition root can read transforms for hotkey registration and re-register
  // when the renderer edits them (content:replace -> onTransformsChanged).
  const contentStore = createContentStore(fileSettingsIO(path.join(userData, "content.json")), {
    listModels,
    computeInsights,
  });

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
      injectText: (text) => injector.inject(text),
      captureSelection: () => win32.captureSelection(),
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
    content: {
      ...contentStore,
      replace: (collection: string, items: unknown[]) => {
        contentStore.replace(collection, items);
        if (collection === "transforms") onTransformsChanged();
      },
    },
  });

  return { dispatch, contentStore, settingsStore };
}

function createWindow(startMinimized = false): void {
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

  mainWindow.once("ready-to-show", () => {
    if (startMinimized) {
      mainWindow?.showInactive();
      mainWindow?.minimize();
    } else {
      mainWindow?.show();
    }
  });

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
  hotkeyManager = createHotkeyManager();
  const built = buildDispatch(inferenceRuntime, () => registerHotkeys());
  // The single allow-listed request/response bridge. The preload sends the contract version on
  // every call (rejected on mismatch); `dispatch` then validates channel + payload (unknown
  // channel -> not_found; bad payload -> validation). Together these are the allow-list.
  ipcMain.handle("khonjel:invoke", (_event, version: unknown, channel: string, args: unknown[]) => {
    checkContractVersion(version);
    return built.dispatch(channel, ...(Array.isArray(args) ? args : []));
  });

  // Live mic capture (dictation + the floating bar) issues a getUserMedia permission request. This
  // is a local, on-device dictation app, so grant microphone/media access; deny everything else.
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(permission === "media");
  });
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => permission === "media");

  // Apply OS startup preferences from settings. Only meaningful for the packaged app (in dev the
  // executable is electron.exe, so registering a login item would point at the wrong binary).
  const boot = built.settingsStore.get();
  const startMinimized = boot.toggles.startMinimized ?? false;
  if (app.isPackaged) {
    app.setLoginItemSettings({
      openAtLogin: boot.toggles.launchAtLogin ?? true,
      openAsHidden: startMinimized,
    });
  }

  createWindow(startMinimized);
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  // ---- Floating dictation bar (the core capture surface) ----
  // A frameless, transparent, always-on-top, non-focusable window so it never steals focus from the
  // app you are typing into. Created hidden; the dictation hotkey shows it (when the HUD preview is
  // on) and drives record -> transcribe -> clean -> inject. Honors floatingStartPosition / autoHide.
  createFloatingBar();

  function createFloatingBar(): void {
    floatingBarWindow = new BrowserWindow({
      width: 360,
      height: 72,
      frame: false,
      transparent: true,
      resizable: false,
      maximizable: false,
      minimizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      focusable: false,
      show: false,
      backgroundColor: "#00000000",
      webPreferences: {
        preload: path.join(__dirname, "preload.cjs"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    floatingBarWindow.setAlwaysOnTop(true, "screen-saver");
    const useDevServer = !app.isPackaged && process.argv.includes("--dev-server");
    if (useDevServer) {
      void floatingBarWindow.loadURL("http://localhost:5173/?surface=floating-bar");
    } else {
      void floatingBarWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"), {
        query: { surface: "floating-bar" },
      });
    }
    floatingBarWindow.on("closed", () => {
      floatingBarWindow = null;
    });
    // If the bar is pinned (preview on + auto-hide off), show it once it has loaded.
    floatingBarWindow.webContents.once("did-finish-load", () => {
      const s = built.settingsStore.get();
      if ((s.toggles["stt.dictation.preview"] ?? true) && !(s.toggles.floatingAutoHide ?? true)) {
        showFloatingBar();
      }
    });
  }

  function positionFloatingBar(): void {
    if (!floatingBarWindow) return;
    const position = built.settingsStore.get().values.floatingStartPosition ?? "bottom-right";
    const { workArea } = screen.getPrimaryDisplay();
    const size = floatingBarWindow.getSize();
    const w = size[0] ?? 360;
    const h = size[1] ?? 72;
    const margin = 24;
    let x = workArea.x + workArea.width - w - margin;
    const y = workArea.y + workArea.height - h - margin;
    if (position === "center") x = workArea.x + Math.round((workArea.width - w) / 2);
    else if (position === "bottom-left") x = workArea.x + margin;
    floatingBarWindow.setPosition(x, y);
  }

  function showFloatingBar(): void {
    if (!floatingBarWindow) return;
    positionFloatingBar();
    floatingBarWindow.showInactive();
  }

  // The dictation hotkey: show the bar (when the HUD is enabled) and tell it to toggle recording.
  function triggerDictation(): void {
    const preview = built.settingsStore.get().toggles["stt.dictation.preview"] ?? true;
    if (preview) showFloatingBar();
    floatingBarWindow?.webContents.send("khonjel:hotkey", "dictation");
  }

  // The bar reports returning to idle (after injecting); auto-hide it if enabled.
  ipcMain.on("floating:idle", () => {
    const autoHide = built.settingsStore.get().toggles.floatingAutoHide ?? true;
    if (autoHide) floatingBarWindow?.hide();
  });

  // Eval-only hook: Playwright can't press a global shortcut, so the EDD harness calls this to
  // exercise the real hotkey -> show-bar -> record path. Never installed outside the eval.
  if (process.env.KHONJEL_EVAL === "1") {
    (globalThis as unknown as { __khonjelTriggerDictation?: () => void }).__khonjelTriggerDictation =
      () => triggerDictation();
  }

  // Register the global dictation hotkey + each opted-in transform hotkey. Re-runs whenever the
  // renderer edits transforms (content:replace -> onTransformsChanged). register() clears all
  // shortcuts first, so dictation is rebound before the transforms are layered on via registerExtra.
  function registerHotkeys(): void {
    if (!hotkeyManager) return;
    const snapshot = built.settingsStore.get();
    const dictationSetting = snapshot.values["hotkey.dictation"] ?? "Ctrl+Shift+D";
    const live = hotkeyManager.register(dictationSetting, () => {
      triggerDictation();
    });
    console.log(`[khonjel] dictation hotkey: ${live ?? "none (registration failed)"}`);
    if (snapshot.toggles["transforms.optIn"]) {
      for (const transform of built.contentStore.transforms()) {
        if (!transform.enabled || transform.hotkey.length === 0) continue;
        const accel = hotkeyManager.registerExtra(transform.hotkey, () => {
          mainWindow?.webContents.send("khonjel:hotkey", `transform:${transform.id}`);
        });
        if (accel) console.log(`[khonjel] transform ${transform.id} hotkey: ${accel}`);
      }
    }
  }
  registerHotkeys();

  // Upgrade from the deterministic stub to the local LLM in the background (never blocks startup).
  void inferenceRuntime.start().then((mode) => {
    console.log(`[khonjel] inference engine: ${mode}`);
  });
});

app.on("before-quit", () => {
  inferenceRuntime?.stop();
  hotkeyManager?.unregisterAll();
  floatingBarWindow?.destroy();
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

// System / diagnostics controls (Settings -> System).
ipcMain.on("app:version", (event) => {
  event.returnValue = app.getVersion();
});
ipcMain.on("system:open-devtools", () => {
  mainWindow?.webContents.openDevTools({ mode: "detach" });
});
ipcMain.on("system:open-logs", () => {
  void shell.openPath(app.getPath("logs"));
});
ipcMain.on("system:open-models", () => {
  const dir = path.join(app.getPath("userData"), "models");
  mkdirSync(dir, { recursive: true });
  void shell.openPath(dir);
});
ipcMain.on("system:clear-cache", () => {
  if (!mainWindow) return;
  void dialog
    .showMessageBox(mainWindow, {
      type: "warning",
      buttons: ["Cancel", "Delete models"],
      defaultId: 0,
      cancelId: 0,
      message: "Delete all downloaded models?",
      detail: "You will need to download them again to use local inference.",
    })
    .then(({ response }) => {
      if (response === 1) rmSync(path.join(app.getPath("userData"), "models"), { recursive: true, force: true });
    });
});
ipcMain.on("system:reset-data", () => {
  if (!mainWindow) return;
  void dialog
    .showMessageBox(mainWindow, {
      type: "warning",
      buttons: ["Cancel", "Reset everything"],
      defaultId: 0,
      cancelId: 0,
      message: "Reset all Khonjel data?",
      detail: "Permanently deletes your settings, notes, history, connections, and saved keys, then restarts.",
    })
    .then(({ response }) => {
      if (response !== 1) return;
      const ud = app.getPath("userData");
      for (const file of ["settings.json", "content.json", "connections.json", "secrets.json"]) {
        rmSync(path.join(ud, file), { force: true });
      }
      app.relaunch();
      app.exit(0);
    });
});
