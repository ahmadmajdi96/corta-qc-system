import { createFileRoute } from "@tanstack/react-router";
import { AuthGate } from "@/components/auth-gate";
import { AppShell } from "@/components/app-shell";
import { MesPage, StatusPill } from "@/components/mes/mes-page";
import { SimpleList } from "@/components/mes/simple-list";
import { Cpu } from "lucide-react";

export const Route = createFileRoute("/stations/")({
  ssr: false,
  head: () => ({ meta: [{ title: "Stations — CORTA QC" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <AuthGate>
      <AppShell>
        <MesPage
          icon={<Cpu className="h-5 w-5" />}
          title="Stations"
          description="Workstations linked to production lines where inspections and SPC samples are recorded."
        >
          <SimpleList
            table="stations"
            entityName="Station"
            emptyIcon={<Cpu className="h-6 w-6" />}
            columns={[
              { key: "code", label: "Code", render: (r: any) => <span className="font-mono text-xs">{r.code}</span> },
              { key: "name", label: "Name" },
              { key: "operation", label: "Operation" },
              { key: "is_active", label: "Status", render: (r: any) => <StatusPill tone={r.is_active ? "success" : "muted"}>{r.is_active ? "Active" : "Inactive"}</StatusPill> },
            ]}
            fields={[
              { name: "code", label: "Code", required: true, placeholder: "STA-01" },
              { name: "name", label: "Name", required: true, placeholder: "Torque Station" },
              { name: "operation", label: "Operation", placeholder: "Fastening" },
            ]}
          />
        </MesPage>
      </AppShell>
    </AuthGate>
  ),
});
