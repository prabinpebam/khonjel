import type { ReactNode } from "react";
import { cn } from "@lib/utils";

/**
 * The hover-revealed action cluster pinned to the end of a list row. Must sit inside a `group`
 * row: it stays in layout (fades via opacity, never display) so rows don't reflow on hover.
 * Spacing/alignment (gap, items-*, shrink-0) comes via className; the buttons are children.
 */
export function RowActions({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "flex items-center opacity-0 transition-opacity group-hover:opacity-100",
        className,
      )}
    >
      {children}
    </div>
  );
}
