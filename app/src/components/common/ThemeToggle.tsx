import { Monitor, Moon, Sun } from "lucide-react";
import { useThemeStore, type Theme } from "@stores/theme";
import { Segmented } from "@components/ui/segmented";

const THEME_OPTIONS = [
  { value: "light" as Theme, label: "Light", icon: Sun },
  { value: "dark" as Theme, label: "Dark", icon: Moon },
  { value: "auto" as Theme, label: "Auto", icon: Monitor },
];

/**
 * Light / Dark / Auto theme switcher for the title bar: the compact icon-only form of the shared
 * Segmented control. Reads/writes the persisted theme store; ThemeProvider applies it to the DOM.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);

  return (
    <Segmented<Theme>
      aria-label="Theme"
      size="icon"
      tone="soft"
      value={theme}
      onChange={setTheme}
      options={THEME_OPTIONS}
      className={className}
    />
  );
}
