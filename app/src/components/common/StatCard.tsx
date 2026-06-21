import { Card } from "@components/ui/card";
import { cn } from "@lib/utils";

interface StatCardProps {
  value: string;
  label: string;
  sub?: string;
  valueClassName?: string;
}

export function StatCard({ value, label, sub, valueClassName }: StatCardProps) {
  return (
    <Card className="p-5">
      <p className={cn("text-4xl font-bold tabular-nums text-foreground", valueClassName)}>{value}</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-tertiary-foreground">
        {label}
      </p>
      {sub ? <p className="mt-1 text-xs text-muted-foreground">{sub}</p> : null}
    </Card>
  );
}
