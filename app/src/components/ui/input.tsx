import type { ComponentProps } from "react";
import { cn } from "@lib/utils";

export function Input({ className, type = "text", ...props }: ComponentProps<"input">) {
  return (
    <input
      type={type}
      className={cn(
        "h-9 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground placeholder:text-tertiary-foreground",
        className,
      )}
      {...props}
    />
  );
}
