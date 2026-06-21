import { test, expect, _electron as electron } from "@playwright/test";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";

/**
 * EDD under real Electron — Settings -> System diagnostics.
 *
 * Validates that the System section shows the REAL app version (not the old hardcoded "0.1.0-mock")
 * and that the "Open DevTools" button actually opens the developer tools (asserted via the main
 * process). Confirms the previously-dead System buttons are wired to real main-process actions.
 */
const APP_DIR = path.resolve(import.meta.dirname, "..", "..");
const PKG_VERSION = JSON.parse(fs.readFileSync(path.join(APP_DIR, "package.json"), "utf8")).version;

function launchOpts(userDataDir) {
  return {
    args: [APP_DIR, `--user-data-dir=${userDataDir}`],
    env: { ...process.env, KHONJEL_LOAD_DIST: "1" },
  };
}

async function findMain(app) {
  for (let i = 0; i < 60; i++) {
    const win = app.windows().find((w) => w.url().includes("index.html") && !w.url().includes("surface=floating-bar"));
    if (win) return win;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("main window never appeared");
}

function mainDevToolsOpen(app) {
  return app.evaluate(({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows().find(
      (win) =>
        win.webContents.getURL().includes("index.html") &&
        !win.webContents.getURL().includes("surface=floating-bar"),
    );
    return w ? w.webContents.isDevToolsOpened() : false;
  });
}

test("system settings: shows the real app version and the DevTools button works", async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "khonjel-eval-system-"));

  const app = await electron.launch(launchOpts(userDataDir));
  const page = await findMain(app);
  await page.waitForSelector('[data-eval="app-shell"][data-eval-ready="true"]');

  await page.locator('button[aria-label="Settings"]').first().click();
  const modal = page.locator('[data-eval="settings-modal"]');
  await modal.waitFor();
  await modal.getByRole("button", { name: "System" }).click();

  // Real package version is shown; the old hardcoded mock string is gone.
  await expect(modal.getByText(`Khonjel ${PKG_VERSION}`)).toBeVisible();
  await expect(modal.getByText("0.1.0-mock")).toHaveCount(0);

  // The DevTools button is wired to a real main-process action.
  expect(await mainDevToolsOpen(app), "devtools start closed").toBe(false);
  await modal.getByRole("button", { name: "Open DevTools" }).click();
  await expect.poll(() => mainDevToolsOpen(app), { timeout: 5000 }).toBe(true);

  await app.close();
  fs.rmSync(userDataDir, { recursive: true, force: true });
});
