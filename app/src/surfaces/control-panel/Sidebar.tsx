import { useEffect, useState } from "react";
import { CircleHelp, Search, Settings } from "lucide-react";
import { NAV_ITEMS } from "@config/nav";
import { useUiStore } from "@stores/ui";
import { useServices } from "@services";
import { Button } from "@components/ui/button";
import { cn } from "@lib/utils";

/** Greige sidebar with the white-pill selected nav (the Khonjel signature). */
export function Sidebar() {
  const activeView = useUiStore((s) => s.activeView);
  const setActiveView = useUiStore((s) => s.setActiveView);
  const { profile } = useServices();
  const [name, setName] = useState("You");

  useEffect(() => {
    let live = true;
    void profile.get().then((p) => {
      if (live) setName(p.name);
    });
    return () => {
      live = false;
    };
  }, [profile]);

  return (
    <aside className="flex w-[var(--sidebar-width)] shrink-0 flex-col bg-sidebar ps-3 pe-2 pb-3">
      <div className="flex items-center gap-2 px-2 py-2">
        <span className="size-6 rounded-md bg-primary" aria-hidden />
        <span className="text-sm font-semibold text-foreground">Khonjel</span>
      </div>

      <div className="relative mb-2">
        <Search className="pointer-events-none absolute top-1/2 size-4 -translate-y-1/2 text-tertiary-foreground start-2" />
        <input
          type="search"
          aria-label="Search"
          placeholder="Search"
          className="h-9 w-full rounded-md border border-border bg-surface ps-8 pe-3 text-sm text-foreground placeholder:text-tertiary-foreground"
        />
      </div>

      <nav className="flex flex-col gap-0.5">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const selected = item.id === activeView;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveView(item.id)}
              aria-current={selected ? "page" : undefined}
              className={cn(
                "flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm font-medium transition-colors",
                selected
                  ? "bg-sidebar-selected text-foreground shadow-nav"
                  : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
              )}
            >
              <Icon className={cn("size-4", selected && "text-accent")} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="mt-auto">
        <div className="mb-2 rounded-md border border-border bg-surface-2 p-3">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-pill bg-success" aria-hidden />
            <span className="text-xs font-medium text-foreground">Local &middot; Ready</span>
          </div>
          <p className="mt-1 text-xs text-tertiary-foreground">whisper-large-v3 &middot; on device</p>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" aria-label="Settings">
              <Settings />
            </Button>
            <Button variant="ghost" size="icon" aria-label="Help">
              <CircleHelp />
            </Button>
          </div>
          <div className="flex items-center gap-2 pe-1">
            <span className="grid size-6 place-items-center rounded-pill bg-accent-soft text-xs font-medium text-accent">
              {name.charAt(0).toUpperCase()}
            </span>
            <span className="text-xs font-medium text-muted-foreground">{name}</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
