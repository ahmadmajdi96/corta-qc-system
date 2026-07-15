import { createFileRoute } from "@tanstack/react-router";
import { AuthGate } from "@/components/auth-gate";
import { AppShell } from "@/components/app-shell";
import { MesPage, StatusPill } from "@/components/mes/mes-page";
import { SimpleList } from "@/components/mes/simple-list";
import { IsoSamplingCalculator } from "@/components/iso-sampling-calculator";
import { Truck } from "lucide-react";

function tone(s: string): "success" | "warning" | "danger" | "info" | "muted" {
  if (s === "accepted") return "success";
  if (s === "rejected") return "danger";
  if (s === "sampling" || s === "partial") return "warning";
  return "info";
}

export const Route = createFileRoute("/incoming/")({
  ssr: false,
  head: () => ({ meta: [{ title: "Incoming Inspection — CORTA QC" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <AuthGate>
      <AppShell>
        <MesPage
          icon={<Truck className="h-5 w-5" />}
          title="Incoming Inspection"
          description="Track received lots, ISO 2859-1 sampling and dispositions from suppliers."
        >
          <div className="mb-4">
            <IsoSamplingCalculator />
          </div>
          <SimpleList
            table="incoming_lots"
            entityName="Lot"
            emptyIcon={<Truck className="h-6 w-6" />}
            columns={[
              { key: "lot_number", label: "Lot", render: (r: any) => <span className="font-mono text-xs">{r.lot_number}</span> },
              { key: "po_number", label: "PO" },
              { key: "received_qty", label: "Qty", render: (r: any) => <span className="font-mono">{r.received_qty}</span> },
              { key: "received_at", label: "Received", render: (r: any) => new Date(r.received_at).toLocaleDateString() },
              { key: "status", label: "Status", render: (r: any) => <StatusPill tone={tone(r.status)}>{r.status}</StatusPill> },
            ]}
            fields={[
              { name: "lot_number", label: "Lot number", required: true },
              { name: "po_number", label: "PO number" },
              { name: "received_qty", label: "Received qty", type: "number", required: true },
              { name: "notes", label: "Notes", type: "textarea" },
            ]}
          />
        </MesPage>
      </AppShell>
    </AuthGate>
  ),
});
