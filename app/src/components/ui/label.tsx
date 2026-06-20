import type { ComponentProps } from "react";
import { cn } from "@lib/utils";

export function Label({ className, ...props }: ComponentProps<"label">) {
  // eslint-disable-next-line jsx-a11y/label-has-associated-control -- generic primitive; caller supplies htmlFor.
  return <label className={cn("text-sm font-medium text-foreground", className)} {...props} />;
}
