/**
 * EDD scenario — GPU acceleration (gpu-acceleration 05/06).
 *
 * User expectations:
 *  - The settings never dishonestly claim "GPU auto-detected"; the status is honest.
 *  - With a usable GPU, one click turns acceleration on (a real flow, not a fake label).
 *  - "On" is proven: a Test shows real before/after numbers; a Turn-off is offered.
 *
 * Real-app, observation-first: this drives the actual running app (mock acceleration adapter, which
 * is the app's real renderer path) through real clicks and observes the visible card states.
 */
import { test, expect } from "@playwright/test";
import { createDomEvalRecorder } from "../recorder/dom-eval-recorder.mjs";

test("GPU acceleration: honest status, one-click turn-on, and a real speed check", async ({ page }) => {
  const recorder = createDomEvalRecorder(page, {
    feature: "acceleration",
    scenario: "gpu-acceleration",
    userGoal: "Turn on GPU acceleration in one click and see proof it actually works.",
    taskFlow: ["Open settings", "Language Models", "Local", "Honest status", "Turn on GPU", "Reach On", "Speed check"],
  });

  await page.goto("/");
  await page.waitForSelector('[data-eval="app-shell"][data-eval-ready="true"]', { timeout: 15000 });
  await recorder.capture("baseline");

  // Open Settings -> Language Models -> Local (where the local LLM acceleration card lives).
  await page.locator('button[aria-label="Settings"]').first().click();
  const modal = page.locator('[data-eval="settings-modal"]');
  await expect(modal, "settings modal visible").toBeVisible({ timeout: 5000 });

  const lang = modal.getByRole("button", { name: /language model/i });
  if (await lang.count()) await lang.first().click();
  const local = modal.getByRole("button", { name: /^local$/i });
  if (await local.count()) await local.first().click();

  const card = page.locator('[data-eval="acceleration-card"]');
  await expect(card, "acceleration card renders in Local language-model settings").toBeVisible({ timeout: 8000 });
  await recorder.capture("card-visible");

  // Honesty: the old dishonest claim must be gone.
  await expect(page.locator("body"), "no dishonest GPU claim").not.toContainText("GPU auto-detected");

  // Initial state: a usable GPU is found but not yet on, with a single primary CTA.
  await expect(card, "starts in the GPU-off state").toHaveAttribute("data-eval-accel-state", "gpu-off", { timeout: 8000 });
  const cta = card.locator('[data-eval="accel-cta"]');
  await expect(cta, "the one primary action is offered").toBeVisible();
  await expect(card, "the benefit is shown up front").toContainText(/faster/i);
  await recorder.capture("gpu-off");

  // One click turns it on (a real flow ending in a terminal On state -> no CTA dead-end).
  await cta.click();
  await expect(card, "card reaches the On state").toHaveAttribute("data-eval-accel-state", "on", { timeout: 8000 });
  await expect(card.locator('[data-eval="accel-turn-off"]'), "On is reversible in one click").toBeVisible();
  await expect(card, "status is honest about running on the GPU").toContainText(/graphics card|faster/i);
  await recorder.capture("on");

  // Test & validate shows a real before/after with numbers.
  await card.locator('[data-eval="accel-test"]').click();
  const report = card.locator('[data-eval="accel-test-report"]');
  await expect(report, "the speed check renders").toBeVisible({ timeout: 8000 });
  await expect(report, "numbers, not just bars (a11y)").toContainText(/words per second/i);
  await recorder.capture("tested");

  const { report: verdict, outputDir } = await recorder.finish();
  console.log(`[eval] gpu-acceleration ${verdict.verdict} — artifacts: ${outputDir}`);
  expect(verdict.summary.critical, "no critical anomalies").toBe(0);
  expect(verdict.summary.warning, "no warning anomalies").toBe(0);
});
