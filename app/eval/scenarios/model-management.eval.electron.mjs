import { test, expect, _electron as electron } from "@playwright/test";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import http from "node:http";

/**
 * EDD under real Electron — local model management end to end (07 §M1/§M4/§M5).
 *
 * Drives the REAL main-process model service over the live IPC seam: status → download → installed →
 * storage → remove. The download source is redirected to a tiny local HTTP server via
 * `KHONJEL_MODEL_SOURCES`, so the whole acquire/verify/atomic-install path runs **fully offline**
 * (no Hugging Face), through the same downloader the shipping app uses.
 */
const APP_DIR = path.resolve(import.meta.dirname, "..", "..");
const MODEL_ID = "ggml-base.en.bin";
const PAYLOAD = Buffer.alloc(64 * 1024, 7); // 64 KB of deterministic bytes

function startSource() {
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { "content-length": String(PAYLOAD.length), "content-type": "application/octet-stream" });
    res.end(PAYLOAD);
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      resolve({ server, url: `http://127.0.0.1:${addr.port}/model` });
    });
  });
}

async function findWindow(app, match) {
  for (let i = 0; i < 60; i++) {
    const win = app.windows().find((w) => match(w.url()));
    if (win) return win;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("expected window never appeared");
}
const isMain = (url) => url.includes("index.html") && !url.includes("surface=floating-bar");

const statusOf = (page, id) =>
  page.evaluate(async (modelId) => {
    const list = await window.khonjel.invoke("models:status");
    return list.find((m) => m.id === modelId) ?? null;
  }, id);

test("local models: download from a (local) source installs, accounts storage, and removes", async () => {
  const { server, url } = await startSource();
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "khonjel-eval-models-"));
  const app = await electron.launch({
    args: [APP_DIR, `--user-data-dir=${userDataDir}`],
    env: {
      ...process.env,
      KHONJEL_LOAD_DIST: "1",
      KHONJEL_EVAL: "1",
      KHONJEL_MODEL_SOURCES: JSON.stringify({ [MODEL_ID]: url }),
    },
  });

  try {
    const main = await findWindow(app, isMain);
    await main.waitForSelector('[data-eval="app-shell"][data-eval-ready="true"]');

    // ---- Fresh install: the model is in the catalog but not yet downloaded ----
    const before = await statusOf(main, MODEL_ID);
    expect(before, "the catalog exposes the local model with a state").not.toBeNull();
    expect(before.state).toBe("not-installed");
    const storageBefore = await main.evaluate(() => window.khonjel.invoke("models:storage"));
    expect(typeof storageBefore.freeBytes).toBe("number");
    expect(storageBefore.freeBytes).toBeGreaterThan(0);

    // ---- Download → installed (real downloader, atomic install, no network) ----
    await main.evaluate((id) => window.khonjel.invoke("models:download", id), MODEL_ID);
    await expect
      .poll(async () => (await statusOf(main, MODEL_ID))?.state, { timeout: 15000 })
      .not.toBe("downloading");
    const result = await statusOf(main, MODEL_ID);
    expect(
      result.error ? `${result.state}:${result.error.code}` : result.state,
      "download should reach installed",
    ).toBe("installed");

    // The file really landed in the cache, and storage accounts for it.
    const installed = await statusOf(main, MODEL_ID);
    expect(installed.installedBytes).toBe(PAYLOAD.length);
    const onDisk = fs.existsSync(path.join(userDataDir, "models", MODEL_ID));
    expect(onDisk, "the model file exists in <userData>/models").toBe(true);
    const storageAfter = await main.evaluate(() => window.khonjel.invoke("models:storage"));
    expect(storageAfter.usedBytes).toBeGreaterThanOrEqual(PAYLOAD.length);

    // ---- Remove frees the space and returns to Available ----
    const removed = await main.evaluate((id) => window.khonjel.invoke("models:remove", id), MODEL_ID);
    expect(removed.freedBytes).toBe(PAYLOAD.length);
    await expect.poll(async () => (await statusOf(main, MODEL_ID))?.state, { timeout: 5000 }).toBe("not-installed");
    expect(fs.existsSync(path.join(userDataDir, "models", MODEL_ID))).toBe(false);
  } finally {
    await app.close();
    server.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
});
