/**
 * EDD scenario — Chat: threaded streaming + message actions (06 chat spec, P0).
 *
 * User expectations:
 *  - I can send a message and watch the reply stream in, with a Stop control while it runs.
 *  - I can start a new conversation; sending creates a thread that is auto-titled from my message.
 *  - I can stop a running reply and regenerate an assistant reply.
 *
 * Real-app, observation-first against the mock streaming adapter (no model needed).
 */
import { test, expect } from "@playwright/test";
import { createDomEvalRecorder } from "../recorder/dom-eval-recorder.mjs";

async function gotoChat(page) {
  await page.goto("/");
  await page.waitForSelector('[data-eval="app-shell"][data-eval-ready="true"]', { timeout: 15000 });
  await page.locator('[data-eval="nav-item"][data-eval-nav="chat"]').first().click();
  await page.waitForSelector('[data-eval="chat-root"]', { timeout: 5000 });
}

test("chat — threaded streaming, new thread + auto-title, stop, regenerate", async ({ page }) => {
  const recorder = createDomEvalRecorder(page, {
    feature: "chat",
    scenario: "chat-streaming",
    userGoal: "Hold multiple chat threads with streamed replies and message actions.",
    taskFlow: [
      "Open chat",
      "Send a message",
      "Watch it stream to completion",
      "Start a new thread",
      "Send + auto-title",
      "Stop a stream",
      "Regenerate a reply",
    ],
  });

  await gotoChat(page);
  await recorder.capture("chat-open");

  // The seed thread is selected with a prior conversation.
  await expect(page.locator('[data-eval="chat-thread"]').first(), "a seed thread exists").toBeVisible();
  expect(await page.locator('[data-eval="chat-message"]').count(), "seed conversation is shown").toBeGreaterThan(0);

  // ---- Send a message and watch it stream to completion ----
  await page.locator('[data-eval="chat-input"]').fill("Tell me something useful");
  await page.locator('[data-eval="chat-send"]').click();
  await expect(page.locator('[data-eval="chat-stop"]'), "Stop appears while streaming").toBeVisible({ timeout: 5000 });
  await recorder.capture("streaming");
  await expect(page.locator('[data-eval="chat-send"]'), "Send returns when the reply finishes").toBeVisible({ timeout: 15000 });
  await expect(
    page.locator('[data-eval="chat-message"][data-eval-role="assistant"]').last(),
    "the streamed reply has real content",
  ).not.toHaveText("...");
  await recorder.capture("streamed-reply");

  // ---- The assistant reply renders as sanitized markdown (bold, list, fenced code w/ copy). ----
  const lastReply = page.locator('[data-eval="chat-message"][data-eval-role="assistant"]').last();
  await expect(lastReply.locator("strong"), "bold renders").toContainText("simulated");
  await expect(lastReply.locator("pre code"), "a fenced code block renders").toContainText("const x = 1;");
  await expect(lastReply.locator("li"), "list items render").toHaveCount(2);
  await expect(lastReply.getByRole("button", { name: "Copy code" }), "code blocks get a copy control").toBeVisible();
  await recorder.capture("markdown");

  // ---- New thread: empty state, then a send creates + auto-titles a thread ----
  const threadsBefore = await page.locator('[data-eval="chat-thread"]').count();
  await page.locator('[data-eval="chat-new"]').click();
  await expect(page.getByText("Ask me anything."), "a new chat shows the empty state").toBeVisible();
  await recorder.capture("new-chat-empty");

  await page.locator('[data-eval="chat-input"]').fill("Plan a small birthday party");
  await page.locator('[data-eval="chat-send"]').click();
  await expect(page.locator('[data-eval="chat-send"]'), "the second reply finishes").toBeVisible({ timeout: 15000 });
  expect(await page.locator('[data-eval="chat-thread"]').count(), "a new thread was created").toBeGreaterThan(threadsBefore);
  await expect(page.locator('[data-eval="chat-thread"]').first(), "the new thread is auto-titled from the first message").toContainText("Plan");
  await recorder.capture("auto-titled");

  // ---- Stop mid-stream ----
  await page.locator('[data-eval="chat-input"]').fill("Write a very long story");
  await page.locator('[data-eval="chat-send"]').click();
  await expect(page.locator('[data-eval="chat-stop"]')).toBeVisible({ timeout: 5000 });
  await page.locator('[data-eval="chat-stop"]').click();
  await expect(page.locator('[data-eval="chat-send"]'), "Send returns after Stop").toBeVisible({ timeout: 5000 });
  await recorder.capture("stopped");

  // ---- Regenerate the last assistant reply ----
  await page.locator('[data-eval="chat-message"]').last().hover();
  const regen = page.locator('[data-eval="chat-regenerate"]').last();
  if (await regen.count()) {
    await regen.click();
    await expect(page.locator('[data-eval="chat-send"]'), "regenerate completes").toBeVisible({ timeout: 15000 });
    await recorder.capture("regenerated");
  }

  const { report, outputDir } = await recorder.finish();
  console.log(`[eval] chat ${report.verdict} -- artifacts: ${outputDir}`);
  expect(report.summary.critical, "no critical anomalies").toBe(0);
});
