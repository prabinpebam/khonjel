import { test, expect } from "@playwright/test";

/**
 * EDD — "Download recommended setup" gives clear, live feedback and recovers state.
 *
 * The earlier behavior showed NO feedback on click. This drives the real renderer (browser mock
 * seam): it removes the recommended speech model so a fresh download is required, clicks the setup
 * button, and asserts the user sees progress (a busy button + a progress bar) and then a finished,
 * ready state — i.e. the action is never silent.
 */
test("download recommended setup: clicking shows live progress and finishes ready", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector('[data-eval="app-shell"][data-eval-ready="true"]');

  await page.locator('button[aria-label="Settings"]').first().click();
  const modal = page.locator('[data-eval="settings-modal"]');
  await modal.waitFor();
  await modal.getByRole("button", { name: "Speech-to-Text" }).click();

  const setup = modal.locator('[data-eval="local-model-setup"]').first();
  await expect(setup).toBeVisible();

  // Put the recommended speech model into a "needs download" state so the button offers a download.
  const remove = modal.getByRole("button", { name: /^Remove Whisper Small$/ });
  if (await remove.count()) {
    await remove.first().click();
  }

  const primary = setup.locator('[data-eval="download-recommended-models"]');
  await expect(primary).toContainText(/Download recommended setup/, { timeout: 10_000 });

  // Click and assert immediate, visible feedback (not silent): the button enters a busy "Setting up"
  // state and a progress bar appears.
  await primary.click();
  await expect(primary).toContainText(/Setting up/, { timeout: 10_000 });
  await expect(primary).toBeDisabled();
  await expect(setup.getByRole("progressbar").first()).toBeVisible({ timeout: 10_000 });

  // The download completes and the surface settles into a ready/recheck state.
  await expect(primary).toContainText(/Recheck local models/, { timeout: 20_000 });
  await expect(primary).toBeEnabled();
  await expect(setup.getByText("Ready", { exact: true }).first()).toBeVisible({ timeout: 10_000 });
});
