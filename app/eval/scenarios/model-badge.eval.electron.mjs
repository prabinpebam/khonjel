import { test, expect, _electron as electron } from "@playwright/test";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";

/**
 * EDD (BE4) under real Electron — model-badge display for a routed (cloud/Azure) slot.
 *
 * Reproduces the user-reported bug ("I set the chat model to Azure but it still shows the local
 * model") against the ACTUAL Electron app (real settings.json + connections.json + SettingsSync),
 * not the browser mock. Drives the real Settings UI to bind the Chat LLM slot to an Azure
 * connection, then asserts the chat badge AND the sidebar engine card read the Azure deployment --
 * both live and after an app restart (the persisted next-launch view).
 */
const APP_DIR = path.resolve(import.meta.dirname, "..", "..");

function launchOpts(userDataDir) {
  return {
    args: [APP_DIR, `--user-data-dir=${userDataDir}`],
    env: { ...process.env, KHONJEL_LOAD_DIST: "1" },
  };
}

async function waitReady(page) {
  await page.waitForSelector('[data-eval="app-shell"][data-eval-ready="true"]');
}

/** The sidebar engine-status card text (STT + LLM lines). */
function engineCard(page) {
  return page.locator('aside button[title*="Engine status"]').innerText();
}

/** The Chat view header text (contains the model badge). */
async function chatHeader(page) {
  await page.locator('[data-eval-nav="chat"]').click();
  await page.waitForTimeout(400);
  return page.locator("main").first().innerText();
}

/** Create an Azure connection through the real Connections UI. */
async function createAzureConnection(page, modal, { id, model }) {
  await modal.getByRole("button", { name: "Connections" }).first().click();
  await page.waitForTimeout(250);
  await page.fill("#conn-id", id);
  await page.fill("#conn-endpoint", "https://demo.cognitiveservices.azure.com");
  await page.fill("#conn-model", model);
  await modal.locator('button[aria-label="Provider"]').click();
  await page.waitForTimeout(150);
  await page.locator('div.shadow-pop button:has-text("azure-openai")').first().click();
  await page.waitForTimeout(150);
  await modal.getByRole("button", { name: "Add connection" }).click();
  await page.waitForTimeout(300);
}

/** Bind a Language Models tab (e.g. "Dictation Cleanup", "Chat") to a connection + deployment. */
async function bindLlmSlot(page, modal, { tab, connectionId, target }) {
  await modal.getByRole("button", { name: "Language Models" }).first().click();
  await page.waitForTimeout(150);
  await modal.getByRole("tab", { name: tab }).click();
  await page.waitForTimeout(150);
  await modal.getByText("Enterprise", { exact: false }).first().click();
  await page.waitForTimeout(250);
  await modal.locator('button[aria-label="Connection"]').click();
  await page.waitForTimeout(150);
  await page.locator(`div.shadow-pop button:has-text("${connectionId}")`).first().click();
  await page.waitForTimeout(150);
  await modal.getByRole("textbox").first().fill(target);
  await page.waitForTimeout(300);
}

test("model badge: a routed (Azure) chat slot shows in the chat badge AND the sidebar, live and after restart", async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "khonjel-eval-badge-"));

  let app = await electron.launch(launchOpts(userDataDir));
  let page = await app.firstWindow();
  await waitReady(page);

  // ---- Drive the real UI end-to-end, exactly as the user does ----
  await page.locator('button[aria-label="Settings"]').first().click();
  const modal = page.locator('[data-eval="settings-modal"]');
  await modal.waitFor();
  await createAzureConnection(page, modal, { id: "azure-gpt54-chat", model: "gpt-5.4" });
  // Only the Chat LLM is routed to Azure; the cleanup slot stays local. Both the chat badge AND the
  // sidebar LLM line must reflect the chat slot -- if the sidebar read a different slot it would show
  // the local model and this test would fail.
  await bindLlmSlot(page, modal, { tab: "Chat", connectionId: "azure-gpt54-chat", target: "gpt-5.4" });
  await page.keyboard.press("Escape");

  // ---- Assert the live displays reflect the Azure deployment, not a local model ----
  const cardLive = await engineCard(page);
  const chatLive = await chatHeader(page);
  expect(cardLive, "[live] sidebar LLM line shows the Azure deployment").toMatch(/gpt-5\.4/);
  expect(cardLive.toLowerCase(), "[live] sidebar LLM line is not a local model").not.toMatch(/qwen/);
  expect(chatLive, "[live] chat badge shows the Azure deployment").toMatch(/gpt-5\.4/);
  expect(chatLive.toLowerCase(), "[live] chat badge is not a local model").not.toMatch(/qwen/);

  await app.close();

  // ---- Relaunch: the persisted routed slot must still render correctly in both places ----
  app = await electron.launch(launchOpts(userDataDir));
  page = await app.firstWindow();
  await waitReady(page);

  const cardAfter = await engineCard(page);
  const chatAfter = await chatHeader(page);
  expect(cardAfter, "[restart] sidebar LLM line shows the Azure deployment").toMatch(/gpt-5\.4/);
  expect(cardAfter.toLowerCase(), "[restart] sidebar LLM line is not a local model").not.toMatch(/qwen/);
  expect(chatAfter, "[restart] chat badge shows the Azure deployment").toMatch(/gpt-5\.4/);
  expect(chatAfter.toLowerCase(), "[restart] chat badge is not a local model").not.toMatch(/qwen/);

  await app.close();
  fs.rmSync(userDataDir, { recursive: true, force: true });
});
