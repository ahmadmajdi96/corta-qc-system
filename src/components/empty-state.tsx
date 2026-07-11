import type { ReactNode } from "react";
import { Inbox } from "lucide-react";

export function EmptyState({ title, description, action, icon }: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-10 px-4">
      <div className="rounded-full bg-muted p-4 text-muted-foreground mb-3">
        {icon ?? <Inbox className="h-6 w-6" />}
      </div>
      <div className="text-sm font-medium">{title}</div>
      {description && <div className="text-xs text-muted-foreground mt-1 max-w-md">{description}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
