import { cn } from "@lib/utils";

interface ProgressProps {
  value: number;
  /** Fill color. dataviz = teal stat fill (default); accent = download/activity fill. */
  tone?: "dataviz" | "accent";
  /** Track classes — override height/width/track-bg (e.g. "h-1.5 w-32"). */
  className?: string;
  /** Fill classes — e.g. "duration-300" for a slower sweep. */
  barClassName?: string;
}

const TONE: Record<NonNullable<ProgressProps["tone"]>, string> = {
  dataviz: "bg-dataviz",
  accent: "bg-accent",
};

/** Determinate progress bar. Track sizing via className; fill color via tone. */
export function Progress({ value, tone = "dataviz", className, barClassName }: ProgressProps) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div
      className={cn("h-2 w-full overflow-hidden rounded-pill bg-surface-2", className)}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn("h-full rounded-pill transition-[width]", TONE[tone], barClassName)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
