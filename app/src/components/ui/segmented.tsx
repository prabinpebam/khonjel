import type { LucideIcon } from "lucide-react";
import { cn } from "@lib/utils";

interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: LucideIcon;
}

interface SegmentedProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: SegmentedOption<T>[];
  /** `md` shows label (+ optional icon); `icon` is a compact icon-only control. */
  size?: "md" | "icon";
  /** `solid` = primary active on a bordered surface; `soft` = accent-soft active, borderless. */
  tone?: "solid" | "soft";
  className?: string;
  "aria-label"?: string;
}

/**
 * Segmented control (e.g. Theme: Light / Dark / Auto). One implementation, two contexts:
 * the bordered label form (Settings) and the compact icon-only soft form (title bar).
 */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = "md",
  tone = "solid",
  className,
  "aria-label": ariaLabel,
}: SegmentedProps<T>) {
  const iconOnly = size === "icon";
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex items-center rounded-pill p-1",
        tone === "soft" ? "gap-0.5 bg-foreground/5" : "gap-1 border border-border bg-surface-2",
        className,
      )}
    >
      {options.map((opt) => {
        const Icon = opt.icon;
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            aria-label={iconOnly ? opt.label : undefined}
            onClick={() => onChange(opt.value)}
            className={cn(
              "inline-flex items-center justify-center rounded-pill font-medium transition-colors",
              iconOnly ? "size-7" : "gap-1.5 px-3 py-1 text-xs",
              active
                ? tone === "soft"
                  ? "bg-accent-soft text-accent"
                  : "bg-primary text-primary-foreground"
                : tone === "soft"
                  ? "text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
                  : "text-muted-foreground hover:text-foreground",
            )}
          >
            {Icon ? <Icon className={iconOnly ? "size-4" : "size-3.5"} /> : null}
            {iconOnly ? null : opt.label}
          </button>
        );
      })}
    </div>
  );
}
