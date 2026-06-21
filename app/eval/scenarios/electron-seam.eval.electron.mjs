import { test, expect, _electron as electron } from "@playwright/test";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";

/**
 * EDD (BE4) under real Electron — the Phase 0 seam gate (T0.8).
 *
 * Launches the actual Electron app twice against an isolated temp user-data dir, and proves:
 *  - the live IPC seam works (real `system:getAppVersion` over `window.khonjel.invoke`, not the mock);
 *  - settings written via main are **durable across an app restart** (the S3 expectation),
 *    backed by the native-free JSON store.
 */
const APP_DIR = path.resolve(import.meta.dirname, "..", "..");

function launchOpts(userDataDir) {
  return {
    args: [APP_DIR, `--user-data-dir=${userDataDir}`],
    env: { ...process.env, KHONJEL_LOAD_DIST: "1" },
  };
}

test("electron seam: real system info + settings persist across restart", async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "khonjel-eval-"));

  // ---- Launch 1: prove the live seam, then write a setting through main ----
  let app = await electron.launch(launchOpts(userDataDir));
  let page = await app.firstWindow();
  await page.waitForSelector('[data-eval="app-shell"][data-eval-ready="true"]');

  const version = await page.evaluate(() => window.khonjel.invoke("system:getAppVersion"));
  expect(version, "real app version over IPC, not the mock").not.toBe("0.0.0-mock");
  expect(typeof version).toBe("string");

  await page.evaluate(() => window.khonjel.invoke("settings:patch", { values: { "eval.persist": "yes" } }));
  await app.close();

  // ---- Launch 2 (same user-data dir): the setting must still be there ----
  app = await electron.launch(launchOpts(userDataDir));
  page = await app.firstWindow();
  await page.waitForSelector('[data-eval="app-shell"][data-eval-ready="true"]');

  const snapshot = await page.evaluate(() => window.khonjel.invoke("settings:get"));
  expect(snapshot.values["eval.persist"], "setting persisted across restart").toBe("yes");
  await app.close();

  fs.rmSync(userDataDir, { recursive: true, force: true });
});
