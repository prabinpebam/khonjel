import { useEffect, useState } from "react";
import { CircleHelp, Mic, Search, Settings, Sparkles } from "lucide-react";
import { NAV_ITEMS } from "@config/nav";
import { useUiStore } from "@stores/ui";
import { useServices } from "@services";
import { useActiveModel } from "@hooks/useActiveModel";
import { Button } from "@components/ui/button";
import { cn } from "@lib/utils";
import khonjelMark from "@/assets/brand/khonjel-mark.svg?raw";

/** Greige sidebar with the white-pill selected nav (the Khonjel signature). */
export function Sidebar() {
  const activeView = useUiStore((s) => s.activeView);
  const setActiveView = useUiStore((s) => s.setActiveView);
  const openSettings = useUiStore((s) => s.openSettings);
  const setPaletteOpen = useUiStore((s) => s.setPaletteOpen);
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const { profile } = useServices();
  const stt = useActiveModel("stt.dictation", "stt");
  // The LLM line mirrors the chat badge (the user-facing language model).
  const llm = useActiveModel("llm.chat", "llm");
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
    <aside
      className={cn(
        "flex shrink-0 flex-col bg-sidebar pb-3 transition-[width] duration-200",
        collapsed ? "w-16 px-2" : "w-[var(--sidebar-width)] ps-3 pe-2",
      )}
    >
      <div className={cn("flex items-center gap-2 py-2", collapsed ? "justify-center px-0" : "px-2")}>
        <span
          aria-hidden
          className="inline-flex size-6 shrink-0 items-center justify-center text-accent [&>svg]:size-6"
          dangerouslySetInnerHTML={{ __html: khonjelMark }}
        />
        {!collapsed ? <span className="text-sm font-semibold text-foreground">Khonjel</span> : null}
      </div>

      <button
        type="button"
        onClick={() => setPaletteOpen(true)}
        aria-label="Search"
        className={cn(
          "mb-2 flex h-9 items-center rounded-md border border-border bg-surface text-sm text-tertiary-foreground transition-colors hover:text-foreground",
          collapsed ? "justify-center px-0" : "gap-2 px-2.5",
        )}
      >
        <Search className="size-4 shrink-0" />
        {!collapsed ? (
          <>
            <span className="flex-1 text-left">Search</span>
            <kbd className="rounded-sm bg-surface-2 px-1.5 py-0.5 font-mono text-xs">Ctrl K</kbd>
          </>
        ) : null}
      </button>

      <nav className="flex flex-col gap-0.5">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const selected = item.id === activeView;
          return (
            <button
              key={item.id}
              type="button"
              data-eval="nav-item"
              data-eval-nav={item.id}
              onClick={() => setActiveView(item.id)}
              aria-current={selected ? "page" : undefined}
              aria-label={collapsed ? item.label : undefined}
              title={collapsed ? item.label : undefined}
              className={cn(
                "flex h-9 items-center rounded-md text-sm font-medium transition-colors",
                collapsed ? "justify-center px-0" : "gap-2.5 px-2.5",
                selected
                  ? "bg-sidebar-selected text-foreground shadow-nav"
                  : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
              )}
            >
              <Icon className={cn("size-4 shrink-0", item.color)} />
              {!collapsed ? <span>{item.label}</span> : null}
            </button>
          );
        })}
      </nav>

      <div className="mt-auto">
        {!collapsed ? (
          <button
            type="button"
            onClick={() => openSettings("speech-to-text")}
            title="Engine status -- open AI model settings"
            className="mb-2 block w-full rounded-md border border-border bg-surface-2 p-3 text-left transition-colors hover:border-accent"
          >
            <div className="flex items-center gap-1.5">
              <Mic className="size-3 shrink-0 text-tertiary-foreground" />
              <span data-eval="engine-stt" className="truncate text-xs font-medium text-foreground">
                {stt.scope} &middot; {stt.model}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-1.5">
              <Sparkles className="size-3 shrink-0 text-tertiary-foreground" />
              <span data-eval="engine-llm" className="truncate text-xs font-medium text-foreground">
                {llm.scope} &middot; {llm.model}
              </span>
            </div>
            <span className="mt-1.5 flex items-center gap-1.5">
              <span className="size-2 rounded-pill bg-success" aria-hidden />
              <span className="text-xs text-tertiary-foreground">Ready</span>
            </span>
          </button>
        ) : null}

        <div className={cn("flex items-center", collapsed ? "flex-col gap-1" : "justify-between")}>
          <div className={cn("flex items-center gap-1", collapsed && "flex-col")}>
            <Button variant="ghost" size="icon" aria-label="Settings" onClick={() => openSettings()}>
              <Settings />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Help"
              onClick={() => window.open("https://github.com/prabinpebam/khonjel#readme", "_blank")}
            >
              <CircleHelp />
            </Button>
          </div>
          <div className={cn("flex items-center gap-2", !collapsed && "pe-1")}>
            <span className="grid size-6 place-items-center rounded-pill bg-accent-soft text-xs font-medium text-accent">
              {name.charAt(0).toUpperCase()}
            </span>
            {!collapsed ? (
              <span className="text-xs font-medium text-muted-foreground">{name}</span>
            ) : null}
          </div>
        </div>
      </div>
    </aside>
  );
}
