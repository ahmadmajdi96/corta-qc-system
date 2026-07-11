import { createFileRoute } from "@tanstack/react-router";
import { AuthGate } from "@/components/auth-gate";
import { AppShell } from "@/components/app-shell";
import { MesPage, StatusPill } from "@/components/mes/mes-page";
import { SimpleList } from "@/components/mes/simple-list";
import { Factory } from "lucide-react";

export const Route = createFileRoute("/lines/")({
  ssr: false,
  head: () => ({ meta: [{ title: "Production Lines — CORTA QC" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <AuthGate>
      <AppShell>
        <MesPage
          icon={<Factory className="h-5 w-5" />}
          title="Production Lines"
          description="Physical assembly and packaging lines where quality events are captured."
        >
          <SimpleList
            table="production_lines"
            entityName="Line"
            emptyIcon={<Factory className="h-6 w-6" />}
            columns={[
              { key: "code", label: "Code", render: (r: any) => <span className="font-mono text-xs">{r.code ?? "—"}</span> },
              { key: "name", label: "Name" },
              { key: "area", label: "Area" },
              { key: "is_active", label: "Status", render: (r: any) => <StatusPill tone={r.is_active ? "success" : "muted"}>{r.is_active ? "Active" : "Inactive"}</StatusPill> },
            ]}
            fields={[
              { name: "code", label: "Code", placeholder: "LINE-01" },
              { name: "name", label: "Name", required: true, placeholder: "Assembly Line 1" },
              { name: "area", label: "Area", placeholder: "Main floor" },
            ]}
          />
        </MesPage>
      </AppShell>
    </AuthGate>
  ),
});
