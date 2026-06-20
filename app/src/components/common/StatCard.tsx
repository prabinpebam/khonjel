import { Card } from "@components/ui/card";

interface StatCardProps {
  value: string;
  label: string;
  sub?: string;
}

export function StatCard({ value, label, sub }: StatCardProps) {
  return (
    <Card className="p-5">
      <p className="text-4xl font-bold tabular-nums text-foreground">{value}</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-tertiary-foreground">
        {label}
      </p>
      {sub ? <p className="mt-1 text-xs text-muted-foreground">{sub}</p> : null}
    </Card>
  );
}
