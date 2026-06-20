import { cn } from "@lib/utils";

interface ProgressProps {
  value: number;
  className?: string;
}

/** Determinate progress bar (teal dataviz fill). */
export function Progress({ value, className }: ProgressProps) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div
      className={cn("h-2 w-full overflow-hidden rounded-pill bg-surface-2", className)}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="h-full rounded-pill bg-dataviz transition-[width]" style={{ width: `${pct}%` }} />
    </div>
  );
}
