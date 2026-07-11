import { type ReactNode } from "react";
import { Sparkles } from "lucide-react";

export function ComingSoonPage({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon?: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary to-info text-primary-foreground shadow-[var(--shadow-glow)]">
          {icon ?? <Sparkles className="h-5 w-5" />}
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="glass-panel rounded-2xl p-8">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
          <span className="status-dot animate-pulse-glow text-warning" />
          Module scaffolded · UI in progress
        </div>
        <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
          The underlying data model, RLS policies and API access for this module are
          already provisioned. The dedicated workspace UI is being built out in the next
          delivery pass — you can already query and mutate rows through the API or the
          backend viewer.
        </p>
      </div>
    </div>
  );
}
