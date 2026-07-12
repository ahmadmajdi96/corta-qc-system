import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthGate } from "@/components/auth-gate";
import { AppShell } from "@/components/app-shell";
import { MesPage, StatusPill } from "@/components/mes/mes-page";
import { SimpleList } from "@/components/mes/simple-list";
import { Button } from "@/components/ui/button";
import { ListChecks } from "lucide-react";

export const Route = createFileRoute("/inspection-plans/")({
  ssr: false,
  head: () => ({ meta: [{ title: "Inspection Plans — CORTA QC" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <AuthGate>
      <AppShell>
        <MesPage
          icon={<ListChecks className="h-5 w-5" />}
          title="Inspection Plans"
          description="AQL-based sampling plans linked to products and processes."
        >
          <SimpleList
            table="inspection_plans"
            entityName="Plan"
            emptyIcon={<ListChecks className="h-6 w-6" />}
            columns={[
              { key: "name", label: "Name" },
              { key: "plan_type", label: "Type", render: (r: any) => <StatusPill tone="info">{r.plan_type}</StatusPill> },
              { key: "aql_level", label: "AQL" },
              { key: "sample_size_rule", label: "Sample rule" },
              { key: "is_active", label: "Status", render: (r: any) => <StatusPill tone={r.is_active ? "success" : "muted"}>{r.is_active ? "Active" : "Inactive"}</StatusPill> },
            ]}
            fields={[
              { name: "name", label: "Name", required: true },
              {
                name: "plan_type",
                label: "Type",
                type: "select",
                required: true,
                options: [
                  { value: "incoming", label: "Incoming" },
                  { value: "in_process", label: "In-Process" },
                  { value: "final", label: "Final" },
                ],
              },
              {
                name: "aql_level",
                label: "AQL Level (Normal Inspection)",
                type: "select",
                required: true,
                options: ["0.065", "0.10", "0.15", "0.25", "0.40", "0.65", "1.0", "1.5", "2.5", "4.0", "6.5"].map(
                  (v) => ({ value: v, label: v }),
                ),
              },
              {
                name: "sample_size_rule",
                label: "Inspection Level (ANSI/ASQ Z1.4)",
                type: "select",
                required: true,
                options: [
                  { value: "ANSI Z1.4 General Level I", label: "General Level I" },
                  { value: "ANSI Z1.4 General Level II", label: "General Level II (default)" },
                  { value: "ANSI Z1.4 General Level III", label: "General Level III" },
                  { value: "ANSI Z1.4 Special Level S-1", label: "Special Level S-1" },
                  { value: "ANSI Z1.4 Special Level S-2", label: "Special Level S-2" },
                  { value: "ANSI Z1.4 Special Level S-3", label: "Special Level S-3" },
                  { value: "ANSI Z1.4 Special Level S-4", label: "Special Level S-4" },
                ],
              },
              {
                name: "standard_reference",
                label: "Standard reference",
                type: "select",
                options: [
                  { value: "ISO 9001", label: "ISO 9001" },
                  { value: "ASTM", label: "ASTM" },
                  { value: "ASME", label: "ASME" },
                  { value: "ANSI/ASQ Z1.4", label: "ANSI/ASQ Z1.4" },
                  { value: "Client procedure", label: "Client procedure" },
                ],
              },
              { name: "description", label: "Description", type: "textarea" },
            ]}
            extraActions={(row: any) => (
              <Button asChild size="sm" variant="outline">
                <Link to="/inspection-plans/$id" params={{ id: row.id }}>Open</Link>
              </Button>
            )}
          />
        </MesPage>
      </AppShell>
    </AuthGate>
  ),
});
