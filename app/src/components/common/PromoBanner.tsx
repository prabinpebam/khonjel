import { X } from "lucide-react";
import type { ReactNode } from "react";

interface PromoBannerProps {
  headline: ReactNode;
  supporting?: string;
  chips?: string[];
  onDismiss?: () => void;
}

/** Dismissible promo banner with a serif headline (library pages). */
export function PromoBanner({ headline, supporting, chips, onDismiss }: PromoBannerProps) {
  return (
    <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-accent to-primary p-6 text-primary-foreground">
      {onDismiss ? (
        <button
          type="button"
          aria-label="Dismiss"
          onClick={onDismiss}
          className="absolute end-3 top-3 grid size-7 place-items-center rounded-pill bg-surface/15 text-primary-foreground transition-colors hover:bg-surface/25"
        >
          <X className="size-4" />
        </button>
      ) : null}
      <p className="max-w-lg font-serif text-2xl font-medium italic">{headline}</p>
      {supporting ? (
        <p className="mt-2 max-w-md text-sm text-primary-foreground/80">{supporting}</p>
      ) : null}
      {chips && chips.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {chips.map((chip) => (
            <span
              key={chip}
              className="rounded-pill bg-surface/15 px-3 py-1 text-xs font-medium backdrop-blur-sm"
            >
              {chip}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
