import type { ReactNode } from "react";
import { cn } from "@lib/utils";

/** Monospace keycap for hotkeys and Transform bindings. */
export function Keycap({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "inline-flex items-center rounded-sm bg-primary px-1.5 py-0.5 font-mono text-xs text-primary-foreground",
        className,
      )}
    >
      {children}
    </kbd>
  );
}
