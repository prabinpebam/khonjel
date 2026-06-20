import { ChevronDown } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@lib/utils";

/** Styled native select (accessible, no extra deps) with a chevron affordance. */
export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <div className="relative inline-flex">
      <select
        className={cn(
          "h-9 appearance-none rounded-md border border-border bg-surface ps-3 pe-8 text-sm text-foreground",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 size-4 -translate-y-1/2 text-tertiary-foreground end-2" />
    </div>
  );
}
