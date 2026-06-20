import { type ReactNode, useEffect } from "react";
import { useThemeStore } from "@stores/theme";

/**
 * Applies the theme preference to the root <html data-theme> attribute (P6).
 * "auto" follows the OS color scheme and updates live. Components never branch on
 * theme — they consume tokens that re-resolve when this attribute changes.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useThemeStore((s) => s.theme);

  useEffect(() => {
    const root = document.documentElement;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");

    const apply = () => {
      const resolved = theme === "auto" ? (mq.matches ? "dark" : "light") : theme;
      root.setAttribute("data-theme", resolved);
    };

    apply();
    if (theme === "auto") {
      mq.addEventListener("change", apply);
      return () => mq.removeEventListener("change", apply);
    }
    return undefined;
  }, [theme]);

  return <>{children}</>;
}
