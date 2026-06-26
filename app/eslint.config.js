import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import jsxA11y from "eslint-plugin-jsx-a11y";
import tseslint from "typescript-eslint";

/**
 * Khonjel ESLint flat config.
 * Enforces part of the design-system seam (P2/P13): UI/features may not import
 * service adapters directly — only the `@services` ports. See
 * docs/product-spec/03-ux-ui/design-system/01-intent.md and 06-test-and-validation-strategy.md.
 */
export default tseslint.config(
  { ignores: ["dist", "storybook-static", "node_modules", "coverage", "electron/main.cjs", "electron/preload.cjs"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  jsxA11y.flatConfigs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      // The seam: UI/features must use ports (@services), never adapters directly.
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@services/adapters/*", "**/services/adapters/*"],
              message:
                "Import services via @services (ports) + useServices(), not adapters directly (design-system P2/P13).",
            },
          ],
        },
      ],
    },
  },
  // Storybook stories: a story's `render` is mounted as a component, so hooks are valid there;
  // stories also export a `meta` object beside the story objects (no Fast Refresh concern).
  {
    files: ["**/*.stories.{ts,tsx}"],
    rules: {
      "react-hooks/rules-of-hooks": "off",
      "react-refresh/only-export-components": "off",
    },
  },
  // The services layer is allowed to wire its own adapters.
  {
    files: ["src/services/**", "src/app/providers/ServicesProvider.tsx"],
    rules: { "no-restricted-imports": "off" },
  },
  // Node-side tooling (ESM scripts + this config) run in Node, not the browser.
  {
    files: ["scripts/**/*.{js,mjs}", "*.{js,mjs}"],
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      // The ds-lint emoji regex intentionally lists combinable codepoints.
      "no-misleading-character-class": "off",
    },
  },
  // Electron main/preload run in Node (CommonJS).
  {
    files: ["electron/**/*.cjs"],
    languageOptions: {
      globals: globals.node,
      sourceType: "commonjs",
    },
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  // Electron main/preload TypeScript sources run in Node (process, __dirname, etc.).
  {
    files: ["electron/**/*.ts"],
    languageOptions: {
      globals: globals.node,
    },
  },
  // EDD eval harness: the capture fn runs in the browser (via page.evaluate); the recorder,
  // detectors, and scenarios run in Node. Allow both global sets for eval/**.
  {
    files: ["eval/**/*.mjs"],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
  },
);
