import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthGate } from "@/components/auth-gate";
import { AppShell } from "@/components/app-shell";
import { MesPage, StatusPill } from "@/components/mes/mes-page";
import { SimpleList } from "@/components/mes/simple-list";
import { Button } from "@/components/ui/button";
import { ScrollText } from "lucide-react";

function tone(status: string): "success" | "warning" | "danger" | "info" | "muted" {
  if (status === "released" || status === "in_progress") return "info";
  if (status === "completed" || status === "closed") return "success";
  if (status === "on_hold") return "danger";
  return "warning";
}

export const Route = createFileRoute("/work-orders/")({
  ssr: false,
  head: () => ({ meta: [{ title: "Work Orders — CORTA QC" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <AuthGate>
      <AppShell>
        <MesPage
          icon={<ScrollText className="h-5 w-5" />}
          title="Work Orders"
          description="Plan, release and track production work orders with linked QC gates."
        >
          <SimpleList
            table="work_orders"
            entityName="Work Order"
            emptyIcon={<ScrollText className="h-6 w-6" />}
            columns={[
              { key: "number", label: "Number", render: (r: any) => <span className="font-mono text-xs">{r.number}</span> },
              { key: "lot_number", label: "Lot" },
              { key: "qty", label: "Qty", render: (r: any) => <span className="font-mono">{r.quantity_produced ?? 0}/{r.quantity_planned ?? 0}</span> },
              { key: "status", label: "Status", render: (r: any) => <StatusPill tone={tone(r.status)}>{r.status}</StatusPill> },
              { key: "planned_start", label: "Planned start", render: (r: any) => r.planned_start ? new Date(r.planned_start).toLocaleString() : "—" },
            ]}
            fields={[
              { name: "number", label: "Number", required: true, placeholder: "WO-2026-0001" },
              { name: "quantity_planned", label: "Planned quantity", type: "number", required: true },
              { name: "lot_number", label: "Lot number" },
              { name: "planned_start", label: "Planned start", type: "date" },
              { name: "planned_end", label: "Planned end", type: "date" },
              { name: "notes", label: "Notes", type: "textarea" },
            ]}
            extraActions={(r: any) => (
              <Button asChild variant="ghost" size="sm">
                <Link to="/work-orders/$id" params={{ id: r.id }}>Open</Link>
              </Button>
            )}
          />
        </MesPage>
      </AppShell>
    </AuthGate>
  ),
});
