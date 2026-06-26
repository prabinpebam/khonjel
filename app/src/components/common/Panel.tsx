import type { ReactNode } from "react";
import { cn } from "@lib/utils";

interface PanelProps {
  as?: "div" | "aside" | "section";
  className?: string;
  children?: ReactNode;
  "aria-label"?: string;
}

/**
 * Bordered, full-height surface that clips its children and lays them out in a column -- the shell
 * for the app-like list / editor / conversation panes. Distinct from `Card` (which is an elevated,
 * non-clipping inset); sizing/placement (width, flex) comes via `className`.
 */
export function Panel({ as: Tag = "div", className, children, "aria-label": ariaLabel }: PanelProps) {
  return (
    <Tag
      aria-label={ariaLabel}
      className={cn(
        "flex flex-col overflow-hidden rounded-lg border border-border bg-surface",
        className,
      )}
    >
      {children}
    </Tag>
  );
}
