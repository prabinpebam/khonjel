import { test, expect, _electron as electron } from "@playwright/test";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";

/**
 * EDD under real Electron — local model setup / hardware readiness.
 *
 * Verifies the consumer-grade setup surface is backed by the real main-process compatibility seam:
 * the app can detect hardware without crashing, return model recommendations/readiness, and render
 * the setup panel in Settings with unsupported local models hidden until the user asks for them.
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

test("local model setup: real Electron reports hardware compatibility and renders clear setup guidance", async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "khonjel-eval-local-models-"));
  const app = await electron.launch({
    args: [APP_DIR, `--user-data-dir=${userDataDir}`],
    env: { ...process.env, KHONJEL_LOAD_DIST: "1" },
  });

  try {
    const page = await findMain(app);
    await page.waitForSelector('[data-eval="app-shell"][data-eval-ready="true"]');

    const report = await page.evaluate(() => window.khonjel.invoke("models:compatibility"));
    expect(report.hardware.os).toMatch(/win32|darwin|linux/);
    expect(report.hardware.arch.length).toBeGreaterThan(0);
    expect(Array.isArray(report.models)).toBe(true);
    expect(report.models.some((m) => m.kind === "stt")).toBe(true);
    expect(report.models.some((m) => m.kind === "llm")).toBe(true);
    expect(report.models.some((m) => m.level === "unsupported")).toBe(true);

    const readiness = await page.evaluate(() => window.khonjel.invoke("models:readiness"));
    expect(Array.isArray(readiness)).toBe(true);
    expect(readiness.length).toBeGreaterThan(0);

    await page.locator('button[aria-label="Settings"]').first().click();
    const modal = page.locator('[data-eval="settings-modal"]');
    await modal.waitFor();
    await modal.getByRole("button", { name: "Speech-to-Text" }).click();

    const setup = modal.locator('[data-eval="local-model-setup"]').first();
    await expect(setup).toBeVisible();
    await expect(setup.getByText("Private local model setup")).toBeVisible();
    await expect(setup.locator('[data-eval="hardware-summary"]')).toContainText(/local models/i);
    await expect(modal.getByText(/Private/).first()).toBeVisible();

    await modal.getByRole("button", { name: /Show .* unavailable or advanced models/ }).click();
    await expect(modal.getByText(/Parakeet TDT/)).toBeVisible();
    await expect(modal.getByText(/Not supported|not bundled/i).first()).toBeVisible();
  } finally {
    await app.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
});
