import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

export function ErrorState({ title, description, onRetry, children }: {
  title?: string; description?: string; onRetry?: () => void; children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-10 px-4">
      <div className="rounded-full bg-destructive/10 text-destructive p-4 mb-3">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <div className="text-sm font-medium">{title ?? "Something went wrong"}</div>
      {description && <div className="text-xs text-muted-foreground mt-1 max-w-md">{description}</div>}
      {children}
      {onRetry && <Button className="mt-4" variant="outline" onClick={onRetry}>Retry</Button>}
    </div>
  );
}
