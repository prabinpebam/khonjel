import { useEffect } from "react";
import { useUiStore } from "@stores/ui";
import { useSettingsStore } from "@stores/settings";
import { useThemeStore } from "@stores/theme";

declare global {
  interface Window {
    /** Dev-only, read-only observation handle for the EDD eval harness. */
    __KHONJEL_EVAL__?: {
      ready: () => boolean;
      product: () => {
        ui: Record<string, unknown>;
        theme: { theme: string };
        settings: { toggles: Record<string, boolean>; values: Record<string, string> };
      };
      execution: () => { active: boolean; paused: boolean; queueLength: number; jobs: unknown[] };
      version: () => string;
    };
  }
}

/**
 * EvalBridge — dev-only observation bridge for the Eval Driven Development harness.
 *
 * Mounted behind `import.meta.env.DEV` in App.tsx (like MockStudio), so it is compiled out of
 * production builds. It exposes SAFE, READ-ONLY snapshots of app state (no secrets) on
 * `window.__KHONJEL_EVAL__` for the recorder to read. It never mutates state — scenarios drive
 * the app through real clicks/keys. See docs/frameworks/eval-driven-development/03-khonjel-edd-interpretation.md.
 */
export function EvalBridge() {
  useEffect(() => {
    window.__KHONJEL_EVAL__ = {
      ready: () => Boolean(document.querySelector('[data-eval="app-shell"][data-eval-ready="true"]')),
      product: () => {
        const ui = useUiStore.getState();
        const settings = useSettingsStore.getState();
        const theme = useThemeStore.getState();
        return {
          ui: {
            activeView: ui.activeView,
            sidebarCollapsed: ui.sidebarCollapsed,
            settingsOpen: ui.settingsOpen,
            settingsSection: ui.settingsSection,
            paletteOpen: ui.paletteOpen,
          },
          theme: { theme: theme.theme },
          settings: { toggles: settings.toggles, values: settings.values },
        };
      },
      execution: () => ({ active: false, paused: false, queueLength: 0, jobs: [] }),
      version: () => "mock",
    };
    return () => {
      delete window.__KHONJEL_EVAL__;
    };
  }, []);

  return null;
}
