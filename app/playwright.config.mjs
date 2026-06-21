import { defineConfig } from "@playwright/test";

/**
 * Playwright config for the EDD eval harness (NOT unit tests).
 *
 * Scenarios live in eval/scenarios/*.eval.mjs and drive the REAL dev app, capturing a timeline
 * via the recorder in eval/recorder/. Per-run artifacts are written by the recorder under
 * eval-results/<feature>/<scenario>-<timestamp>/ (git-ignored).
 *
 * Today the target is the Vite dev server. When Khonjel runs under Electron, switch the runner
 * to Playwright's Electron launcher so IPC, hotkeys, and text injection are real
 * (docs/frameworks/eval-driven-development/03-khonjel-edd-interpretation.md §9.2).
 */
export default defineConfig({
  testDir: "./eval/scenarios",
  testMatch: "**/*.eval.mjs",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 8_000 },
  reporter: [["list"]],
  outputDir: "eval-results/.playwright",
  use: {
    baseURL: "http://localhost:5174",
    headless: true,
    viewport: { width: 1280, height: 800 },
    screenshot: "off", // the recorder captures its own per-frame screenshots
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev -- --port 5174 --strictPort",
    url: "http://localhost:5174",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
