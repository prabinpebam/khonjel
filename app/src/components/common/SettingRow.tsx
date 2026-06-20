import type { ReactNode } from "react";

interface SettingGroupProps {
  label?: string;
  children: ReactNode;
}

export function SettingGroup({ label, children }: SettingGroupProps) {
  return (
    <section className="mb-6">
      {label ? (
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-tertiary-foreground">
          {label}
        </h3>
      ) : null}
      <div className="divide-y divide-border rounded-md border border-border bg-surface">
        {children}
      </div>
    </section>
  );
}

interface SettingRowProps {
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  control: ReactNode;
}

export function SettingRow({ title, subtitle, badge, control }: SettingRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-4">
      <div className="flex min-w-0 flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">{title}</span>
          {badge}
        </div>
        {subtitle ? <span className="text-xs text-muted-foreground">{subtitle}</span> : null}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}
