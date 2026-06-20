import type { ReactNode } from "react";

/** The white content panel that floats on the greige canvas, rounded at the top-left. */
export function ContentPanel({ children }: { children: ReactNode }) {
  return (
    <main className="min-w-0 flex-1 overflow-y-auto rounded-tl-lg border-s border-t border-border bg-surface">
      <div className="mx-auto w-full max-w-[var(--content-max-width)] px-8 py-7">{children}</div>
    </main>
  );
}
