import { test, expect, _electron as electron } from "@playwright/test";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";

/**
 * EDD under real Electron — threaded chat streaming over the live IPC seam.
 *
 * Proves the Phase 5 wiring end-to-end WITHOUT a heavy model: forcing `KHONJEL_LLM_MODEL=""` keeps
 * the inference runtime on the deterministic stub (no llama-server spawn, no network), so a send
 * exercises the real path renderer -> preload `chat:send` -> main chatManager -> engine.chatStream
 * -> `webContents.send("khonjel:chat-token")` -> preload `onChatToken` -> renderer, deterministically
 * and fast. The multi-token SSE parsing itself is unit-tested in inference/llama-chatstream.test.ts.
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

test("chat: a send streams a real reply over IPC; a new thread is auto-titled", async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "khonjel-eval-chat-"));
  const app = await electron.launch({
    args: [APP_DIR, `--user-data-dir=${userDataDir}`],
    // KHONJEL_LLM_MODEL="" -> runtime stays on the stub engine (no spawn, instant deterministic reply).
    env: { ...process.env, KHONJEL_LOAD_DIST: "1", KHONJEL_EVAL: "1", KHONJEL_LLM_MODEL: "" },
  });

  try {
    const page = await findMain(app);
    await page.waitForSelector('[data-eval="app-shell"][data-eval-ready="true"]');
    await page.locator('[data-eval="nav-item"][data-eval-nav="chat"]').first().click();
    await page.waitForSelector('[data-eval="chat-root"]');

    // A fresh profile starts empty (the seed conversation is mock-only, not persisted to disk).
    await expect(page.getByText("Ask me anything.")).toBeVisible();

    // ---- First send: it creates the thread, and the reply must arrive over the live token stream. ----
    await page.locator('[data-eval="chat-input"]').fill("Say hello over IPC");
    await page.locator('[data-eval="chat-send"]').click();
    await expect(
      page.locator('[data-eval="chat-send"]'),
      "the composer returns to Send once the streamed reply completes",
    ).toBeVisible({ timeout: 20000 });
    const reply = page.locator('[data-eval="chat-message"][data-eval-role="assistant"]').last();
    await expect(reply, "the assistant bubble holds the streamed reply").not.toHaveText("...");
    expect((await reply.innerText()).trim().length, "the reply has real content").toBeGreaterThan(0);
    await expect(
      page.locator('[data-eval="chat-thread"]').first(),
      "the first send created a thread, auto-titled from the message",
    ).toContainText("Say");

    // ---- New thread: empty state, then a send creates + auto-titles a second thread. ----
    const before = await page.locator('[data-eval="chat-thread"]').count();
    await page.locator('[data-eval="chat-new"]').click();
    await expect(page.getByText("Ask me anything.")).toBeVisible();
    await page.locator('[data-eval="chat-input"]').fill("Plan a quiet weekend");
    await page.locator('[data-eval="chat-send"]').click();
    await expect(page.locator('[data-eval="chat-send"]')).toBeVisible({ timeout: 20000 });
    expect(
      await page.locator('[data-eval="chat-thread"]').count(),
      "a new thread was created",
    ).toBeGreaterThan(before);
    await expect(
      page.locator('[data-eval="chat-thread"]').first(),
      "the new thread is auto-titled from the first message",
    ).toContainText("Plan");
  } finally {
    await app.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
});
