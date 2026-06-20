import type { ComponentProps } from "react";
import { cn } from "@lib/utils";

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-tertiary-foreground",
        className,
      )}
      {...props}
    />
  );
}
