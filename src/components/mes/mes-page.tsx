import { type ReactNode } from "react";

export function MesPage({
  icon,
  title,
  description,
  action,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary to-info text-primary-foreground shadow-[var(--shadow-glow)]">
            {icon}
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
        {action}
      </div>
      <div className="glass-panel rounded-2xl p-4 sm:p-6">{children}</div>
    </div>
  );
}

export function StatusPill({ tone = "muted", children }: { tone?: "success" | "warning" | "danger" | "info" | "muted"; children: ReactNode }) {
  const styles: Record<string, string> = {
    success: "bg-success/15 text-success border-success/30",
    warning: "bg-warning/15 text-warning border-warning/30",
    danger: "bg-destructive/15 text-destructive border-destructive/30",
    info: "bg-info/15 text-info border-info/30",
    muted: "bg-muted text-muted-foreground border-border",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider ${styles[tone]}`}>
      {children}
    </span>
  );
}
