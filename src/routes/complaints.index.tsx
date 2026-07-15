import { createFileRoute } from "@tanstack/react-router";
import { AuthGate } from "@/components/auth-gate";
import { AppShell } from "@/components/app-shell";
import { MesPage, StatusPill } from "@/components/mes/mes-page";
import { SimpleList } from "@/components/mes/simple-list";
import { supabase } from "@/integrations/supabase/client";
import { MessageSquareWarning } from "lucide-react";

function statusTone(s: string): "success" | "warning" | "danger" | "info" | "muted" {
  if (s === "closed" || s === "resolved") return "success";
  if (s === "cancelled") return "muted";
  if (s === "new" || s === "open") return "warning";
  if (s === "investigating" || s === "responded") return "info";
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

export const Route = createFileRoute("/complaints/")({
  ssr: false,
  head: () => ({ meta: [
    { title: "Customer Complaints — CORTA QC" },
    { name: "description", content: "Intake and investigation of customer complaints with root-cause and disposition tracking." },
    { name: "robots", content: "noindex" },
  ] }),
  component: () => (
    <AuthGate>
      <AppShell>
        <MesPage
          icon={<MessageSquareWarning className="h-5 w-5" />}
          title="Customer Complaints"
          description="Intake, investigation, and disposition of customer complaints."
        >
          <SimpleList
            table="customer_complaints"
            entityName="Complaint"
            emptyIcon={<MessageSquareWarning className="h-6 w-6" />}
            exportFilename="customer_complaints"
            filters={[
              { key: "status", label: "Status", options: [
                { value: "new", label: "New" },
                { value: "open", label: "Open" },
                { value: "investigating", label: "Investigating" },
                { value: "responded", label: "Responded" },
                { value: "resolved", label: "Resolved" },
                { value: "closed", label: "Closed" },
                { value: "cancelled", label: "Cancelled" },
              ] },
              { key: "severity", label: "Severity", options: [
                { value: "low", label: "Low" }, { value: "medium", label: "Medium" },
                { value: "high", label: "High" }, { value: "critical", label: "Critical" },
              ] },
            ]}
            columns={[
              { key: "number", label: "Number", render: (r: any) => <span className="font-mono text-xs">{r.number ?? "—"}</span> },
              { key: "customer_name", label: "Customer" },
              { key: "description", label: "Complaint", render: (r: any) => <span className="line-clamp-1 max-w-md">{r.description ?? "—"}</span> },
              { key: "severity", label: "Severity", render: (r: any) => <StatusPill tone={r.severity === "critical" || r.severity === "high" ? "danger" : "warning"}>{r.severity ?? "—"}</StatusPill> },
              { key: "status", label: "Status", render: (r: any) => <StatusPill tone={statusTone(r.status)}>{r.status ?? "—"}</StatusPill> },
              { key: "response_due_at", label: "Response due", render: (r: any) => r.response_due_at ? new Date(r.response_due_at).toLocaleDateString() : "—" },
            ]}
            fields={[
              { name: "customer_name", label: "Customer name", required: true },
              { name: "customer_ref", label: "Customer reference (PO/RMA)" },
              { name: "product_id", label: "Product", type: "select",
                loadOptions: () => loadOptions("products", "name", ", sku") },
              { name: "lot_number", label: "Lot / batch" },
              { name: "severity", label: "Severity", type: "select",
                options: [
                  { value: "low", label: "Low" }, { value: "medium", label: "Medium" },
                  { value: "high", label: "High" }, { value: "critical", label: "Critical" },
                ] },
              { name: "status", label: "Status", type: "select",
                options: [
                  { value: "new", label: "New" }, { value: "investigating", label: "Investigating" },
                  { value: "responded", label: "Responded" }, { value: "resolved", label: "Resolved" },
                  { value: "closed", label: "Closed" },
                ] },
              { name: "description", label: "Complaint description", type: "textarea", required: true },
              { name: "response_due_at", label: "Response due", type: "date" },
              { name: "assigned_to", label: "Assigned to", type: "select",
                loadOptions: () => loadOptions("profiles", "full_name", ", email") },
            ]}
          />
        </MesPage>
      </AppShell>
    </AuthGate>
  ),
});
