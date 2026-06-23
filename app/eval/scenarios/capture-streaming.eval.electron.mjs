import { test, expect, _electron as electron } from "@playwright/test";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";

/**
 * EDD under real Electron — long-form streaming capture (12 §2A).
 *
 * Drives the REAL capture seam over the live IPC: `capture:start` → push 16 kHz PCM frames over the
 * dedicated chunk channel → the main-process segmenter closes a window on the silence tail → it is
 * transcribed and broadcast as a live `transcript` event → `capture:stop` returns the full text.
 * A stub transcriber (KHONJEL_EVAL) makes this run **fully offline** through the same segmenter /
 * session / IPC the shipping app uses — proving partials arrive *during* capture, not only at stop.
 */
const APP_DIR = path.resolve(import.meta.dirname, "..", "..");

async function findWindow(app, match) {
  for (let i = 0; i < 60; i++) {
    const win = app.windows().find((w) => match(w.url()));
    if (win) return win;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("expected window never appeared");
}
const isMain = (url) => url.includes("index.html") && !url.includes("surface=floating-bar");

test("streaming capture: frames segment + transcribe into a live, growing transcript", async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "khonjel-eval-capture-"));
  const app = await electron.launch({
    args: [APP_DIR, `--user-data-dir=${userDataDir}`],
    env: { ...process.env, KHONJEL_LOAD_DIST: "1", KHONJEL_EVAL: "1" },
  });

  try {
    const main = await findWindow(app, isMain);
    await main.waitForSelector('[data-eval="app-shell"][data-eval-ready="true"]');

    // Collect the live transcript events the capture session broadcasts.
    await main.evaluate(() => {
      window.__transcripts = [];
      window.khonjel.onTranscript((e) => window.__transcripts.push(e));
    });

    const sessionId = await main.evaluate(() => window.khonjel.invoke("capture:start"));
    expect(typeof sessionId).toBe("string");

    // Push ~1 s of speech then ~1 s of silence as 250 ms (4000-sample) 16 kHz mono frames. The
    // silence tail closes a window; the stub transcriber turns it into text.
    await main.evaluate((id) => {
      const b64 = (value) => {
        const pcm = new Int16Array(4000).fill(value);
        const bytes = new Uint8Array(pcm.buffer);
        let s = "";
        for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
        return btoa(s);
      };
      const loud = b64(8000);
      const quiet = b64(0);
      for (let i = 0; i < 4; i++) window.khonjel.capturePushChunk(id, loud);
      for (let i = 0; i < 4; i++) window.khonjel.capturePushChunk(id, quiet);
    }, sessionId);

    // A transcript event must arrive DURING capture (before stop) — the core long-form promise.
    await main.waitForFunction(() => (window.__transcripts ?? []).length > 0, { timeout: 10000 });

    const result = await main.evaluate((id) => window.khonjel.invoke("capture:stop", id), sessionId);
    expect(result.text.length).toBeGreaterThan(0);
    expect(result.text).toContain("khonjel eval transcript");

    const events = await main.evaluate(() => window.__transcripts);
    expect(events.some((e) => e.kind === "final" && e.fullText.length > 0)).toBe(true);
    expect(events.at(-1).fullText).toBe(result.text);
  } finally {
    await app.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
});
