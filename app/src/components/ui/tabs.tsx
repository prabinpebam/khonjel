import { cn } from "@lib/utils";

interface TabItem<T extends string> {
  value: T;
  label: string;
}

interface TabsProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  items: TabItem<T>[];
  className?: string;
}

/** Underline tab selector. */
export function Tabs<T extends string>({ value, onChange, items, className }: TabsProps<T>) {
  return (
    <div className={cn("flex items-center gap-5 border-b border-border", className)} role="tablist">
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={cn(
              "relative -mb-px border-b-2 pb-2.5 text-sm transition-colors",
              active
                ? "border-foreground font-semibold text-foreground"
                : "border-transparent text-tertiary-foreground hover:text-foreground",
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
