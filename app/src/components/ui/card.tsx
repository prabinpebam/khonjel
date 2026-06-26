import type { ComponentProps, ElementType } from "react";
import { cn } from "@lib/utils";

type CardProps = ComponentProps<"div"> & {
  /** Render as a landmark element (e.g. "section") to keep semantics + aria-label. */
  as?: "div" | "section" | "article";
};

export function Card({ as = "div", className, ...props }: CardProps) {
  const Tag = as as ElementType;
  return (
    <Tag
      className={cn("rounded-md border border-border bg-surface shadow-card", className)}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-1 p-5", className)} {...props} />;
}

export function CardTitle({ className, children, ...props }: ComponentProps<"h3">) {
  return (
    <h3 className={cn("text-base font-semibold text-foreground", className)} {...props}>
      {children}
    </h3>
  );
}

export function CardDescription({ className, ...props }: ComponentProps<"p">) {
  return <p className={cn("text-sm text-muted-foreground", className)} {...props} />;
}

export function CardContent({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("p-5 pt-0", className)} {...props} />;
}

export function CardFooter({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex items-center gap-2 p-5 pt-0", className)} {...props} />;
}
