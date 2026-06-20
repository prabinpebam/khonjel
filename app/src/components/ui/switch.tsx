import { cn } from "@lib/utils";

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  id?: string;
  disabled?: boolean;
  label?: string;
}

/** Pill toggle. ON = primary fill, OFF = greige track. */
export function Switch({ checked, onCheckedChange, id, disabled, label }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "inline-flex h-6 w-11 shrink-0 items-center rounded-pill transition-colors disabled:opacity-50",
        checked ? "bg-primary" : "bg-border",
      )}
    >
      <span
        className={cn(
          "inline-block size-4 rounded-pill bg-surface shadow-card transition-transform",
          checked ? "translate-x-6" : "translate-x-1",
        )}
      />
    </button>
  );
}
