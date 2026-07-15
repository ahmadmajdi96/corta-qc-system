import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthGate } from "@/components/auth-gate";
import { AppShell } from "@/components/app-shell";
import { MesPage, StatusPill } from "@/components/mes/mes-page";
import { SimpleList } from "@/components/mes/simple-list";
import { Button } from "@/components/ui/button";
import { ScrollText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

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
            select="*, products(id, sku, name), production_lines(id, name)"
            emptyIcon={<ScrollText className="h-6 w-6" />}
            filters={[
              { key: "status", label: "Status", options: [
                { value: "planned", label: "Planned" },
                { value: "released", label: "Released" },
                { value: "in_progress", label: "In progress" },
                { value: "on_hold", label: "On hold" },
                { value: "completed", label: "Completed" },
                { value: "closed", label: "Closed" },
              ] },
            ]}
            columns={[
              { key: "number", label: "Number", render: (r: any) => <span className="font-mono text-xs">{r.number}</span> },
              { key: "product", label: "Product", render: (r: any) => r.products ? <span className="text-xs"><span className="font-mono">{r.products.sku}</span> · {r.products.name}</span> : <span className="text-xs text-muted-foreground">— none —</span>, exportValue: (r: any) => r.products?.sku ?? "" },
              { key: "lot_number", label: "Lot" },
              { key: "qty", label: "Qty", render: (r: any) => <span className="font-mono">{r.quantity_produced ?? 0}/{r.quantity_planned ?? 0}</span> },
              { key: "status", label: "Status", render: (r: any) => <StatusPill tone={tone(r.status)}>{r.status}</StatusPill> },
              { key: "planned_start", label: "Planned start", render: (r: any) => r.planned_start ? new Date(r.planned_start).toLocaleString() : "—" },
            ]}
            fields={[
              { name: "number", label: "Number", required: true, placeholder: "WO-2026-0001" },
              { name: "product_id", label: "Product", type: "select", required: true, loadOptions: async () => {
                const { data } = await supabase.from("products").select("id, sku, name").eq("is_active", true).order("sku");
                return (data ?? []).map((p: any) => ({ value: p.id, label: `${p.sku} · ${p.name}` }));
              } },
              { name: "line_id", label: "Production line", type: "select", loadOptions: async () => {
                const { data } = await supabase.from("production_lines").select("id, name").order("name");
                return (data ?? []).map((p: any) => ({ value: p.id, label: p.name }));
              } },
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
