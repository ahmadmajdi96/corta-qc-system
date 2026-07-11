import { createFileRoute } from "@tanstack/react-router";
import { AuthGate } from "@/components/auth-gate";
import { AppShell } from "@/components/app-shell";
import { MesPage, StatusPill } from "@/components/mes/mes-page";
import { SimpleList } from "@/components/mes/simple-list";
import { ShieldCheck } from "lucide-react";

function tone(s: string): "success" | "warning" | "danger" | "info" | "muted" {
  if (s === "closed") return "success";
  if (s === "released") return "info";
  if (s === "scrap" || s === "rework") return "warning";
  return "danger";
}

export const Route = createFileRoute("/holds/")({
  ssr: false,
  head: () => ({ meta: [{ title: "Quality Holds — CORTA QC" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <AuthGate>
      <AppShell>
        <MesPage
          icon={<ShieldCheck className="h-5 w-5" />}
          title="Quality Holds"
          description="Quarantine, review and disposition non-conforming material."
        >
          <SimpleList
            table="quality_holds"
            entityName="Hold"
            emptyIcon={<ShieldCheck className="h-6 w-6" />}
            columns={[
              { key: "number", label: "Number", render: (r: any) => <span className="font-mono text-xs">{r.number}</span> },
              { key: "lot_number", label: "Lot" },
              { key: "quantity", label: "Qty", render: (r: any) => <span className="font-mono">{r.quantity ?? "—"}</span> },
              { key: "status", label: "Status", render: (r: any) => <StatusPill tone={tone(r.status)}>{r.status}</StatusPill> },
              { key: "disposition", label: "Disposition" },
              { key: "reason", label: "Reason" },
              { key: "opened_at", label: "Opened", render: (r: any) => new Date(r.opened_at).toLocaleString() },
            ]}
            fields={[
              { name: "number", label: "Number", required: true, placeholder: "HLD-2026-0001" },
              { name: "lot_number", label: "Lot number" },
              { name: "quantity", label: "Quantity", type: "number" },
              { name: "reason", label: "Reason", type: "textarea", required: true },
              { name: "notes", label: "Notes", type: "textarea" },
            ]}
          />
        </MesPage>
      </AppShell>
    </AuthGate>
  ),
});
