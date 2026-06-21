import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config";

/**
 * Vitest config for the TDD lane (L2 unit/interaction tests).
 *
 * Reuses the app's Vite config (path aliases, React plugin) via mergeConfig so tests resolve
 * `@lib`, `@stores`, `@components`, `@services`, etc. exactly like the app. The EDD eval harness
 * is separate (Playwright; see playwright.config.mjs) — Vitest never drives the real app.
 */
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: "jsdom",
      setupFiles: ["./src/test/setup.ts"],
      include: ["src/**/*.{test,spec}.{ts,tsx}", "electron/**/*.{test,spec}.ts"],
      css: false,
      clearMocks: true,
      restoreMocks: true,
    },
  }),
);
