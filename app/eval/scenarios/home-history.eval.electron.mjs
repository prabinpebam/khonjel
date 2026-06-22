import { test, expect, _electron as electron } from "@playwright/test";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";

/**
 * EDD under real Electron — Home history updates live.
 *
 * Proves the home page reflects a new dictation the instant it lands in history, with no reload and
 * no view switch. We add an entry the way a capture from another surface (e.g. the floating-bar
 * window) would — a direct `content:addHistory` IPC call, NOT via the React content service — then
 * assert its text shows up on Home. That can only happen if main's "content-changed" broadcast
 * reaches Home's live subscription and triggers a refetch.
 */
const APP_DIR = path.resolve(import.meta.dirname, "..", "..");

async function findMain(app) {
  for (let i = 0; i < 60; i++) {
    const win = app
      .windows()
      .find((w) => w.url().includes("index.html") && !w.url().includes("surface=floating-bar"));
    if (win) return win;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("main window never appeared");
}

test("home: a new dictation appears in history live, without a reload or view switch", async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "khonjel-eval-home-"));
  const app = await electron.launch({
    args: [APP_DIR, `--user-data-dir=${userDataDir}`],
    env: { ...process.env, KHONJEL_LOAD_DIST: "1" },
  });

  try {
    const page = await findMain(app);
    await page.waitForSelector('[data-eval="app-shell"][data-eval-ready="true"]');

    // Stay on Home (the default view) for the whole test — we never navigate or reload.
    const unique = `Realtime history probe ${Date.now()}`;
    await expect(
      page.getByText(unique),
      "the probe text is absent before we add it",
    ).toHaveCount(0);

    // Add a history entry the way a capture from another surface would: a direct IPC call.
    // Going through window.khonjel.invoke (not the React content service) means the ONLY thing
    // that can surface it on Home is the main-process broadcast feeding Home's live subscription.
    const draft = {
      finalText: unique,
      app: "Khonjel",
      language: "auto",
      durationSec: 1,
      mode: "dictation",
      hasAudio: false,
      cleanupApplied: false,
    };
    await page.evaluate(async (d) => {
      await window.khonjel.invoke("content:addHistory", d);
    }, draft);

    // Without any navigation or reload, Home must now show the new entry.
    await expect(
      page.getByText(unique),
      "Home refreshed live the instant the dictation landed in history",
    ).toBeVisible();
  } finally {
    await app.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
});
