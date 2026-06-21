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

  // The dictation pipeline runs end-to-end through the live seam (BE4 for Phase 1 logic).
  const cleanup = await page.evaluate(() =>
    window.khonjel.invoke("inference:cleanup", "um so like the the thing", {}),
  );
  expect(cleanup.cleaned, "messy text is cleaned by the pipeline").toBe(true);
  expect(typeof cleanup.text).toBe("string");
  expect(cleanup.text.length).toBeGreaterThan(0);

  // Content flows from the REAL main-process store/catalog, not the renderer mock seed.
  const sttModels = await page.evaluate(() => window.khonjel.invoke("content:sttModels"));
  expect(Array.isArray(sttModels)).toBe(true);
  expect(
    sttModels.some((m) => m.id === "ggml-small.bin"),
    "real STT catalog over IPC, not the mock seed",
  ).toBe(true);

  const history = await page.evaluate(() => window.khonjel.invoke("content:history"));
  expect(Array.isArray(history)).toBe(true);
  expect(history.length, "fresh install: real content store starts empty (no mock seed)").toBe(0);

  // Dictation persistence: add a history entry and confirm it round-trips with derived fields.
  const added = await page.evaluate(() =>
    window.khonjel.invoke("content:addHistory", {
      finalText: "hello from the eval",
      app: "eval.exe",
      language: "auto",
      durationSec: 2,
      mode: "dictation",
      hasAudio: false,
      cleanupApplied: true,
    }),
  );
  expect(added.length).toBe(1);
  expect(added[0].wordCount, "wordCount derived by the backend").toBe(4);

  const transforms = await page.evaluate(() => window.khonjel.invoke("content:transforms"));
  expect(
    transforms.length > 0 && transforms.every((t) => t.builtin),
    "ships builtin transforms on a fresh install",
  ).toBe(true);

  // Provider connections: safeStorage keychain round-trips presence (never the value), and a bound
  // connection is testable -- an unreachable endpoint fails gracefully with a structured result.
  await page.evaluate(() => window.khonjel.invoke("secrets:set", "eval-conn", "test-key-123"));
  const hasKey = await page.evaluate(() => window.khonjel.invoke("secrets:has", "eval-conn"));
  expect(hasKey, "secret presence tracked via safeStorage").toBe(true);

  await page.evaluate(() =>
    window.khonjel.invoke("connections:upsert", {
      id: "eval-conn",
      kind: "azure-openai",
      baseEndpoint: "http://127.0.0.1:9",
      apiVersion: "2024-12-01-preview",
      authMode: "bearer-token",
    }),
  );
  const testResult = await page.evaluate(() =>
    window.khonjel.invoke("connections:test", "eval-conn", "my-deployment", "chat"),
  );
  expect(typeof testResult.ok, "connections:test returns a structured result").toBe("boolean");
  expect(testResult.ok, "unreachable provider endpoint reports not-ok (graceful)").toBe(false);

  await page.evaluate(() => window.khonjel.invoke("settings:patch", { values: { "eval.persist": "yes" } }));
  await app.close();

  // ---- Launch 2 (same user-data dir): the setting must still be there ----
  app = await electron.launch(launchOpts(userDataDir));
  page = await app.firstWindow();
  await page.waitForSelector('[data-eval="app-shell"][data-eval-ready="true"]');

  const snapshot = await page.evaluate(() => window.khonjel.invoke("settings:get"));
  expect(snapshot.values["eval.persist"], "setting persisted across restart").toBe("yes");

  const historyAfter = await page.evaluate(() => window.khonjel.invoke("content:history"));
  expect(historyAfter.length, "dictation history persisted across restart").toBe(1);
  expect(historyAfter[0].finalText).toBe("hello from the eval");
  await app.close();

  fs.rmSync(userDataDir, { recursive: true, force: true });
});
