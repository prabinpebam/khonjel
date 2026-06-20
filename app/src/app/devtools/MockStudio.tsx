import { Monitor, Moon, Sun } from "lucide-react";
import { useThemeStore, type Theme } from "@stores/theme";
import { cn } from "@lib/utils";

const THEME_OPTIONS: { id: Theme; icon: typeof Sun; label: string }[] = [
  { id: "light", icon: Sun, label: "Light" },
  { id: "dark", icon: Moon, label: "Dark" },
  { id: "auto", icon: Monitor, label: "Auto" },
];

/**
 * Mock Studio — a dev-only control surface for exercising the mock (theme today;
 * surface/persona/data switches later). Never shipped in production builds.
 */
export function MockStudio() {
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);

  return (
    <div className="fixed bottom-4 z-50 rounded-pill border border-border bg-surface p-1 shadow-pop end-4">
      <div className="flex items-center gap-1">
        {THEME_OPTIONS.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTheme(id)}
            aria-pressed={theme === id}
            aria-label={`${label} theme`}
            className={cn(
              "grid size-8 place-items-center rounded-pill transition-colors",
              theme === id
                ? "bg-accent-soft text-accent"
                : "text-muted-foreground hover:bg-foreground/5",
            )}
          >
            <Icon className="size-4" />
          </button>
        ))}
      </div>
    </div>
  );
}
