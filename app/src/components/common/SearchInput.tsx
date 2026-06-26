import { Search, X } from "lucide-react";
import { Input } from "@components/ui/input";
import { cn } from "@lib/utils";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  "aria-label"?: string;
  /** `md` = default field height; `sm` = compact (rail headers). */
  size?: "sm" | "md";
  /** Sizing/placement classes for the wrapper (e.g. a fixed width). */
  className?: string;
  /** Forwarded to the input; the clear button gets `${dataEval}-clear`. */
  "data-eval"?: string;
}

/** Search field: leading icon + a clear (X) button that appears once there's a query. */
export function SearchInput({
  value,
  onChange,
  placeholder,
  "aria-label": ariaLabel,
  size = "md",
  className,
  "data-eval": dataEval,
}: SearchInputProps) {
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute start-2 top-1/2 size-4 -translate-y-1/2 text-tertiary-foreground" />
      <Input
        aria-label={ariaLabel}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        data-eval={dataEval}
        className={cn("ps-8 pe-8", size === "sm" && "h-8")}
      />
      {value ? (
        <button
          type="button"
          aria-label="Clear search"
          data-eval={dataEval ? `${dataEval}-clear` : undefined}
          onClick={() => onChange("")}
          className="absolute end-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-tertiary-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      ) : null}
    </div>
  );
}
