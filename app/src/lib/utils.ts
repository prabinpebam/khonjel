import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** The one and only class-merge helper (design-system P12 — no forked utilities). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
