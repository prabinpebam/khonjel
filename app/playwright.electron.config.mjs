import { defineConfig } from "@playwright/test";

/**
 * Playwright config for the ELECTRON eval runner (T0.8). Unlike playwright.config.mjs (which
 * drives the Vite dev server in a browser), these scenarios launch the REAL Electron app via
 * `_electron.launch` and exercise the live IPC seam + durable settings. No webServer: the app
 * loads the built `dist/` (via KHONJEL_LOAD_DIST=1), so run `npm run build && npm run build:electron`
 * first (the `eval:electron` script does this).
 */
export default defineConfig({
  testDir: "./eval/scenarios",
  testMatch: "**/*.eval.electron.mjs",
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  reporter: [["list"]],
  outputDir: "eval-results/.playwright-electron",
});
