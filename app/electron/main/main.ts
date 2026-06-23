// Electron main process (TypeScript, bundled to ../main.cjs by scripts/build-electron.mjs).
// Frameless window hosting the Vite build + the composition root for the IPC seam.
import { app, BrowserWindow, dialog, globalShortcut, ipcMain, screen, session, shell, type IpcMainEvent } from "electron";
import * as path from "node:path";
import { writeFileSync, unlinkSync, mkdirSync, rmSync } from "node:fs";
import { randomUUID } from "node:crypto";
import type { Platform } from "../../src/services/ports";
import { CHANNELS, checkContractVersion, ipcError } from "../shared/ipc-contract";
import { createDispatch } from "../shared/dispatch";
import { createSettingsStore, fileSettingsIO, encryptedSettingsIO } from "./services/settings";
import { createInferenceService } from "./services/inference";
import { createInferenceRuntime, type InferenceRuntime } from "./inference/runtime";
import { createTranscriptionService } from "./services/transcription";
import { resolveTranscriber } from "./stt/runtime";
import type { Transcriber } from "./stt/whisper";
import { createCaptureSession, type CaptureSession } from "./stt/capture";
import { DEFAULT_SEGMENTER } from "./stt/segmenter";
import { createInjector } from "./injection/injector";
import * as win32 from "./injection/win32";
import {
  createHotkeyManager,
  normalizeAccelerator,
  isRegistrableAccelerator,
  DEFAULT_DICTATION_HOTKEY,
  type HotkeyManager,
} from "./hotkeys";
import { createConnectionStore } from "./services/connections";
import { createContentStore } from "./services/content";
import { createModelIndexStore } from "./models/store";
import { createDownloader } from "./models/downloader";
import { createModelService, boundModelIdsFrom } from "./models/service";
import { buildActiveModelReport, buildModelCompatibilityReport, buildModelReadiness } from "./models/compatibility";
import {
  nodeModelFs,
  nodeDownloadFs,
  nodeDownloadFetch,
  makeEngineReady,
  modelsDirOf,
} from "./models/runtime";
import { detectHardwareProfile } from "./models/hardware";
import { createSecretStore } from "./secrets/store";
import { safeStorageCipher } from "./secrets/safeStorageCipher";
import { createProviderRouter } from "./providers/router";
import { proxyFetch } from "./providers/proxyFetch";
import { testConnection } from "./providers/test";
import { isEndpointAllowed } from "./providers/url";
import { listModels } from "./models/catalog";
import { computeInsights } from "./insights/compute";

let mainWindow: BrowserWindow | null = null;
let floatingBarWindow: BrowserWindow | null = null;
let inferenceRuntime: InferenceRuntime | null = null;
let hotkeyManager: HotkeyManager | null = null;

/** True when an IPC message originates from one of our own app frames (file:// or the dev server). */
function isTrustedSender(event: { senderFrame?: { url?: string } | null }): boolean {
  const url = event.senderFrame?.url ?? "";
  if (url.startsWith("file://")) return true;
  if (!app.isPackaged && url.startsWith("http://localhost:5173")) return true;
  return false;
}

/** Register an `ipcMain.on` listener that silently drops messages from any untrusted sender frame. */
function ipcOn(channel: string, handler: (event: IpcMainEvent, ...args: unknown[]) => void): void {
  ipcMain.on(channel, (event, ...args) => {
    if (!isTrustedSender(event)) return;
    handler(event, ...args);
  });
}

// Eval harness only: provide a fake microphone so getUserMedia resolves headlessly (no real device
// or user gesture needed). Must be set before the app is ready. Never enabled in normal runs.
if (process.env.KHONJEL_EVAL === "1") {
  app.commandLine.appendSwitch("use-fake-ui-for-media-stream");
  app.commandLine.appendSwitch("use-fake-device-for-media-stream");
}

// Mute other system audio while a dictation capture is live (Win32 Core Audio) so the recording is
// clean, and always restore it when recording stops. Module-scoped so shutdown can guarantee a
// restore. Skipped under KHONJEL_EVAL so the test suite never mutes the machine running it.
let dictationMuted = false;
function setDictationMute(muted: boolean): void {
  dictationMuted = muted;
  if (process.env.KHONJEL_EVAL === "1") return;
  win32.setSystemMute(muted);
}

/**
 * Composition root: construct the real dependencies and the pure dispatch layer. Built after the
 * app is ready so `userData` paths resolve. Phase 0 wires profile + system + durable settings
 * (JSON file); later phases inject the db, keychain, inference, etc.
 */
/** Parse the optional KHONJEL_MODEL_SOURCES env (id -> url JSON) into a lookup map. */
function parseModelSources(raw: string | undefined): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function buildDispatch(inferenceRuntime: InferenceRuntime, onHotkeysChanged: () => void) {
  const userData = app.getPath("userData");
  const injector = createInjector({
    writeClipboard: win32.writeClipboard,
    readClipboard: win32.readClipboard,
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
  const contentStore = createContentStore(
    encryptedSettingsIO(path.join(userData, "content.json"), safeStorageCipher),
    {
      listModels,
      computeInsights,
      // Privacy retention: purge dictation history older than the configured number of days (0 = keep).
      retentionDays: () => Number(settingsStore.get().values["privacy.historyRetentionDays"]) || 0,
    },
  );

  // Local model management (download/verify/remove/storage) over the durable models index. Progress
  // ticks are relayed to the renderer over "khonjel:model-progress" (preload bridges onModelProgress).
  const modelsDir = modelsDirOf(userData);
  mkdirSync(modelsDir, { recursive: true });
  const engineReady = makeEngineReady({
    userDataDir: userData,
    appDir: path.join(__dirname, ".."),
    isWindows: process.platform === "win32",
    env: process.env,
  });
  const modelService = createModelService({
    modelsDir,
    store: createModelIndexStore(fileSettingsIO(path.join(modelsDir, "index.json"))),
    downloader: createDownloader({ fetch: nodeDownloadFetch, fs: nodeDownloadFs() }),
    fs: nodeModelFs(),
    engineReady,
    boundModelIds: () => boundModelIdsFrom(settingsStore.get().values),
    emit: (progress) => mainWindow?.webContents.send("khonjel:model-progress", progress),
    // Optional per-id source override (mirror / eval): KHONJEL_MODEL_SOURCES='{"<id>":"<url>"}'.
    sourceFor: (id) => parseModelSources(process.env.KHONJEL_MODEL_SOURCES)[id],
  });

  // STT transcriber: the real whisper engine; an eval stub so the streaming capture path is
  // deterministic/offline (KHONJEL_EVAL); or undefined to simulate no model (KHONJEL_EVAL_NO_STT).
  const transcriber: Transcriber | undefined =
    process.env.KHONJEL_EVAL_NO_STT === "1"
      ? undefined
      : process.env.KHONJEL_EVAL === "1"
        ? { transcribe: async () => "khonjel eval transcript" }
        : resolveTranscriber({
            userDataDir: userData,
            appDir: path.join(__dirname, ".."),
            isWindows: process.platform === "win32",
            env: process.env,
          });
  const writeTempWav = (bytes: Buffer): string => {
    const file = path.join(
      app.getPath("temp"),
      `khonjel-${Date.now()}-${Math.random().toString(36).slice(2)}.wav`,
    );
    writeFileSync(file, bytes);
    return file;
  };
  const removeTempWav = (file: string): void => {
    try {
      unlinkSync(file);
    } catch {
      // best-effort temp cleanup
    }
  };
  const transcriptionService = createTranscriptionService({
    transcriber,
    router,
    writeTempWav,
    cleanup: removeTempWav,
  });

  // Long-form streaming capture (12 §2A): each session segments incoming 16 kHz PCM and transcribes
  // window-by-window through the same transcription service (local whisper or a bound cloud slot),
  // broadcasting a live transcript to every window.
  const captureSessions = new Map<string, CaptureSession>();
  const captureManager = {
    start: (): string => {
      const id = randomUUID();
      // Live-vs-quality balance: shorter windows = more frequent live updates; tunable per device.
      const values = settingsStore.get().values;
      const windowSec = Number(values["stt.dictation.chunkWindowSec"]);
      const silenceMs = Number(values["stt.dictation.chunkSilenceMs"]);
      const config = {
        ...DEFAULT_SEGMENTER,
        ...(Number.isFinite(windowSec) && windowSec > 0 ? { maxWindowSec: windowSec } : {}),
        ...(Number.isFinite(silenceMs) && silenceMs > 0 ? { silenceTailMs: silenceMs } : {}),
      };
      captureSessions.set(
        id,
        createCaptureSession({
          sessionId: id,
          config,
          transcribeSegment: (wav) =>
            transcriptionService
              .transcribe({ audioBase64: wav.toString("base64") })
              .then((r) => r.text),
          emit: (event) => {
            for (const win of BrowserWindow.getAllWindows()) {
              if (!win.isDestroyed()) win.webContents.send("khonjel:transcript", event);
            }
          },
        }),
      );
      return id;
    },
    stop: async (id: string): Promise<{ text: string }> => {
      const session = captureSessions.get(id);
      if (!session) return { text: "" };
      captureSessions.delete(id);
      return session.stop();
    },
    pushChunk: (id: string, base64Pcm16: string): void => {
      captureSessions.get(id)?.pushChunk(base64Pcm16);
    },
  };

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
    settings: {
      get: () => settingsStore.get(),
      // Re-register global shortcuts when the dictation hotkey changes, so an edit in Settings takes
      // effect live (without this, registerHotkeys only re-ran on transform edits and the new key
      // stayed dead until restart).
      patch: (patch) => {
        const before = settingsStore.get().values["hotkey.dictation"];
        const next = settingsStore.patch(patch);
        if (next.values["hotkey.dictation"] !== before) onHotkeysChanged();
        return next;
      },
    },
    inference: createInferenceService(inferenceRuntime.engine, router),
    transcription: transcriptionService,
    connections: {
      list: () => connectionStore.list(),
      upsert: (profile) => {
        // Fail-closed: refuse to persist a cleartext (non-loopback http) endpoint that would leak
        // the API key and audio/text on the wire.
        if (!isEndpointAllowed(profile.baseEndpoint)) {
          throw ipcError(
            "validation",
            "Endpoint must use https:// (http is allowed only for localhost).",
          );
        }
        return connectionStore.upsert(profile);
      },
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
        if (collection === "transforms") onHotkeysChanged();
      },
    },
    models: {
      status: () => modelService.status(),
      compatibility: () =>
        buildModelCompatibilityReport({
          hardware: detectHardwareProfile(modelsDir),
          runtimes: runtimeStatuses(),
          statuses: modelService.status(),
        }),
      readiness: () =>
        buildModelReadiness({
          statuses: modelService.status(),
          runtimes: runtimeStatuses(),
          selectedModelIds: selectedModelIds(),
          activeModelIds: activeModelIds(),
        }),
      active: () =>
        buildActiveModelReport({
          readiness: buildModelReadiness({
            statuses: modelService.status(),
            runtimes: runtimeStatuses(),
            selectedModelIds: selectedModelIds(),
            activeModelIds: activeModelIds(),
          }),
          selectedModelIds: selectedModelIds(),
          activeModelIds: activeModelIds(),
        }),
      prepare: async (id) => {
        const status = modelService.status().find((s) => s.id === id);
        if (!status) return;
        emitRuntime({ modelId: id, kind: status.kind, state: "starting", message: `Loading ${status.name}...` });
        const ready = status.state === "installed" && status.engineReady;
        if (ready && status.kind === "llm") {
          const mode = await inferenceRuntime.prepareModel(id);
          const switched = mode !== "stub";
          emitRuntime({
            modelId: id,
            kind: status.kind,
            state: switched ? "ready" : "failed",
            message: switched ? `${status.name} is ready.` : `${status.name} could not be loaded.`,
            activeModelId: switched ? id : undefined,
          });
          return;
        }
        emitRuntime({
          modelId: id,
          kind: status.kind,
          state: ready ? "ready" : "failed",
          message: ready ? `${status.name} is ready.` : `${status.name} is not ready yet.`,
          activeModelId: ready ? id : undefined,
        });
      },
      download: (id) => modelService.download(id),
      cancel: (id) => modelService.cancel(id),
      verify: (id) => modelService.verify(id),
      remove: (id) => modelService.remove(id),
      storage: () => modelService.storage(),
    },
    capture: {
      start: () => captureManager.start(),
      stop: (id) => captureManager.stop(id),
    },
  });

  return { dispatch, contentStore, settingsStore, captureManager };

  function selectedModelIds(): { stt?: string; llm?: string } {
    const values = settingsStore.get().values;
    return { stt: values["stt.dictation.model"], llm: values["llm.chat.model"] };
  }

  function activeModelIds(): { stt?: string; llm?: string } {
    const selected = selectedModelIds();
    const status = modelService.status();
    const active = (kind: "stt" | "llm") => {
      if (kind === "llm") {
        const runtimeActive = inferenceRuntime.activeModelId();
        if (runtimeActive) return runtimeActive;
      }
      const id = selected[kind];
      const row = id ? status.find((s) => s.id === id) : undefined;
      return row?.state === "installed" && row.engineReady ? id : undefined;
    };
    return { stt: active("stt"), llm: active("llm") };
  }

  function runtimeStatuses() {
    return [
      {
        engine: "whisper" as const,
        state: engineReady("whisper") ? "ready" as const : "missing" as const,
        message: engineReady("whisper") ? "Speech runtime ready." : "Speech runtime missing. Khonjel can download it.",
      },
      {
        engine: "llama" as const,
        state: engineReady("llama") ? "ready" as const : "missing" as const,
        message: engineReady("llama") ? "Language runtime ready." : "Language runtime missing. Khonjel can download it.",
      },
      {
        engine: "parakeet" as const,
        state: "unsupported" as const,
        message: "Parakeet local runtime is not bundled yet.",
      },
    ];
  }

  function emitRuntime(event: { modelId: string; kind: "stt" | "llm"; state: "starting" | "ready" | "fallback" | "failed"; message: string; activeModelId?: string }): void {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) win.webContents.send("khonjel:model-runtime", event);
    }
  }
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

  // External links open in the OS browser, never inside the app window. Only https is forwarded, so a
  // crafted file:/custom-scheme link cannot be used to launch an arbitrary local handler.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) void shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

void app.whenReady().then(() => {
  let selectedLlmModelId = (): string | undefined => undefined;
  inferenceRuntime = createInferenceRuntime({
    userDataDir: app.getPath("userData"),
    appDir: path.join(__dirname, ".."),
    isWindows: process.platform === "win32",
    env: process.env,
    selectedModelId: () => selectedLlmModelId(),
  });
  hotkeyManager = createHotkeyManager();
  const built = buildDispatch(inferenceRuntime, () => registerHotkeys());
  selectedLlmModelId = () => built.settingsStore.get().values["llm.chat.model"];
  // The single allow-listed request/response bridge. The preload sends the contract version on
  // every call (rejected on mismatch); `dispatch` then validates channel + payload (unknown
  // channel -> not_found; bad payload -> validation). Together these are the allow-list.
  ipcMain.handle("khonjel:invoke", async (event, version: unknown, channel: string, args: unknown[]) => {
    if (!isTrustedSender(event)) throw ipcError("unauthorized", "Untrusted IPC sender.");
    checkContractVersion(version);
    const result = await built.dispatch(channel, ...(Array.isArray(args) ? args : []));
    // A new dictation just landed in history: tell every window so live views (Home) refresh now,
    // not on the next reload or view switch — including captures made from the floating bar window.
    if (channel === CHANNELS.contentAddHistory) {
      for (const win of BrowserWindow.getAllWindows()) {
        win.webContents.send("khonjel:content-changed", "history");
      }
    }
    return result;
  });

  // High-rate audio frames for a streaming capture session bypass the typed dispatch (no per-chunk
  // zod). The session segments + transcribes them and broadcasts a live transcript (12 §2A).
  ipcMain.on("khonjel:capture-chunk", (event, sessionId: unknown, base64Pcm16: unknown) => {
    if (!isTrustedSender(event)) return;
    // High-rate channel that bypasses the typed zod dispatch: enforce basic shape + a per-chunk size
    // cap so a buggy or hostile renderer cannot push non-strings or exhaust memory. Unknown sessions
    // are ignored by the capture manager downstream.
    if (typeof sessionId !== "string" || typeof base64Pcm16 !== "string") return;
    if (base64Pcm16.length > 4_000_000) return;
    built.captureManager.pushChunk(sessionId, base64Pcm16);
  });

  // Live mic capture (dictation + the floating bar) issues a getUserMedia permission request. This
  // is a local, on-device dictation app, so grant microphone/media access; deny everything else.
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(permission === "media");
  });
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => permission === "media");

  // Lock navigation to our own origin so a compromised or redirected renderer can never load remote
  // content that would inherit the preload bridge. New windows are already denied via the window-open
  // handler; this closes the top-level navigation path (Electron checklist #13).
  app.on("web-contents-created", (_event, contents) => {
    const allowed = (url: string): boolean =>
      url.startsWith("file://") || (!app.isPackaged && url.startsWith("http://localhost:5173"));
    contents.on("will-navigate", (navEvent, url) => {
      if (!allowed(url)) navEvent.preventDefault();
    });
    contents.on("will-redirect", (navEvent, url) => {
      if (!allowed(url)) navEvent.preventDefault();
    });
  });

  // Apply OS startup preferences from settings. Only meaningful for the packaged app (in dev the
  // executable is electron.exe, so registering a login item would point at the wrong binary).
  const boot = built.settingsStore.get();
  const startMinimized = boot.toggles.startMinimized ?? false;
  if (app.isPackaged) {
    app.setLoginItemSettings({
      openAtLogin: boot.toggles.launchAtLogin ?? false,
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
        // The bar lives hidden/non-focusable; without this Chromium throttles its renderer (frozen
        // waveform, delayed hotkey IPC) so it looks unresponsive and won't dismiss on some machines.
        backgroundThrottling: false,
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

  // The dictation hotkey is a session toggle: the first press shows the bar (when the HUD is on) and
  // starts a capture; the next press ends it. `dictationActive` tracks the session so this also works
  // when the HUD preview is off (there is no window visibility to toggle on). Reset when the bar idles.
  let dictationActive = false;
  function triggerDictation(): void {
    if (!dictationActive) {
      dictationActive = true;
      const preview = built.settingsStore.get().toggles["stt.dictation.preview"] ?? true;
      if (preview) showFloatingBar();
      floatingBarWindow?.webContents.send("khonjel:hotkey", "dictation:start");
    } else {
      dictationActive = false;
      floatingBarWindow?.webContents.send("khonjel:hotkey", "dictation:stop");
    }
  }

  // The accelerator currently bound as the live global dictation shortcut (what register() actually
  // committed) — surfaced to the EDD harness to gate that the advertised hotkey is the live one.
  let liveDictationAccelerator: string | null = null;

  // The bar reports returning to idle (after injecting, or a failed/aborted capture); end the
  // session and auto-hide it if enabled.
  ipcOn("floating:idle", () => {
    dictationActive = false;
    const autoHide = built.settingsStore.get().toggles.floatingAutoHide ?? true;
    if (autoHide) floatingBarWindow?.hide();
  });

  // The bar reports when the mic is actually recording, so other system audio can be muted for a
  // clean capture (gated by the "pause media" setting) and reliably restored when recording stops.
  ipcOn("recording:active", (_event, active: unknown) => {
    if (active) {
      if (built.settingsStore.get().toggles.pauseMedia ?? true) setDictationMute(true);
    } else {
      setDictationMute(false); // always restore on stop, regardless of the setting
    }
  });

  // Eval-only hook: Playwright can't press a global shortcut, so the EDD harness calls this to
  // exercise the real hotkey -> show-bar -> record path. Never installed outside the eval.
  if (process.env.KHONJEL_EVAL === "1") {
    const evalGlobal = globalThis as unknown as {
      __khonjelTriggerDictation?: () => void;
      __khonjelMuteState?: () => boolean;
      __khonjelHotkeyStatus?: () => {
        configured: string;
        normalized: string;
        live: string | null;
        registered: boolean;
      };
    };
    evalGlobal.__khonjelTriggerDictation = () => triggerDictation();
    // Probe whether a live capture is currently muting other system audio.
    evalGlobal.__khonjelMuteState = () => dictationMuted;
    // Truth-in-advertising probe: is the user-facing dictation hotkey the one actually bound?
    evalGlobal.__khonjelHotkeyStatus = () => {
      const configured =
        built.settingsStore.get().values["hotkey.dictation"] ?? DEFAULT_DICTATION_HOTKEY;
      return {
        configured,
        normalized: normalizeAccelerator(configured),
        live: liveDictationAccelerator,
        registered: liveDictationAccelerator
          ? globalShortcut.isRegistered(liveDictationAccelerator)
          : false,
      };
    };
  }

  // Register the global dictation hotkey + each opted-in transform hotkey. Re-runs whenever the
  // renderer edits transforms (content:replace) or changes the dictation hotkey (settings:patch).
  // register() clears all shortcuts first, so dictation is rebound before the transforms are layered
  // on via registerExtra.
  function registerHotkeys(): void {
    if (!hotkeyManager) return;
    const snapshot = built.settingsStore.get();
    let dictationSetting = snapshot.values["hotkey.dictation"] ?? DEFAULT_DICTATION_HOTKEY;
    // Self-heal a persisted hotkey the OS can never bind (e.g. an old "Ctrl+Win" saved before the
    // default was made registrable). Without this, a stale modifier-only value overrides the default
    // forever and the advertised hotkey stays dead. Patch the durable store (raw, no re-register) so
    // the renderer adopts the corrected value and what the user sees is what is actually bound.
    if (!isRegistrableAccelerator(dictationSetting)) {
      dictationSetting = DEFAULT_DICTATION_HOTKEY;
      built.settingsStore.patch({ values: { "hotkey.dictation": dictationSetting } });
    }
    const live = hotkeyManager.register(dictationSetting, () => {
      triggerDictation();
    });
    liveDictationAccelerator = live;
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
  if (dictationMuted) win32.setSystemMuteSync(false);
  inferenceRuntime?.stop();
  hotkeyManager?.unregisterAll();
  floatingBarWindow?.destroy();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// Frameless window controls (sender-guarded).
ipcOn("window:minimize", () => mainWindow?.minimize());
ipcOn("window:toggle-maximize", () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});
ipcOn("window:close", () => mainWindow?.close());

// System / diagnostics controls (Settings -> System).
ipcOn("app:version", (event) => {
  event.returnValue = app.getVersion();
});
ipcOn("system:open-devtools", () => {
  // DevTools can inspect in-memory transcripts and keys; keep it out of packaged builds unless an
  // explicit debug flag/env is set.
  if (app.isPackaged && process.env.KHONJEL_DEBUG !== "1" && !process.argv.includes("--debug")) return;
  mainWindow?.webContents.openDevTools({ mode: "detach" });
});
ipcOn("system:open-logs", () => {
  void shell.openPath(app.getPath("logs"));
});
ipcOn("system:open-models", () => {
  const dir = path.join(app.getPath("userData"), "models");
  mkdirSync(dir, { recursive: true });
  void shell.openPath(dir);
});
ipcOn("system:clear-cache", () => {
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
ipcOn("system:reset-data", () => {
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
