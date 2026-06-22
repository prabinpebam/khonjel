import { test, expect, _electron as electron } from "@playwright/test";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import { pressChord, pressEscape } from "../recorder/os-input.mjs";

/**
 * EDD under real Electron — does pressing the dictation hotkey **actually** start dictation?
 *
 * This scenario injects a **real OS key chord** via Win32 `SendInput` and lets Electron's
 * system-wide `globalShortcut` route it — the path a user's keypress takes.
 *
 *   POSITIVE — really press the live registrable hotkey → the bar appears and shows "Listening".
 *   NEGATIVE — really press Ctrl+Win → the bar must NOT appear (a modifier-only chord the OS can
 *              never deliver; this is *why* Ctrl+Win never worked, and the app self-heals it away).
 *
 * IMPORTANT — opt-in only (`KHONJEL_REALKEY=1`). Electron's `globalShortcut` is backed by Win32
 * `RegisterHotKey`, which fires for genuine hardware key events but does **not** reliably trigger on
 * *synthetic* injected input in an automated context. So this is a manual smoke tool, not a
 * committed gate. The deterministic gate that proves the hotkey is honestly bound and drives the bar
 * lives in `dictation-hotkey.eval.electron.mjs` (it asserts the real `globalShortcut.isRegistered`
 * state and exercises the exact handler the OS shortcut invokes).
 *
 * Run it yourself:  $env:KHONJEL_REALKEY=1; npm run eval:electron -- dictation-hotkey-realkey
 * Requires Windows, an interactive desktop, and no other Khonjel instance holding the shortcut.
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

const hotkeyStatus = (app) => app.evaluate(() => globalThis.__khonjelHotkeyStatus?.());
const barVisible = (app) =>
  app.evaluate(({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows().find((win) =>
      win.webContents.getURL().includes("surface=floating-bar"),
    );
    return w ? w.isVisible() : false;
  });

test.skip(
  process.platform !== "win32" || process.env.KHONJEL_REALKEY !== "1",
  "real key injection is a Windows-only, opt-in manual smoke tool (set KHONJEL_REALKEY=1)",
);

test("dictation hotkey, pressed for real: Ctrl+Win does nothing; the live chord starts dictation", async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "khonjel-eval-realkey-"));
  const app = await electron.launch(launchOpts(userDataDir));
  const main = await findWindow(app, isMain);
  await main.waitForSelector('[data-eval="app-shell"][data-eval-ready="true"]');
  const bar = await findWindow(app, isBar);
  await bar.waitForSelector('button[aria-label="Start dictation"]');

  // The app boots with a live, registrable dictation hotkey (the default).
  const status = await hotkeyStatus(app);
  expect(
    status.registered,
    `the default dictation hotkey must be live (is another Khonjel instance holding it?) — live=${status.live}`,
  ).toBe(true);
  expect(status.live).toBe("Control+Shift+Space");
  expect(await barVisible(app), "bar starts hidden").toBe(false);

  // ---- POSITIVE: a real press of the live hotkey starts dictation, OS-routed end to end ----
  pressChord("Control+Shift+Space");
  await expect.poll(() => barVisible(app), { timeout: 6000 }).toBe(true);
  await expect(bar.locator('button[aria-label="Stop dictation"]')).toBeVisible({ timeout: 8000 });
  await expect(bar.getByText("Listening")).toBeVisible();

  // Reset to idle: press the hotkey again (toggles recording off) and let it auto-hide.
  pressChord("Control+Shift+Space");
  await expect.poll(() => barVisible(app), { timeout: 6000 }).toBe(false);

  // ---- NEGATIVE: a real Ctrl+Win press does nothing — it is not (and cannot be) the hotkey ----
  pressChord("Control+Super");
  await app.evaluate(() => new Promise((r) => setTimeout(r, 1200)));
  const shownByWin = await barVisible(app);
  pressEscape(); // dismiss any Start menu a lone Win keyup may have surfaced
  expect(
    shownByWin,
    "pressing Ctrl+Win must NOT start dictation (the OS never delivers a modifier-only chord)",
  ).toBe(false);

  await app.close();
  fs.rmSync(userDataDir, { recursive: true, force: true });
});
