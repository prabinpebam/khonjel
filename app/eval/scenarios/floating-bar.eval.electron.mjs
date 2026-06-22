import { test, expect, _electron as electron } from "@playwright/test";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";

/**
 * EDD under real Electron — the floating dictation bar (the app's core capture surface).
 *
 * Validates against the ACTUAL Electron app (not the browser mock): a second, always-on-top,
 * non-focusable bar window exists; the dictation hotkey path shows it; and driving that path starts
 * mic capture (a fake device is injected so getUserMedia resolves headlessly). Global shortcuts
 * can't be pressed from Playwright, so the main process exposes `__khonjelTriggerDictation` under
 * KHONJEL_EVAL to exercise the exact same show-bar + relay-hotkey code the real shortcut runs.
 */
const APP_DIR = path.resolve(import.meta.dirname, "..", "..");

function launchOpts(userDataDir) {
  return {
    args: [
      APP_DIR,
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      `--user-data-dir=${userDataDir}`,
    ],
    env: { ...process.env, KHONJEL_LOAD_DIST: "1", KHONJEL_EVAL: "1" },
  };
}

/** Poll the open windows for the one whose URL matches (visible or hidden). */
async function findWindow(app, match) {
  for (let i = 0; i < 60; i++) {
    const win = app.windows().find((w) => match(w.url()));
    if (win) return win;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("expected window never appeared");
}

const isBar = (url) => url.includes("surface=floating-bar");
const isMain = (url) => url.includes("index.html") && !isBar(url);

/** Read the bar window's main-process properties (config that can't be seen from the DOM). */
function barWindowProps(app) {
  return app.evaluate(({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows().find((win) =>
      win.webContents.getURL().includes("surface=floating-bar"),
    );
    return w ? { alwaysOnTop: w.isAlwaysOnTop(), focusable: w.isFocusable(), visible: w.isVisible() } : null;
  });
}

test("floating bar: an always-on-top, non-focusable capture window exists and the hotkey drives it", async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "khonjel-eval-floating-"));

  const app = await electron.launch(launchOpts(userDataDir));
  const main = await findWindow(app, isMain);
  await main.waitForSelector('[data-eval="app-shell"][data-eval-ready="true"]');

  // ---- The bar window exists and is configured to never steal focus ----
  const bar = await findWindow(app, isBar);
  await bar.waitForSelector('button[aria-label="Start dictation"]');
  const props = await barWindowProps(app);
  expect(props, "the floating bar window exists").not.toBeNull();
  expect(props.alwaysOnTop, "bar floats above other windows").toBe(true);
  expect(props.focusable, "bar never takes focus (so injection targets the real app)").toBe(false);

  // ---- The bar surface is transparent: no opaque page fill paints behind the pill ----
  const pageBg = await bar.evaluate(() => {
    const rgba = (el) => getComputedStyle(el).backgroundColor;
    const isClear = (c) => c === "rgba(0, 0, 0, 0)" || c === "transparent";
    return {
      html: rgba(document.documentElement),
      body: rgba(document.body),
      root: rgba(document.getElementById("root")),
      allClear: [document.documentElement, document.body, document.getElementById("root")].every(
        (el) => isClear(rgba(el)),
      ),
    };
  });
  expect(
    pageBg.allClear,
    `bar page layers must be transparent so the window's transparency shows through — got ${JSON.stringify(pageBg)}`,
  ).toBe(true);

  // ---- The dictation hotkey path shows the bar and starts recording ----
  // (Equivalent to pressing the global shortcut; a fake mic makes getUserMedia resolve.)
  await app.evaluate(() => globalThis.__khonjelTriggerDictation?.());

  await expect
    .poll(async () => (await barWindowProps(app))?.visible, { timeout: 5000 })
    .toBe(true);

  await expect(bar.locator('button[aria-label="Stop dictation"]')).toBeVisible({ timeout: 8000 });
  await expect(bar.getByText("Listening")).toBeVisible();

  await app.close();
  fs.rmSync(userDataDir, { recursive: true, force: true });
});

test("floating bar: a failed capture (no STT model) still dismisses on the second hotkey press", async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "khonjel-eval-floating-dismiss-"));
  const app = await electron.launch({
    args: [
      APP_DIR,
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      `--user-data-dir=${userDataDir}`,
    ],
    // KHONJEL_EVAL_NO_STT makes transcription report model_unavailable — i.e. a device with no
    // on-device model downloaded (the exact difference that made the bar stick on one machine).
    env: { ...process.env, KHONJEL_LOAD_DIST: "1", KHONJEL_EVAL: "1", KHONJEL_EVAL_NO_STT: "1" },
  });

  const main = await findWindow(app, isMain);
  await main.waitForSelector('[data-eval="app-shell"][data-eval-ready="true"]');
  const bar = await findWindow(app, isBar);
  await bar.waitForSelector('button[aria-label="Start dictation"]');

  // First press: the bar appears and starts recording (a fake mic makes getUserMedia resolve).
  await app.evaluate(() => globalThis.__khonjelTriggerDictation?.());
  await expect.poll(async () => (await barWindowProps(app))?.visible, { timeout: 5000 }).toBe(true);
  await expect(bar.getByText("Listening")).toBeVisible({ timeout: 8000 });

  // Second press: stop -> transcription fails (no model) -> the bar must STILL dismiss. (The bug:
  // it hid only on success, so a failed capture left it stuck on screen and the hotkey never
  // dismissed it.)
  await app.evaluate(() => globalThis.__khonjelTriggerDictation?.());
  await expect
    .poll(async () => (await barWindowProps(app))?.visible, { timeout: 12000 })
    .toBe(false);

  await app.close();
  fs.rmSync(userDataDir, { recursive: true, force: true });
});

test("floating bar: recording mutes other system audio and stopping restores it", async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "khonjel-eval-floating-mute-"));
  // KHONJEL_EVAL records the mute INTENT but skips the real Win32 mute, so the suite never mutes
  // the machine running it — we assert the wiring (recording -> mute, stop -> restore).
  const app = await electron.launch(launchOpts(userDataDir));

  const main = await findWindow(app, isMain);
  await main.waitForSelector('[data-eval="app-shell"][data-eval-ready="true"]');
  const bar = await findWindow(app, isBar);
  await bar.waitForSelector('button[aria-label="Start dictation"]');

  const muteState = () => app.evaluate(() => globalThis.__khonjelMuteState?.() ?? null);
  expect(await muteState(), "nothing is muted before recording").toBe(false);

  // Start recording -> other system audio is muted.
  await app.evaluate(() => globalThis.__khonjelTriggerDictation?.());
  await expect(bar.getByText("Listening")).toBeVisible({ timeout: 8000 });
  await expect.poll(muteState, { timeout: 5000 }).toBe(true);

  // Stop recording -> audio is restored immediately (not only after transcription).
  await app.evaluate(() => globalThis.__khonjelTriggerDictation?.());
  await expect.poll(muteState, { timeout: 8000 }).toBe(false);

  await app.close();
  fs.rmSync(userDataDir, { recursive: true, force: true });
});
