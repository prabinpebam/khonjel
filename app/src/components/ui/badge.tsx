import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        neutral: "border border-border bg-surface-2 text-muted-foreground",
        accent: "bg-accent-soft text-accent",
        success: "bg-success/12 text-success",
        warning: "bg-warning/12 text-warning",
        danger: "bg-danger/12 text-danger",
      },
    },
    defaultVariants: { variant: "neutral" },
  },
);

type BadgeProps = ComponentProps<"span"> & VariantProps<typeof badgeVariants>;

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
