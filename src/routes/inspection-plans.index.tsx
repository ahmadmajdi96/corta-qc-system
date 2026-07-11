import { createFileRoute } from "@tanstack/react-router";
import { AuthGate } from "@/components/auth-gate";
import { AppShell } from "@/components/app-shell";
import { MesPage, StatusPill } from "@/components/mes/mes-page";
import { SimpleList } from "@/components/mes/simple-list";
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
          description="AQL-based sampling plans linked to products, stations and incoming lots."
        >
          <SimpleList
            table="inspection_plans"
            entityName="Plan"
            emptyIcon={<ListChecks className="h-6 w-6" />}
            columns={[
              { key: "code", label: "Code", render: (r: any) => <span className="font-mono text-xs">{r.code}</span> },
              { key: "name", label: "Name" },
              { key: "plan_type", label: "Type", render: (r: any) => <StatusPill tone="info">{r.plan_type}</StatusPill> },
              { key: "aql_level", label: "AQL" },
              { key: "sample_size_rule", label: "Sample rule" },
              { key: "is_active", label: "Status", render: (r: any) => <StatusPill tone={r.is_active ? "success" : "muted"}>{r.is_active ? "Active" : "Inactive"}</StatusPill> },
            ]}
            fields={[
              { name: "code", label: "Code", required: true, placeholder: "PLN-001" },
              { name: "name", label: "Name", required: true },
              { name: "plan_type", label: "Type", placeholder: "in_process | incoming | final" },
              { name: "aql_level", label: "AQL level", placeholder: "1.0 | 2.5 | 4.0" },
              { name: "sample_size_rule", label: "Sample size rule", placeholder: "ANSI Z1.4 Level II" },
              { name: "notes", label: "Notes", type: "textarea" },
            ]}
          />
        </MesPage>
      </AppShell>
    </AuthGate>
  ),
});
