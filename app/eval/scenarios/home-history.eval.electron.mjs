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

test("home feed: renders one page and loads more on scroll (infinite scroll)", async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "khonjel-eval-feed-"));
  const app = await electron.launch({
    args: [APP_DIR, `--user-data-dir=${userDataDir}`],
    env: { ...process.env, KHONJEL_LOAD_DIST: "1" },
  });

  try {
    const page = await findMain(app);
    await page.waitForSelector('[data-eval="app-shell"][data-eval-ready="true"]');

    const TOTAL = 50;
    const id = (n) => `khonjel-feed-entry-${String(n).padStart(3, "0")}`;

    // Seed more than one page of history (newest is added last, so it lands at the top of the feed).
    await page.evaluate(async (total) => {
      const pad = (n) => String(n).padStart(3, "0");
      for (let i = 1; i <= total; i++) {
        await window.khonjel.invoke("content:addHistory", {
          finalText: `khonjel-feed-entry-${pad(i)}`,
          app: "Khonjel",
          language: "auto",
          durationSec: 1,
          mode: "dictation",
          hasAudio: false,
          cleanupApplied: false,
        });
      }
    }, TOTAL);

    // Remount Home fresh so the feed starts at exactly one page (deterministic — no scroll yet).
    await page.reload();
    await page.waitForSelector('[data-eval="app-shell"][data-eval-ready="true"]');

    // The newest entry is on screen, but the feed is windowed: only the first page is in the DOM.
    await expect(page.getByText(id(TOTAL))).toBeVisible();
    const rows = page.locator('[data-eval="history-row"]');
    const initial = await rows.count();
    expect(initial, "only the first page is rendered, not all entries").toBeLessThan(TOTAL);
    await expect(
      page.getByText(id(30)),
      "an entry just past the first page is not in the DOM yet",
    ).toHaveCount(0);
    await expect(page.locator('[data-eval="history-sentinel"]')).toBeVisible();

    // Scroll the content panel to the end: the sentinel comes into view and the next page loads.
    await page.locator('[data-eval="content"]').evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });

    await expect(
      page.getByText(id(30)),
      "scrolling to the end loads older entries (infinite scroll)",
    ).toHaveCount(1);
    expect(await rows.count(), "more rows are rendered after scrolling").toBeGreaterThan(initial);
  } finally {
    await app.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
});
