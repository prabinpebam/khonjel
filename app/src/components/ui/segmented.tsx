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
  className?: string;
}

/** Segmented control (e.g. Theme: Light / Dark / Auto). */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
}: SegmentedProps<T>) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-pill border border-border bg-surface-2 p-1",
        className,
      )}
      role="group"
    >
      {options.map((opt) => {
        const Icon = opt.icon;
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-pill px-3 py-1 text-xs font-medium transition-colors",
              active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {Icon ? <Icon className="size-3.5" /> : null}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
