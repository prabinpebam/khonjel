import { test, expect, _electron as electron } from "@playwright/test";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";

/**
 * EDD (BE4) under real Electron — GPU acceleration (gpu-acceleration 06 §4).
 *
 * Proves against the ACTUAL app + live IPC seam (not the mock):
 *  - real hardware detection runs and NEVER crashes the app (any vendor, including "unknown");
 *  - the acceleration state is honest (CPU by default; valid shape);
 *  - mode changes persist;
 *  - enabling a GPU backend fails GRACEFULLY (pin-gated) and keeps the app on the CPU.
 */
const APP_DIR = path.resolve(import.meta.dirname, "..", "..");

function launchOpts(userDataDir) {
  return { args: [APP_DIR, `--user-data-dir=${userDataDir}`], env: { ...process.env, KHONJEL_LOAD_DIST: "1" } };
}

test("acceleration: real detection never crashes; state is honest; enable fails gracefully", async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "khonjel-accel-"));

  let app = await electron.launch(launchOpts(userDataDir));
  let page = await app.firstWindow();
  await page.waitForSelector('[data-eval="app-shell"][data-eval-ready="true"]');

  // ---- Real detection produces a valid GpuProfile without crashing ----
  const profile = await page.evaluate(() => window.khonjel.invoke("acceleration:profile"));
  expect(["win32", "darwin", "linux"]).toContain(profile.os);
  expect(typeof profile.arch).toBe("string");
  expect(Array.isArray(profile.devices)).toBe(true);
  expect(Array.isArray(profile.warnings)).toBe(true);
  expect(typeof profile.detectedAt).toBe("string");

  // ---- The plan is well-formed ----
  const plan = await page.evaluate(() => window.khonjel.invoke("acceleration:plan"));
  expect(Array.isArray(plan.llm)).toBe(true);
  expect(plan.llm.length).toBeGreaterThan(0);
  expect(["gpu-great", "gpu-ok", "cpu-only", "unknown"]).toContain(plan.recommendedLevel);
  expect(typeof plan.requiresDownload).toBe("boolean");

  // ---- State is honest: CPU by default, valid shape ----
  const state = await page.evaluate(() => window.khonjel.invoke("acceleration:state"));
  expect(["auto", "on", "off"]).toContain(state.mode);
  expect(["gpu", "cpu"]).toContain(state.llm.device);
  expect(typeof state.gpuActive).toBe("boolean");
  expect(typeof state.summary).toBe("string");
  expect(state.gpuActive, "no GPU is active by default (nothing provisioned)").toBe(false);

  // ---- Mode persists ----
  await page.evaluate(() => window.khonjel.invoke("acceleration:setMode", "off"));
  let after = await page.evaluate(() => window.khonjel.invoke("acceleration:state"));
  expect(after.mode).toBe("off");
  await page.evaluate(() => window.khonjel.invoke("acceleration:setMode", "auto"));

  // ---- Enabling an UNPROVISIONABLE backend fails GRACEFULLY: no throw, app stays on the CPU. ----
  // We force "hip" (a backend the manifest ships for no platform) so the real installer is never
  // invoked here -- the recommended-backend path does a real multi-hundred-MB GPU download, which a
  // fast eval must not trigger. This still proves the seam degrades quietly and never crashes.
  const enableResult = await page.evaluate(async () => {
    try {
      await window.khonjel.invoke("acceleration:enable", "llama", "hip");
      return "resolved";
    } catch (err) {
      return `threw:${String(err)}`;
    }
  });
  expect(enableResult, "enable resolves quietly when a backend can't be provisioned").toBe("resolved");

  const finalState = await page.evaluate(() => window.khonjel.invoke("acceleration:state"));
  expect(finalState.llm.device, "still on the CPU after an unprovisionable enable").toBe("cpu");

  // The app is still alive + ready after all of this.
  await expect(page.locator('[data-eval="app-shell"][data-eval-ready="true"]')).toBeVisible();

  await app.close();

  // ---- Restart: the persisted mode survives ----
  app = await electron.launch(launchOpts(userDataDir));
  page = await app.firstWindow();
  await page.waitForSelector('[data-eval="app-shell"][data-eval-ready="true"]');
  const restarted = await page.evaluate(() => window.khonjel.invoke("acceleration:state"));
  expect(restarted.mode, "mode persisted across restart").toBe("auto");
  await app.close();
});
