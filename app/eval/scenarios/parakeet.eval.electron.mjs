import { test, expect, _electron as electron } from "@playwright/test";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";

/**
 * EDD under real Electron - NVIDIA Parakeet is a first-class local STT engine.
 *
 * Proves, against the REAL main-process seam (not the browser mock), that the three pre-integration
 * stubs are gone: the model is a real downloadable asset (readiness "not-installed"/download, not a
 * permanent "unsupported" dead-end), the runtime status is fetchable ("missing", not "unsupported"),
 * and `engineReady("parakeet")` lights up when the sherpa binary is present. Engine routing itself
 * (whisper vs Parakeet selection) is proven by the BE1 unit tests; transcribing real audio needs the
 * sherpa binary + the 640 MB model, which CI does not fetch.
 */
const APP_DIR = path.resolve(import.meta.dirname, "..", "..");
const PARAKEET_ID = "sherpa-onnx-nemo-parakeet-tdt-0.6b-v3";

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

test("parakeet: real seam reports a downloadable model + fetchable runtime (stubs flipped)", async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "khonjel-eval-parakeet-"));
  const app = await electron.launch({
    args: [APP_DIR, `--user-data-dir=${userDataDir}`],
    env: { ...process.env, KHONJEL_LOAD_DIST: "1" },
  });

  try {
    const page = await findMain(app);
    await page.waitForSelector('[data-eval="app-shell"][data-eval-ready="true"]');

    // 1) Readiness: Parakeet is a real Download affordance, not a permanent "unsupported" dead-end.
    const readiness = await page.evaluate(() => window.khonjel.invoke("models:readiness"));
    const pr = readiness.find((r) => r.modelId === PARAKEET_ID);
    expect(pr).toBeTruthy();
    expect(pr.state).toBe("not-installed");
    expect(pr.nextAction).toBe("download");

    // 2) Runtime status: fetchable ("missing") or "ready" once the sherpa binary is installed -
    // never a hardcoded "unsupported" dead-end (which is what the pre-integration stub returned).
    const report = await page.evaluate(() => window.khonjel.invoke("models:compatibility"));
    const runtime = report.runtimes.find((r) => r.engine === "parakeet");
    expect(runtime).toBeTruthy();
    expect(runtime.state).not.toBe("unsupported");
    expect(report.models.some((m) => m.modelId === PARAKEET_ID)).toBe(true);

    // The app is responsive (no crash) after exercising the real model seam.
    const alive = await page.evaluate(() =>
      window.khonjel.invoke("models:readiness").then((r) => Array.isArray(r)),
    );
    expect(alive).toBe(true);
  } finally {
    await app.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
});

test("parakeet: engineReady detects the sherpa runtime on the real seam", async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "khonjel-eval-parakeet-bin-"));
  // KHONJEL_SHERPA_BIN present => makeEngineReady("parakeet") is satisfied (mirrors KHONJEL_WHISPER_BIN).
  const app = await electron.launch({
    args: [APP_DIR, `--user-data-dir=${userDataDir}`],
    env: { ...process.env, KHONJEL_LOAD_DIST: "1", KHONJEL_SHERPA_BIN: userDataDir },
  });

  try {
    const page = await findMain(app);
    await page.waitForSelector('[data-eval="app-shell"][data-eval-ready="true"]');

    const report = await page.evaluate(() => window.khonjel.invoke("models:compatibility"));
    const runtime = report.runtimes.find((r) => r.engine === "parakeet");
    expect(runtime.state).toBe("ready");

    // With the runtime ready, the Parakeet model is no longer compatibility-"unsupported".
    const model = report.models.find((m) => m.modelId === PARAKEET_ID);
    expect(model).toBeTruthy();
    expect(model.level).not.toBe("unsupported");
  } finally {
    await app.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
});
