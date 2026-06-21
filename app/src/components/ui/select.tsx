import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@lib/utils";

export interface SelectOption {
  value: string;
  label: string;
  icon?: ReactNode;
}

interface SelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  "aria-label"?: string;
}

/** Custom dropdown (listbox) with a fully styled, portaled option list. No deps. */
export function Select({
  value,
  onValueChange,
  options,
  placeholder,
  className,
  "aria-label": ariaLabel,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const selectedIndex = options.findIndex((o) => o.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  function openMenu(toIndex: number) {
    const r = triggerRef.current?.getBoundingClientRect();
    if (r) setRect({ top: r.bottom + 4, left: r.left, width: r.width });
    setOpen(true);
    setActiveIndex(toIndex < 0 ? 0 : toIndex);
  }

  function closeMenu(focusTrigger = true) {
    setOpen(false);
    setActiveIndex(-1);
    if (focusTrigger) triggerRef.current?.focus();
  }

  function selectAt(i: number) {
    const opt = options[i];
    if (opt) onValueChange(opt.value);
    closeMenu();
  }

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target) || popupRef.current?.contains(target)) return;
      closeMenu(false);
    };
    const onReposition = (e?: Event) => {
      if (e && e.target instanceof Node && popupRef.current?.contains(e.target)) return;
      closeMenu(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    window.addEventListener("scroll", onReposition, true);
    window.addEventListener("resize", onReposition);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("scroll", onReposition, true);
      window.removeEventListener("resize", onReposition);
    };
  }, [open]);

  useEffect(() => {
    if (open && activeIndex >= 0) optionRefs.current[activeIndex]?.focus({ preventScroll: true });
  }, [open, activeIndex]);

  function onTriggerKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openMenu(selectedIndex);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      openMenu(selectedIndex >= 0 ? selectedIndex : options.length - 1);
    }
  }

  function onOptionKeyDown(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex(Math.min(i + 1, options.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex(Math.max(i - 1, 0));
    } else if (e.key === "Home") {
      e.preventDefault();
      setActiveIndex(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActiveIndex(options.length - 1);
    } else if (e.key === "Escape") {
      e.preventDefault();
      closeMenu();
    } else if (e.key === "Tab") {
      closeMenu(false);
    }
  }

  return (
    <div ref={rootRef} className={cn("relative inline-flex", className)}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => (open ? closeMenu() : openMenu(selectedIndex))}
        onKeyDown={onTriggerKeyDown}
        className="inline-flex h-9 w-full items-center justify-between gap-2 rounded-md border border-border bg-surface ps-3 pe-2 text-sm text-foreground transition-colors hover:bg-surface-2"
      >
        <span className="flex min-w-0 items-center gap-2">
          {selected?.icon}
          <span className={cn("truncate", !selected && "text-tertiary-foreground")}>
            {selected ? selected.label : (placeholder ?? "Select")}
          </span>
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-tertiary-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && rect
        ? createPortal(
            <div
              ref={popupRef}
              className="fixed z-50 max-h-64 overflow-y-auto rounded-md border border-border bg-surface p-1 shadow-pop"
              style={{ top: rect.top, left: rect.left, minWidth: rect.width }}
            >
              {options.map((opt, i) => {
                const isSelected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    ref={(el) => {
                      optionRefs.current[i] = el;
                    }}
                    type="button"
                    aria-current={isSelected ? "true" : undefined}
                    onClick={() => selectAt(i)}
                    onKeyDown={(e) => onOptionKeyDown(e, i)}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-sm px-2.5 py-1.5 text-start text-sm transition-colors focus:bg-accent-soft focus:outline-none",
                      isSelected ? "text-foreground" : "text-muted-foreground hover:bg-accent-soft",
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      {opt.icon}
                      <span className="truncate">{opt.label}</span>
                    </span>
                    {isSelected ? <Check className="size-4 shrink-0 text-accent" /> : null}
                  </button>
                );
              })}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
