import { test, expect } from "@playwright/test";

/**
 * EDD — consumer-grade local model setup.
 *
 * Drives the real renderer against the browser mock seam. The goal is not to download real models;
 * it is to assert the product surface explains hardware readiness, recommends a private local setup,
 * labels local privacy, and hides unsupported models behind an explicit disclosure.
 */
test("local model setup: hardware status, recommendations, privacy labels, and unsupported disclosure are clear", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector('[data-eval="app-shell"][data-eval-ready="true"]');

  await page.locator('button[aria-label="Settings"]').first().click();
  const modal = page.locator('[data-eval="settings-modal"]');
  await modal.waitFor();
  await modal.getByRole("button", { name: "Speech-to-Text" }).click();

  const setup = modal.locator('[data-eval="local-model-setup"]').first();
  await expect(setup).toBeVisible();
  await expect(setup.getByText("Private local model setup")).toBeVisible();
  await expect(setup.locator('[data-eval="hardware-summary"]')).toContainText(/local models/i);
  await expect(setup.getByText("Speech model", { exact: true })).toBeVisible();
  await expect(setup.getByText("Language model", { exact: true })).toBeVisible();
  await expect(setup.getByRole("button", { name: /Download recommended setup|Recheck local models/ })).toBeVisible();

  // The local rows must explain privacy and compatibility in plain language.
  await expect(modal.getByText("Private").first()).toBeVisible();
  await expect(modal.getByText(/Recommended|Works/).first()).toBeVisible();

  // Unsupported/advanced local models are not mixed into the default choice set; users opt in to see them.
  await expect(modal.getByText(/Parakeet TDT/)).toHaveCount(0);
  await modal.getByRole("button", { name: /Show .* unavailable or advanced models/ }).click();
  await expect(modal.getByText(/Parakeet TDT/)).toBeVisible();
  await expect(modal.getByText(/Not supported|not bundled/i).first()).toBeVisible();
});
