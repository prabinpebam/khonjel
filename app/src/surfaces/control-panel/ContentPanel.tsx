import type { ReactNode } from "react";
import { cn } from "@lib/utils";

/** The white content panel that floats on the greige canvas, rounded at the top-left.
 *  `fill` views (chat, notes) own the full height and scroll internally instead of scrolling the
 *  whole panel, so they can pin footers/sidebars to a bordered boundary. */
export function ContentPanel({
  children,
  view,
  fill,
}: {
  children: ReactNode;
  view?: string;
  fill?: boolean;
}) {
  return (
    <main
      data-eval="content"
      data-eval-view={view}
      className={cn(
        "min-w-0 flex-1 rounded-tl-lg border-s border-t border-border bg-surface",
        fill ? "overflow-hidden" : "overflow-y-auto",
      )}
    >
      <div
        className={cn(
          "mx-auto w-full max-w-[var(--content-max-width)] px-8 py-7",
          fill && "flex h-full flex-col",
        )}
      >
        {children}
      </div>
    </main>
  );
}
