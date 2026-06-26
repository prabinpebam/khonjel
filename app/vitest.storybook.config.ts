import { defineConfig, mergeConfig } from "vitest/config";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import viteConfig from "./vite.config";

/**
 * Isolated Vitest project that runs every story as a render + a11y (+ interaction) test in a real
 * browser (Playwright/Chromium). Deliberately kept OUT of the default `npm test` lane so the fast
 * jsdom unit suite (vitest.config.ts) stays fast and dependency-light. Run via `npm run test:storybook`.
 */
export default mergeConfig(
  viteConfig,
  defineConfig({
    plugins: [storybookTest({ configDir: ".storybook" })],
    // Force the automatic JSX runtime for esbuild (the dep optimizer pre-bundles .storybook/preview
    // with the classic runtime otherwise, which throws "React is not defined" in the browser).
    esbuild: { jsx: "automatic", jsxImportSource: "react" },
    optimizeDeps: { esbuildOptions: { jsx: "automatic", jsxImportSource: "react" } },
    test: {
      name: "storybook",
      browser: {
        enabled: true,
        provider: "playwright",
        headless: true,
        instances: [{ browser: "chromium" }],
      },
      setupFiles: [".storybook/vitest.setup.ts"],
    },
  }),
);
