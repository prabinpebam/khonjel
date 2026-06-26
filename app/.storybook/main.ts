import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-a11y", "@storybook/addon-vitest"],
  framework: { name: "@storybook/react-vite", options: {} },
  core: { disableTelemetry: true },
  viteFinal: (viteConfig) => {
    // The app's CSP-meta plugin injects a strict `script-src 'self'` into built HTML, which would
    // break Storybook's own bundle (production-only for the app; irrelevant in the inventory).
    viteConfig.plugins = (viteConfig.plugins ?? []).filter((plugin) => {
      const name =
        plugin && typeof plugin === "object" && "name" in plugin
          ? String((plugin as { name?: unknown }).name)
          : "";
      return name !== "khonjel-csp-meta";
    });
    return viteConfig;
  },
};

export default config;
