/**
 * EDD scenario — Chat: search conversations by title + message content (06 chat spec SS12).
 *
 * User expectations:
 *  - I can filter my conversations from the rail by typing.
 *  - Matching a message (not just a title) shows me a snippet of why it matched.
 *  - Clearing the search brings every conversation back.
 *
 * Real-app, observation-first against the mock chat + content adapters.
 */
import { test, expect } from "@playwright/test";
import { createDomEvalRecorder } from "../recorder/dom-eval-recorder.mjs";

async function gotoChat(page) {
  await page.goto("/");
  await page.waitForSelector('[data-eval="app-shell"][data-eval-ready="true"]', { timeout: 15000 });
  await page.locator('[data-eval="nav-item"][data-eval-nav="chat"]').first().click();
  await page.waitForSelector('[data-eval="chat-root"]', { timeout: 5000 });
}

test("chat — search threads by title and content, with snippets", async ({ page }) => {
  const recorder = createDomEvalRecorder(page, {
    feature: "chat",
    scenario: "chat-search",
    userGoal: "Find a past conversation by typing part of its title or a message in it.",
    taskFlow: ["Open chat", "Create a second thread", "Search by title", "Search by content", "Clear"],
  });

  await gotoChat(page);
  await expect(page.locator('[data-eval="chat-thread"]').first(), "the seed thread is shown").toBeVisible();

  // A second thread so search has something to filter down to.
  await page.locator('[data-eval="chat-new"]').click();
  await page.locator('[data-eval="chat-input"]').fill("Plan a trip to Tokyo soon");
  await page.locator('[data-eval="chat-send"]').click();
  await expect(page.locator('[data-eval="chat-send"]'), "the reply finishes").toBeVisible({ timeout: 15000 });
  expect(await page.locator('[data-eval="chat-thread"]').count(), "two threads now exist").toBeGreaterThanOrEqual(2);
  await recorder.capture("two-threads");

  // ---- Search by title ----
  await page.locator('[data-eval="chat-search"]').fill("Tokyo");
  await expect(page.locator('[data-eval="chat-thread"]'), "only the matching thread remains").toHaveCount(1);
  await expect(page.locator('[data-eval="chat-thread"]').first()).toContainText("Tokyo");
  await recorder.capture("search-title");

  // ---- Search by message content shows a snippet of the hit ----
  await page.locator('[data-eval="chat-search"]').fill("teal");
  await expect(page.locator('[data-eval="chat-thread"]'), "the content match is found").toHaveCount(1);
  await expect(
    page.locator('[data-eval="chat-thread-snippet"]').first(),
    "a snippet explains why it matched",
  ).toContainText("teal");
  await recorder.capture("search-content");

  // ---- No match ----
  await page.locator('[data-eval="chat-search"]').fill("zzznotathing");
  await expect(page.locator('[data-eval="chat-thread"]')).toHaveCount(0);
  await expect(page.getByText("No conversations match.")).toBeVisible();

  // ---- Clear restores every thread ----
  await page.locator('[data-eval="chat-search-clear"]').click();
  expect(await page.locator('[data-eval="chat-thread"]').count(), "clearing restores all threads").toBeGreaterThanOrEqual(2);
  await recorder.capture("cleared");

  const { report, outputDir } = await recorder.finish();
  console.log(`[eval] chat-search ${report.verdict} -- artifacts: ${outputDir}`);
  expect(report.summary.critical, "no critical anomalies").toBe(0);
});
