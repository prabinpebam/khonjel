import { test, expect, _electron as electron } from "@playwright/test";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";

/**
 * EDD under real Electron — Connections: create, select-to-edit, update, and key secrecy.
 *
 * Drives the real Settings → Connections UI against the actual ConnectionService + safeStorage
 * keychain. Asserts a saved connection is selectable + editable, edits persist, and the stored API
 * key is NEVER shown back (the key field is write-only — empty when you re-open a connection).
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

test("connections: create, select to edit, and update — the API key is never shown", async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "khonjel-eval-conn-"));
  const app = await electron.launch({
    args: [APP_DIR, `--user-data-dir=${userDataDir}`],
    env: { ...process.env, KHONJEL_LOAD_DIST: "1" },
  });

  try {
    const page = await findMain(app);
    await page.waitForSelector('[data-eval="app-shell"][data-eval-ready="true"]');

    await page.locator('button[aria-label="Settings"]').first().click();
    const modal = page.locator('[data-eval="settings-modal"]');
    await modal.waitFor();
    await modal.getByRole("button", { name: "Connections" }).first().click();

    // ---- Create a connection (with an API key) ----
    await page.fill("#conn-id", "my-openai");
    await page.fill("#conn-endpoint", "https://api.openai.com");
    await page.fill("#conn-model", "gpt-4o-mini");
    await page.fill("#conn-key", "sk-super-secret-123");
    await modal.getByRole("button", { name: "Add connection" }).click();

    // It appears in the saved list with a key.
    const row = modal.getByRole("button", { name: "Edit my-openai" });
    await row.waitFor();
    await expect(modal.getByText("Key set")).toBeVisible();

    // ---- Select it to edit: fields populate, but the stored key is NOT shown ----
    await row.click();
    await expect(page.locator("#conn-id")).toHaveValue("my-openai");
    await expect(page.locator("#conn-id"), "name is locked while editing").toBeDisabled();
    await expect(page.locator("#conn-endpoint")).toHaveValue("https://api.openai.com");
    await expect(page.locator("#conn-model")).toHaveValue("gpt-4o-mini");
    await expect(page.locator("#conn-key"), "the saved API key is never shown back").toHaveValue("");

    // ---- Edit a field and save (blank key keeps the existing one) ----
    await page.fill("#conn-model", "gpt-4o");
    await modal.getByRole("button", { name: "Save changes" }).click();

    // ---- Re-open: the edit persisted, the key is still set and still hidden ----
    await modal.getByRole("button", { name: "Edit my-openai" }).click();
    await expect(page.locator("#conn-model"), "the edit persisted").toHaveValue("gpt-4o");
    await expect(page.locator("#conn-key"), "the key remains write-only").toHaveValue("");
    await expect(modal.getByText("Key set"), "the key was preserved across the edit").toBeVisible();
  } finally {
    await app.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
});
