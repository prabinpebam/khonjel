import { Monitor, Moon, Sun } from "lucide-react";
import { useThemeStore, type Theme } from "@stores/theme";
import { cn } from "@lib/utils";

const THEME_OPTIONS: { id: Theme; icon: typeof Sun; label: string }[] = [
  { id: "light", icon: Sun, label: "Light" },
  { id: "dark", icon: Moon, label: "Dark" },
  { id: "auto", icon: Monitor, label: "Auto" },
];

/**
 * Light / Dark / Auto theme switcher (a compact segmented control). Reads/writes the persisted
 * theme store; ThemeProvider applies it to the DOM. Lives in the title bar so it ships in the
 * desktop app, not just the dev mock.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);

  return (
    <div
      role="group"
      aria-label="Theme"
      className={cn("flex items-center gap-0.5 rounded-pill bg-foreground/5 p-0.5", className)}
    >
      {THEME_OPTIONS.map(({ id, icon: Icon, label }) => (
        <button
          key={id}
          type="button"
          onClick={() => setTheme(id)}
          aria-pressed={theme === id}
          aria-label={`${label} theme`}
          data-eval="theme-option"
          data-eval-theme={id}
          className={cn(
            "grid size-7 place-items-center rounded-pill transition-colors",
            theme === id
              ? "bg-accent-soft text-accent"
              : "text-muted-foreground hover:bg-foreground/10 hover:text-foreground",
          )}
        >
          <Icon className="size-4" />
        </button>
      ))}
    </div>
  );
}
