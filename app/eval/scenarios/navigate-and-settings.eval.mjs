/**
 * EDD scenario S2/S3/S4 — Command palette, settings, and persistence.
 *
 * User expectations:
 *  - S2: I can open the command palette and it is actually visible.
 *  - S3: I can open Settings, switch sections, and a change persists across reload.
 *  - S4: The shell stays coherent (no blank/secret/stack) throughout.
 *
 * Real-app, observation-first. Steps are guarded so the scenario degrades to observation if a
 * given control is not yet wired in the mock, while the detectors still judge what was captured.
 */
import { test, expect } from "@playwright/test";
import { createDomEvalRecorder } from "../recorder/dom-eval-recorder.mjs";

const readUi = (page) => page.evaluate(() => (window.__KHONJEL_EVAL__ ? window.__KHONJEL_EVAL__.product().ui : {}));
const readToggles = (page) =>
  page.evaluate(() => (window.__KHONJEL_EVAL__ ? window.__KHONJEL_EVAL__.product().settings.toggles : {}));

test("S2/S3 — palette opens visibly; a settings change persists across reload", async ({ page }) => {
  const recorder = createDomEvalRecorder(page, {
    feature: "shell",
    scenario: "navigate-and-settings",
    userGoal: "Open the palette and settings, change a setting, and have it persist.",
    taskFlow: ["Open app", "Open command palette", "Close palette", "Open settings", "Switch section", "Toggle a setting", "Reload", "Verify persisted"],
  });

  await page.goto("/");
  await page.waitForSelector('[data-eval="app-shell"][data-eval-ready="true"]', { timeout: 15000 });
  await recorder.capture("baseline");

  // ---- S2: command palette (Ctrl+K toggles it) ----
  await page.keyboard.press("Control+k");
  const palette = page.locator('[data-eval="command-palette"]');
  await expect(palette, "palette should become visible").toBeVisible({ timeout: 5000 });
  await recorder.capture("palette-open");
  expect((await readUi(page)).paletteOpen, "store says palette open").toBe(true);

  await page.keyboard.press("Control+k");
  await expect(palette, "palette should close").toBeHidden({ timeout: 5000 });
  await recorder.capture("palette-closed");

  // ---- S3: settings open + section switch ----
  await page.locator('button[aria-label="Settings"]').first().click();
  const modal = page.locator('[data-eval="settings-modal"]');
  await expect(modal, "settings modal should be visible").toBeVisible({ timeout: 5000 });
  await recorder.capture("settings-open");
  expect((await readUi(page)).settingsOpen, "store says settings open").toBe(true);

  // Switch to the Hotkeys section (a stable General-group item).
  const hotkeys = modal.getByRole("button", { name: "Hotkeys" });
  if (await hotkeys.count()) {
    await hotkeys.first().click();
    await recorder.capture("settings-section-hotkeys");
    expect((await readUi(page)).settingsSection).toBe("hotkeys");
  }

  // ---- S3 persistence: flip the first switch, then verify it survives reload ----
  const before = await readToggles(page);
  const firstSwitch = modal.locator('[role="switch"], button[aria-pressed]').first();
  let flipped = false;
  if (await firstSwitch.count()) {
    await firstSwitch.click();
    await recorder.capture("settings-toggled");
    const after = await readToggles(page);
    flipped = JSON.stringify(after) !== JSON.stringify(before);
  }

  // Close settings.
  await page.keyboard.press("Escape");
  await recorder.capture("settings-closed");

  // Reload and confirm the change persisted (Zustand persist → localStorage).
  await page.reload();
  await page.waitForSelector('[data-eval="app-shell"][data-eval-ready="true"]', { timeout: 15000 });
  await recorder.capture("after-reload");

  if (flipped) {
    const afterReload = await readToggles(page);
    const afterToggle = JSON.parse(JSON.stringify(afterReload)); // post-reload snapshot
    expect(JSON.stringify(afterToggle), "toggled setting persisted across reload").not.toBe(JSON.stringify(before));
  }

  const { report, outputDir } = await recorder.finish();
  console.log(`[eval] S2/S3 ${report.verdict} — artifacts: ${outputDir}`);
  expect(report.summary.critical, "no critical anomalies").toBe(0);
  expect(report.summary.warning, "no warning anomalies").toBe(0);
});
