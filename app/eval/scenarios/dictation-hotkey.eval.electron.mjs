import { test, expect, _electron as electron } from "@playwright/test";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";

/**
 * EDD under real Electron — the dictation **global hotkey** is honest and live.
 *
 * The core promise of the app is "press the dictation hotkey anywhere → speak → text at your
 * cursor." That promise silently broke when the advertised default (`Ctrl+Win`) was a modifier-only
 * chord Electron's `globalShortcut` can never bind: `register()` fell back to a *different*
 * accelerator, so the key shown in the UI did nothing. The browser/mock evals never caught it
 * because they drive `__khonjelTriggerDictation` directly, bypassing the real OS registration.
 *
 * This scenario gates the real seam:
 *   1. the accelerator the UI advertises (`hotkey.dictation`) is the one actually registered;
 *   2. changing the hotkey through the live settings seam re-registers it (no restart needed);
 *   3. a modifier-only chord is rejected, not silently swapped for a dead binding;
 *   4. the registered path still drives the floating bar into "listening".
 *
 * Global shortcuts can't be pressed from Playwright, so the main process exposes the *result* of
 * registration (`__khonjelHotkeyStatus`) and the trigger path (`__khonjelTriggerDictation`) under
 * KHONJEL_EVAL — observation of the exact code the real OS shortcut runs, not a re-implementation.
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

/** The result of the live global-shortcut registration, read from the main process. */
function hotkeyStatus(app) {
  return app.evaluate(() => globalThis.__khonjelHotkeyStatus?.());
}

function barWindowProps(app) {
  return app.evaluate(({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows().find((win) =>
      win.webContents.getURL().includes("surface=floating-bar"),
    );
    return w ? { visible: w.isVisible() } : null;
  });
}

test("dictation hotkey: the advertised key is the one actually registered, edits re-register, and it drives the bar", async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "khonjel-eval-hotkey-"));
  const app = await electron.launch(launchOpts(userDataDir));
  const main = await findWindow(app, isMain);
  await main.waitForSelector('[data-eval="app-shell"][data-eval-ready="true"]');

  // ---- 1) The default dictation hotkey is honest: advertised === live === actually registered ----
  const status = await hotkeyStatus(app);
  expect(status, "main exposes the live hotkey status under KHONJEL_EVAL").not.toBeNull();
  expect(
    status.registered,
    `the advertised dictation hotkey "${status.configured}" must be a live global shortcut, not a silent fallback`,
  ).toBe(true);
  expect(
    status.live,
    "the registered accelerator must equal the normalized advertised setting (no silent divergence)",
  ).toBe(status.normalized);

  // The advertised hotkey advertised to users in the renderer must match what is bound.
  const advertised = await main.evaluate(() => window.khonjel.invoke("settings:get"));
  expect(advertised.values["hotkey.dictation"]).toBe(status.configured);

  // ---- 2) A modifier-only chord can never persist as a dead hotkey: it self-heals ----
  // Try to set the exact regression value. The app must refuse to leave dictation unbound — it
  // heals "Ctrl+Win" back to a registrable, live default, and what settings reports matches what's
  // actually registered (never an advertised-but-dead key).
  await main.evaluate(() =>
    window.khonjel.invoke("settings:patch", { values: { "hotkey.dictation": "Ctrl+Win" } }),
  );
  await expect.poll(async () => (await hotkeyStatus(app))?.registered, { timeout: 5000 }).toBe(true);
  const healed = await hotkeyStatus(app);
  expect(
    healed.configured,
    "an unregistrable chord must not survive as the configured hotkey",
  ).not.toBe("Ctrl+Win");
  expect(healed.registered, "after healing, a live hotkey is bound").toBe(true);
  expect(healed.live, "the healed hotkey is advertised exactly as it is bound").toBe(healed.normalized);
  const persisted = await main.evaluate(() => window.khonjel.invoke("settings:get"));
  expect(persisted.values["hotkey.dictation"]).toBe(healed.configured);

  // ---- 3) Editing to a registrable chord through the live seam re-registers it (no restart) ----
  await main.evaluate(() =>
    window.khonjel.invoke("settings:patch", { values: { "hotkey.dictation": "Ctrl+Alt+J" } }),
  );
  await expect
    .poll(async () => (await hotkeyStatus(app))?.registered, { timeout: 5000 })
    .toBe(true);
  const edited = await hotkeyStatus(app);
  expect(edited.configured).toBe("Ctrl+Alt+J");
  expect(edited.live).toBe("Control+Alt+J");

  // ---- 4) The registered path still drives the floating bar into listening ----
  const bar = await findWindow(app, isBar);
  await bar.waitForSelector('button[aria-label="Start dictation"]');
  await app.evaluate(() => globalThis.__khonjelTriggerDictation?.());
  await expect
    .poll(async () => (await barWindowProps(app))?.visible, { timeout: 5000 })
    .toBe(true);
  await expect(bar.locator('button[aria-label="Stop dictation"]')).toBeVisible({ timeout: 8000 });
  await expect(bar.getByText("Listening")).toBeVisible();

  await app.close();
  fs.rmSync(userDataDir, { recursive: true, force: true });
});
