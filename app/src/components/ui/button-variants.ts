import { cva } from "class-variance-authority";

/**
 * Button variants (CVA) live beside the component so the component module exports
 * only components (clean Fast Refresh) while other primitives can still compose
 * these styles. Every class is a token utility (design-system P1/P5).
 */
export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:bg-primary/90",
        accent: "bg-accent text-accent-foreground hover:bg-accent/90",
        secondary: "border border-border bg-surface-2 text-foreground hover:bg-foreground/5",
        outline: "border border-border bg-surface text-foreground hover:bg-foreground/5",
        ghost: "text-foreground hover:bg-foreground/5",
        destructive: "bg-danger text-danger-foreground hover:bg-danger/90",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-9 px-4",
        lg: "h-10 px-5 text-base",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);
