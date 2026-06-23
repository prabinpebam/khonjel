import { test, expect, _electron as electron } from "@playwright/test";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";

/**
 * EDD under real Electron — Phase 1 security hardening (docs/archive/security-privacy-hardening-plan.md).
 *
 * Asserts the two renderer-containment controls against the ACTUAL packaged renderer (file://):
 *   - a strict Content-Security-Policy is in force (an injected inline <script> does NOT execute);
 *   - navigation is locked to our own origin (an attempt to navigate off-origin is prevented).
 * Together these keep any XSS in the untrusted text the renderer shows from reaching the preload
 * bridge or loading remote content.
 */
const APP_DIR = path.resolve(import.meta.dirname, "..", "..");

function launchOpts(userDataDir) {
  return {
    args: [APP_DIR, `--user-data-dir=${userDataDir}`],
    env: { ...process.env, KHONJEL_LOAD_DIST: "1" },
  };
}

test("security: CSP blocks inline script and navigation is locked to the app origin", async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "khonjel-eval-sec-"));
  const app = await electron.launch(launchOpts(userDataDir));
  const page = await app.firstWindow();
  await page.waitForSelector('[data-eval="app-shell"][data-eval-ready="true"]');

  // ---- CSP: an inline <script> must not execute under script-src 'self' ----
  const inlineBlocked = await page.evaluate(
    () =>
      new Promise((resolve) => {
        try {
          const s = document.createElement("script");
          s.textContent = "window.__cspProbe = true;";
          document.head.appendChild(s);
        } catch {
          /* CSP may throw on insertion */
        }
        setTimeout(() => resolve(window.__cspProbe !== true), 100);
      }),
  );
  expect(inlineBlocked, "inline script execution is blocked by CSP").toBe(true);

  // The CSP is actually present on the document.
  const hasCsp = await page.evaluate(() =>
    Boolean(document.querySelector('meta[http-equiv="Content-Security-Policy"]')),
  );
  expect(hasCsp, "a Content-Security-Policy meta tag is present").toBe(true);

  // ---- Navigation lock: an off-origin navigation attempt is prevented ----
  const before = page.url();
  expect(before.startsWith("file://")).toBe(true);
  await page.evaluate(() => {
    try {
      window.location.href = "https://example.com/";
    } catch {
      /* prevented */
    }
  });
  await page.waitForTimeout(600);
  expect(page.url().startsWith("file://"), "renderer stays on the app origin").toBe(true);

  // The IPC bridge still works for legitimate same-origin calls.
  const version = await page.evaluate(() => window.khonjel.invoke("system:getAppVersion"));
  expect(typeof version).toBe("string");

  await app.close();
});
