import { createFileRoute } from "@tanstack/react-router";
import { AuthGate } from "@/components/auth-gate";
import { AppShell } from "@/components/app-shell";
import { MesPage, StatusPill } from "@/components/mes/mes-page";
import { SimpleList } from "@/components/mes/simple-list";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle } from "lucide-react";

function statusTone(s: string): "success" | "warning" | "danger" | "info" | "muted" {
  if (s === "closed" || s === "verified") return "success";
  if (s === "cancelled") return "muted";
  if (s === "open" || s === "issued") return "warning";
  if (s === "responded" || s === "in_review") return "info";
  return "info";
}

async function loadOptions(table: string, label: string, extra = "") {
  const { data, error } = await supabase.from(table as any).select(`id, ${label}${extra}`).limit(200);
  if (error) return [];
  return (data ?? []).map((r: any) => ({
    value: r.id,
    label: extra ? `${r[label]} · ${r[extra.replace(/^,\s*/, "")] ?? ""}` : r[label] ?? r.id.slice(0, 8),
  }));
}

export const Route = createFileRoute("/supplier-scars/")({
  ssr: false,
  head: () => ({ meta: [
    { title: "Supplier SCARs — CORTA QC" },
    { name: "description", content: "Supplier Corrective Action Requests: track root-cause, corrective action, and effectiveness verification." },
    { name: "robots", content: "noindex" },
  ] }),
  component: () => (
    <AuthGate>
      <AppShell>
        <MesPage
          icon={<AlertTriangle className="h-5 w-5" />}
          title="Supplier SCARs"
          description="Corrective actions issued to suppliers with root-cause and effectiveness tracking."
        >
          <SimpleList
            table="supplier_scars"
            entityName="SCAR"
            emptyIcon={<AlertTriangle className="h-6 w-6" />}
            exportFilename="supplier_scars"
            filters={[
              { key: "status", label: "Status", options: [
                { value: "open", label: "Open" },
                { value: "issued", label: "Issued" },
                { value: "responded", label: "Responded" },
                { value: "in_review", label: "In review" },
                { value: "closed", label: "Closed" },
                { value: "cancelled", label: "Cancelled" },
              ] },
              { key: "severity", label: "Severity", options: [
                { value: "low", label: "Low" },
                { value: "medium", label: "Medium" },
                { value: "high", label: "High" },
                { value: "critical", label: "Critical" },
              ] },
            ]}
            columns={[
              { key: "number", label: "Number", render: (r: any) => <span className="font-mono text-xs">{r.number ?? "—"}</span> },
              { key: "issue_description", label: "Issue", render: (r: any) => <span className="line-clamp-1 max-w-md">{r.issue_description ?? "—"}</span> },
              { key: "severity", label: "Severity", render: (r: any) => <StatusPill tone={r.severity === "critical" || r.severity === "high" ? "danger" : "warning"}>{r.severity ?? "—"}</StatusPill> },
              { key: "status", label: "Status", render: (r: any) => <StatusPill tone={statusTone(r.status)}>{r.status ?? "—"}</StatusPill> },
              { key: "corrective_action_due", label: "CA due", render: (r: any) => r.corrective_action_due ?? "—" },
            ]}
            fields={[
              { name: "supplier_id", label: "Supplier", type: "select", required: true,
                loadOptions: () => loadOptions("suppliers", "name", ", code") },
              { name: "severity", label: "Severity", type: "select",
                options: [
                  { value: "low", label: "Low" }, { value: "medium", label: "Medium" },
                  { value: "high", label: "High" }, { value: "critical", label: "Critical" },
                ] },
              { name: "status", label: "Status", type: "select",
                options: [
                  { value: "open", label: "Open" }, { value: "issued", label: "Issued" },
                  { value: "responded", label: "Responded" }, { value: "in_review", label: "In review" },
                  { value: "closed", label: "Closed" }, { value: "cancelled", label: "Cancelled" },
                ] },
              { name: "issue_description", label: "Issue description", type: "textarea", required: true },
              { name: "corrective_action_due", label: "Corrective action due", type: "date" },
              { name: "assigned_to", label: "Assigned to (Supplier QE)", type: "select",
                loadOptions: () => loadOptions("profiles", "full_name", ", email") },
              { name: "linked_incoming_lot_id", label: "Linked incoming lot", type: "select",
                loadOptions: () => loadOptions("incoming_lots", "lot_number", ", part_number") },
            ]}
          />
        </MesPage>
      </AppShell>
    </AuthGate>
  ),
});
