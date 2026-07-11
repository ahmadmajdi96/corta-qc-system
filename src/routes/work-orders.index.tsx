import { createFileRoute } from "@tanstack/react-router";
import { AuthGate } from "@/components/auth-gate";
import { AppShell } from "@/components/app-shell";
import { MesPage, StatusPill } from "@/components/mes/mes-page";
import { SimpleList } from "@/components/mes/simple-list";
import { ScrollText } from "lucide-react";

function tone(status: string): "success" | "warning" | "danger" | "info" | "muted" {
  if (status === "released" || status === "in_progress") return "info";
  if (status === "completed") return "success";
  if (status === "on_hold") return "danger";
  if (status === "cancelled") return "muted";
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
            orderBy="created_at"
            emptyIcon={<ScrollText className="h-6 w-6" />}
            columns={[
              { key: "number", label: "Number", render: (r: any) => <span className="font-mono text-xs">{r.number}</span> },
              { key: "quantity", label: "Qty", render: (r: any) => <span className="font-mono">{r.quantity_completed ?? 0}/{r.quantity ?? 0}</span> },
              { key: "priority", label: "Priority" },
              { key: "status", label: "Status", render: (r: any) => <StatusPill tone={tone(r.status)}>{r.status}</StatusPill> },
              { key: "planned_start", label: "Planned start", render: (r: any) => r.planned_start ? new Date(r.planned_start).toLocaleString() : "—" },
            ]}
            fields={[
              { name: "number", label: "Number", required: true, placeholder: "WO-2026-0001" },
              { name: "quantity", label: "Quantity", type: "number", required: true },
              { name: "priority", label: "Priority", placeholder: "normal | high | urgent" },
              { name: "planned_start", label: "Planned start", type: "date" },
              { name: "planned_end", label: "Planned end", type: "date" },
              { name: "notes", label: "Notes", type: "textarea" },
            ]}
          />
        </MesPage>
      </AppShell>
    </AuthGate>
  ),
});
