import { Badge } from "@/components/ui/badge";
import type { ReactNode } from "react";

type Kind = "inspection" | "nc" | "ca" | "severity";

const STYLES: Record<string, { bg: string; label: string }> = {
  // inspection
  planned: { bg: "bg-status-planned/15 text-status-planned border border-status-planned/30", label: "Planned" },
  in_progress: { bg: "bg-status-in-progress/15 text-status-in-progress border border-status-in-progress/30", label: "In Progress" },
  completed: { bg: "bg-status-completed/15 text-status-completed border border-status-completed/30", label: "Completed" },
  cancelled: { bg: "bg-status-cancelled/15 text-status-cancelled border border-status-cancelled/30", label: "Cancelled" },
  // NC
  open: { bg: "bg-status-open/15 text-status-open border border-status-open/30", label: "Open" },
  under_investigation: { bg: "bg-status-investigating/15 text-status-investigating border border-status-investigating/30", label: "Under Investigation" },
  corrective_action_defined: { bg: "bg-status-ca-defined/15 text-status-ca-defined border border-status-ca-defined/30", label: "CA Defined" },
  closed: { bg: "bg-status-closed/15 text-status-closed border border-status-closed/30", label: "Closed" },
  rejected: { bg: "bg-status-cancelled/15 text-status-cancelled border border-status-cancelled/30", label: "Rejected" },
  // CA
  verified: { bg: "bg-status-verified/15 text-status-verified border border-status-verified/30", label: "Verified" },
  // Severity
  critical: { bg: "bg-severity-critical/15 text-severity-critical border border-severity-critical/30", label: "Critical" },
  major: { bg: "bg-severity-major/15 text-severity-major border border-severity-major/30", label: "Major" },
  minor: { bg: "bg-severity-minor/15 text-severity-minor border border-severity-minor/30", label: "Minor" },
};

export function StatusBadge({ status, kind }: { status: string; kind?: Kind }): ReactNode {
  const s = STYLES[status] ?? { bg: "bg-muted text-muted-foreground border border-border", label: status };
  return <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${s.bg}`}>{s.label}</span>;
}
