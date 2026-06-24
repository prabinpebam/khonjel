import { test, expect } from "@playwright/test";

/**
 * EDD - NVIDIA Parakeet is a first-class, downloadable local STT engine (not a permanent dead-end).
 *
 * Drives the real renderer against the browser mock seam: selecting the Parakeet provider surfaces
 * the Parakeet v3 model with a real Download action + size, never an "Unavailable" / "Not supported"
 * dead-end. This is the regression guard for STT_ENGINE_DEAD_END (the pre-integration stub state).
 */
test("parakeet setup: the NVIDIA Parakeet provider offers a downloadable model, not a dead-end", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector('[data-eval="app-shell"][data-eval-ready="true"]');

  await page.locator('button[aria-label="Settings"]').first().click();
  const modal = page.locator('[data-eval="settings-modal"]');
  await modal.waitFor();
  await modal.getByRole("button", { name: "Speech-to-Text" }).click();

  // Pick the NVIDIA Parakeet provider.
  await modal.getByRole("button", { name: "NVIDIA Parakeet" }).click();

  // The Parakeet v3 row is a real, supported model with its size shown.
  await expect(modal.getByText(/Parakeet TDT/).first()).toBeVisible();
  await expect(modal.getByText(/0\.6 GB/).first()).toBeVisible();

  // It offers a Download action - NOT a disabled "Unavailable" / "not bundled" dead-end.
  await expect(modal.getByRole("button", { name: /Download Parakeet TDT/ })).toBeVisible();
  await expect(modal.getByRole("button", { name: /Parakeet TDT.*is not supported/ })).toHaveCount(0);
  await expect(modal.getByText(/not bundled/i)).toHaveCount(0);
});
