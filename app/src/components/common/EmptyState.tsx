import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="grid place-items-center rounded-lg border border-dashed border-border bg-surface-2 px-6 py-16 text-center">
      {Icon ? (
        <span className="mb-3 grid size-12 place-items-center rounded-pill bg-accent-soft text-accent">
          <Icon className="size-6" />
        </span>
      ) : null}
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {description ? <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
