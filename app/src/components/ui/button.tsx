import { type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@lib/utils";
import { buttonVariants } from "./button-variants";

export type ButtonProps = ComponentProps<"button"> & VariantProps<typeof buttonVariants>;

/**
 * Button — the reference variant pattern (design-system P5: variants are CVA,
 * never forked components). Styles live in `./button-variants`.
 */
export function Button({ className, variant, size, type = "button", ...props }: ButtonProps) {
  return (
    <button type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  );
}
