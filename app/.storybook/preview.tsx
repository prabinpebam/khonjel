import { useEffect } from "react";
import type { Preview } from "@storybook/react-vite";
import "../src/styles/globals.css";

/**
 * Renders every story inside the app's themed canvas so components show on real tokens. The
 * toolbar Theme switch flips `data-theme`, which re-themes via the semantic token layer (P6) —
 * the same mechanism the app uses, so the inventory can't drift from production styling.
 */
const preview: Preview = {
  parameters: {
    layout: "centered",
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    backgrounds: { disable: true },
  },
  globalTypes: {
    theme: {
      description: "App theme",
      defaultValue: "light",
      toolbar: {
        title: "Theme",
        icon: "contrast",
        items: [
          { value: "light", title: "Light" },
          { value: "dark", title: "Dark" },
        ],
        dynamicTitle: true,
      },
    },
  },
  decorators: [
    (Story, context) => {
      const theme = context.globals.theme === "dark" ? "dark" : "light";
      useEffect(() => {
        document.documentElement.setAttribute("data-theme", theme);
        return () => document.documentElement.removeAttribute("data-theme");
      }, [theme]);
      return (
        <div className="bg-canvas text-foreground">
          <div className="p-6">
            <Story />
          </div>
        </div>
      );
    },
  ],
};

export default preview;
