import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Search, Settings as SettingsIcon, type LucideIcon } from "lucide-react";
import { NAV_ITEMS } from "@config/nav";
import { useUiStore } from "@stores/ui";
import { cn } from "@lib/utils";

interface Command {
  id: string;
  label: string;
  icon: LucideIcon;
  hint: string;
  color: string;
  run: () => void;
}

export function CommandPalette() {
  const open = useUiStore((s) => s.paletteOpen);
  const setOpen = useUiStore((s) => s.setPaletteOpen);
  const setActiveView = useUiStore((s) => s.setActiveView);
  const openSettings = useUiStore((s) => s.openSettings);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands = useMemo<Command[]>(() => {
    const nav = NAV_ITEMS.map((item, i) => ({
      id: item.id,
      label: item.label,
      icon: item.icon,
      hint: `Ctrl+${i + 1}`,
      color: item.color,
      run: () => setActiveView(item.id),
    }));
    return [
      ...nav,
      {
        id: "settings",
        label: "Settings",
        icon: SettingsIcon,
        hint: "Ctrl+,",
        color: "text-accent",
        run: () => openSettings(),
      },
    ];
  }, [setActiveView, openSettings]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q === "" ? commands : commands.filter((c) => c.label.toLowerCase().includes(q));
  }, [commands, query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setIndex(0);
      inputRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    setIndex(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      else if (e.key === "ArrowDown") {
        e.preventDefault();
        setIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        filtered[index]?.run();
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, filtered, index, setOpen]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-24">
      <button
        type="button"
        aria-label="Close command palette"
        onClick={() => setOpen(false)}
        className="absolute inset-0 bg-scrim backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="relative z-10 w-full max-w-xl overflow-hidden rounded-lg border border-border bg-surface shadow-modal"
      >
        <div className="flex items-center gap-2 border-b border-border px-4">
          <Search className="size-4 shrink-0 text-tertiary-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search commands or jump to…"
            aria-label="Search commands"
            className="h-12 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-tertiary-foreground"
          />
        </div>
        <ul className="max-h-80 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-muted-foreground">No commands.</li>
          ) : (
            filtered.map((command, i) => {
              const Icon = command.icon;
              const active = i === index;
              return (
                <li key={command.id}>
                  <button
                    type="button"
                    onMouseEnter={() => setIndex(i)}
                    onClick={() => {
                      command.run();
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                      active ? "bg-accent-soft text-foreground" : "text-muted-foreground",
                    )}
                  >
                    <Icon className={cn("size-4", command.color)} />
                    <span className="flex-1 text-left">{command.label}</span>
                    <span className="text-xs text-tertiary-foreground">{command.hint}</span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>,
    document.body,
  );
}
