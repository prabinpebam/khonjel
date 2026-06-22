import { test, expect, _electron as electron } from "@playwright/test";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";

/**
 * EDD (BE4) under real Electron — model-badge display for the single shared language model.
 *
 * Reproduces the user-reported bug ("I changed the model but the badge still shows the local
 * model") against the ACTUAL Electron app (real settings.json + connections.json + SettingsSync),
 * not the browser mock. There is ONE Language Model shared by every task; these scenarios drive the
 * real Settings UI to change it (to an Azure connection, and between local models) and assert the
 * chat badge AND the sidebar engine card follow it — live, after a restart, and that the single
 * change fans out to every LLM task slot so nothing silently drifts.
 */
const APP_DIR = path.resolve(import.meta.dirname, "..", "..");

function launchOpts(userDataDir) {
  return {
    args: [APP_DIR, `--user-data-dir=${userDataDir}`],
    env: { ...process.env, KHONJEL_LOAD_DIST: "1" },
  };
}

/** Seed a local model file so the inline picker shows it Installed (reconcile marks it on launch). */
function seedInstalledModel(userDataDir, fileName) {
  const dir = path.join(userDataDir, "models");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, fileName), Buffer.alloc(4096, 1));
}

/** Select an installed model in the Language Models list by its row radio. */
async function selectLocalModel(page, modal, nameRe) {
  await modal.getByRole("button", { name: "Language Models" }).first().click();
  await page.waitForTimeout(150);
  const row = modal.getByRole("radio", { name: nameRe });
  await row.waitFor({ timeout: 6000 });
  await row.click();
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

/** Precise sidebar LLM line via the stable data-eval hook. */
function engineLlm(page) {
  return page.locator('[data-eval="engine-llm"]').innerText();
}

/** Navigate to Chat (mounting the badge) and read the precise model badge. */
async function chatBadge(page) {
  await page.locator('[data-eval-nav="chat"]').click();
  await page.waitForTimeout(300);
  return page.locator('[data-eval="chat-model"]').innerText();
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

/** Bind the single shared Language Model config to a connection + deployment. */
async function bindLlmModel(page, modal, { connectionId, target }) {
  await modal.getByRole("button", { name: "Language Models" }).first().click();
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

/** Read the model id persisted for every LLM task slot from the real settings.json. */
function llmSlotModels(userDataDir) {
  const values = JSON.parse(fs.readFileSync(path.join(userDataDir, "settings.json"), "utf8")).values ?? {};
  return {
    chat: values["llm.chat.model"],
    cleanup: values["llm.cleanup.model"],
    agent: values["llm.agent.model"],
    note: values["llm.note.model"],
  };
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
  // The single shared Language Model is routed to Azure. Both the chat badge AND the sidebar LLM
  // line read the chat slot, so both must reflect the Azure deployment -- if either read a stale or
  // different slot it would show the local model and this test would fail.
  await bindLlmModel(page, modal, { connectionId: "azure-gpt54-chat", target: "gpt-5.4" });
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

test("model badge: changing the one shared model fans out to every LLM task and the badge follows", async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "khonjel-eval-unify-"));
  seedInstalledModel(userDataDir, "qwen2.5-3b-instruct-q4_k_m.gguf");

  const app = await electron.launch(launchOpts(userDataDir));
  const page = await app.firstWindow();
  await waitReady(page);

  // Baseline: the chat badge shows the default local model.
  const badgeBefore = await chatBadge(page);
  expect(badgeBefore, "baseline chat badge is the default local model").toMatch(/1\.5B/i);

  // Change THE model once, in the single shared Language Model config (select the installed 3B row).
  await page.locator('button[aria-label="Settings"]').first().click();
  const modal = page.locator('[data-eval="settings-modal"]');
  await modal.waitFor();
  await selectLocalModel(page, modal, /Qwen2\.5 3B/i);
  await page.waitForTimeout(700);
  await page.keyboard.press("Escape");

  // The single change is mirrored to cleanup/agent/note too -- there is no per-tab model to drift.
  const after = llmSlotModels(userDataDir);
  expect(after.chat, "chat slot updated").toMatch(/3b/i);
  expect(after.cleanup, "cleanup slot mirrors the shared model").toBe(after.chat);
  expect(after.agent, "agent slot mirrors the shared model").toBe(after.chat);
  expect(after.note, "note slot mirrors the shared model").toBe(after.chat);

  // ...and the two surfaces the user watches reflect it.
  const card = await engineCard(page);
  const chat = await chatHeader(page);
  expect(chat, "chat badge follows the shared model").toMatch(/3B/i);
  expect(card, "sidebar LLM line follows the shared model").toMatch(/3B/i);

  await app.close();
  fs.rmSync(userDataDir, { recursive: true, force: true });
});

test("model badge reactivity: changing the chat model in settings updates the badge + sidebar with NO remount", async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "khonjel-eval-react-"));
  seedInstalledModel(userDataDir, "qwen2.5-3b-instruct-q4_k_m.gguf");

  const app = await electron.launch(launchOpts(userDataDir));
  const page = await app.firstWindow();
  await waitReady(page);

  // Mount the Chat view so its badge is live, and capture the baseline (default local model).
  const badgeBefore = await chatBadge(page);
  const llmBefore = await engineLlm(page);
  expect(badgeBefore, "baseline chat badge is the default local model").toMatch(/1\.5B/i);
  expect(llmBefore, "baseline sidebar LLM is the default local model").toMatch(/1\.5B/i);

  // Change ONLY the model in settings -- do NOT navigate away. This tests LIVE reactivity:
  // the badge + sidebar are still mounted behind the modal and must update immediately.
  await page.locator('button[aria-label="Settings"]').first().click();
  const modal = page.locator('[data-eval="settings-modal"]');
  await modal.waitFor();
  await selectLocalModel(page, modal, /Qwen2\.5 3B/i);
  await page.waitForTimeout(400);

  const badgeAfter = await page.locator('[data-eval="chat-model"]').innerText();
  const llmAfter = await engineLlm(page);
  expect(badgeAfter, "chat badge reflects the change live (no remount)").toMatch(/3B/i);
  expect(badgeAfter, "chat badge actually changed").not.toBe(badgeBefore);
  expect(llmAfter, "sidebar LLM reflects the change live (no remount)").toMatch(/3B/i);

  await app.close();
  fs.rmSync(userDataDir, { recursive: true, force: true });
});
