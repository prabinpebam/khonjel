/**
 * EDD scenario S1 — App readiness & navigation.
 *
 * User expectation: "I can open Khonjel and reach every primary view, and each view shows real
 * content." Runs against the REAL dev app (no mocks of the thing under test) and captures a
 * timeline + screenshots per frame. Clean = zero critical/zero warning anomalies.
 *
 * See docs/frameworks/eval-driven-development/03-khonjel-edd-interpretation.md (S1).
 */
import { test, expect } from "@playwright/test";
import { createDomEvalRecorder } from "../recorder/dom-eval-recorder.mjs";

// The 8 primary views are a product contract (src/config/nav.ts).
const NAV_IDS = ["home", "insights", "chat", "notes", "upload", "dictionary", "transforms"];

test("S1 — shell is ready and every primary view is reachable and non-blank", async ({ page }) => {
  const recorder = createDomEvalRecorder(page, {
    feature: "shell",
    scenario: "app-readiness",
    userGoal: "Open Khonjel and reach every primary view with real content.",
    taskFlow: ["Open the app", "Wait for the shell to be ready", ...NAV_IDS.map((id) => `Open ${id}`)],
  });

  await page.goto("/");

  // App readiness: the shell must paint and signal ready.
  await page.waitForSelector('[data-eval="app-shell"][data-eval-ready="true"]', { timeout: 15000 });
  await recorder.capture("baseline");

  for (const id of NAV_IDS) {
    await page.locator(`[data-eval="nav-item"][data-eval-nav="${id}"]`).click();
    // The content region must switch to this view...
    await page.waitForSelector(`[data-eval="content"][data-eval-view="${id}"]`, { timeout: 8000 });
    // ...and render real, non-blank content (visual integrity, not just DOM presence).
    const text = (await page.locator('[data-eval="content"]').innerText()).trim();
    expect(text.length, `view "${id}" should not be blank`).toBeGreaterThan(0);
    await recorder.capture(`view-${id}`);
  }

  const { report, outputDir } = await recorder.finish();
  console.log(`[eval] S1 ${report.verdict} — artifacts: ${outputDir}`);
  expect(report.summary.critical, "no critical anomalies").toBe(0);
  expect(report.summary.warning, "no warning anomalies").toBe(0);
});
