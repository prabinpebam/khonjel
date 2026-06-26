/**
 * EDD scenario — Notes: folder (group) CRUD + move-note + live counts (F4).
 *
 * User expectations:
 *  - I can create a folder, rename it, and delete it.
 *  - I can move a note into a folder, and the folder counts reflect reality.
 *  - Deleting a folder never destroys its notes (they fall back to "All notes").
 *
 * Real-app, observation-first against the mock content adapter (no backend needed).
 */
import { test, expect } from "@playwright/test";
import { createDomEvalRecorder } from "../recorder/dom-eval-recorder.mjs";

async function gotoNotes(page) {
  await page.goto("/");
  await page.waitForSelector('[data-eval="app-shell"][data-eval-ready="true"]', { timeout: 15000 });
  await page.locator('[data-eval="nav-item"][data-eval-nav="notes"]').first().click();
  await page.waitForSelector('[data-eval="content"][data-eval-view="notes"]', { timeout: 5000 });
}

const folderRow = (page, name) => page.locator('[data-eval="folder-row"]', { hasText: name });

test("notes — folder CRUD, move a note, and live counts", async ({ page }) => {
  const recorder = createDomEvalRecorder(page, {
    feature: "notes",
    scenario: "notes-folders",
    userGoal: "Organize notes into folders I can create, rename, fill, and delete.",
    taskFlow: [
      "Open notes",
      "Create a folder",
      "Move a note into it",
      "Rename the folder",
      "Delete the folder (notes survive)",
    ],
  });

  await gotoNotes(page);
  await recorder.capture("notes-open");

  // Seed folders render with counts.
  await expect(folderRow(page, "All notes"), "the All-notes pseudo-folder is shown").toBeVisible();
  await expect(folderRow(page, "Meetings"), "a seed folder is shown").toBeVisible();
  const seedCount = await page.locator('[data-eval="folder-row"]').count();

  // ---- Create a folder, then rename it inline ----
  await page.locator('[data-eval="folder-new"]').click();
  const renameInput = page.locator('[data-eval="folder-rename-input"]');
  await expect(renameInput, "creating a folder opens an inline name field").toBeVisible();
  await renameInput.fill("Projects");
  await renameInput.press("Enter");
  const projects = folderRow(page, "Projects");
  await expect(projects, "the new folder appears").toBeVisible();
  await expect(projects, "a brand-new folder is empty").toContainText("0");
  expect(await page.locator('[data-eval="folder-row"]').count()).toBe(seedCount + 1);
  await recorder.capture("folder-created");

  // ---- Move the selected note into the new folder; the count goes live ----
  await page.locator('[data-eval="note-folder"]').click();
  await page.getByRole("option", { name: "Projects" }).click();
  await expect(projects, "moving a note updates the folder count").toContainText("1");
  // The note is now listed under the active (Projects) folder.
  expect(await page.locator('[data-eval="note-row"]').count(), "the moved note shows in its folder").toBe(1);
  await recorder.capture("note-moved");

  // ---- Rename via the hover action ----
  await projects.hover();
  await projects.locator('[data-eval="folder-rename"]').click();
  const renameAgain = page.locator('[data-eval="folder-rename-input"]');
  await renameAgain.fill("Plans");
  await renameAgain.press("Enter");
  await expect(folderRow(page, "Plans"), "the folder is renamed in place").toBeVisible();
  await recorder.capture("folder-renamed");

  // ---- Delete the folder; the note survives (back under All notes) ----
  const plans = folderRow(page, "Plans");
  await plans.hover();
  await plans.locator('[data-eval="folder-delete"]').click();
  await expect(folderRow(page, "Plans"), "the deleted folder is gone").toHaveCount(0);
  expect(await page.locator('[data-eval="folder-row"]').count()).toBe(seedCount);
  // After deleting the active folder we fall back to All notes -> every note is still there.
  await expect(folderRow(page, "All notes")).toContainText("6");
  expect(await page.locator('[data-eval="note-row"]').count(), "no note was destroyed").toBe(6);
  await recorder.capture("folder-deleted");

  const { report, outputDir } = await recorder.finish();
  console.log(`[eval] notes ${report.verdict} -- artifacts: ${outputDir}`);
  expect(report.summary.critical, "no critical anomalies").toBe(0);
});
