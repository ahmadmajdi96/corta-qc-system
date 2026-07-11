import { createFileRoute } from "@tanstack/react-router";
import { AuthGate } from "@/components/auth-gate";
import { AppShell } from "@/components/app-shell";
import { MesPage, StatusPill } from "@/components/mes/mes-page";
import { SimpleList } from "@/components/mes/simple-list";
import { Gauge } from "lucide-react";

function calTone(next?: string): "success" | "warning" | "danger" | "muted" {
  if (!next) return "muted";
  const days = (new Date(next).getTime() - Date.now()) / 86400000;
  if (days < 0) return "danger";
  if (days < 14) return "warning";
  return "success";
}

function statusTone(s: string): "success" | "warning" | "danger" | "muted" {
  if (s === "active") return "success";
  if (s === "due") return "warning";
  if (s === "overdue") return "danger";
  return "muted";
}

export const Route = createFileRoute("/calibration/")({
  ssr: false,
  head: () => ({ meta: [{ title: "Calibration — CORTA QC" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <AuthGate>
      <AppShell>
        <MesPage
          icon={<Gauge className="h-5 w-5" />}
          title="Gages & Calibration"
          description="Measurement equipment register with calibration history and due dates."
        >
          <SimpleList
            table="gages"
            entityName="Gage"
            emptyIcon={<Gauge className="h-6 w-6" />}
            columns={[
              { key: "code", label: "Code", render: (r: any) => <span className="font-mono text-xs">{r.code}</span> },
              { key: "name", label: "Name" },
              { key: "gage_type", label: "Type" },
              { key: "resolution", label: "Resolution", render: (r: any) => r.resolution != null ? <span className="font-mono">{r.resolution}</span> : "—" },
              { key: "next_cal_date", label: "Next cal", render: (r: any) => (
                <StatusPill tone={calTone(r.next_cal_date)}>
                  {r.next_cal_date ? new Date(r.next_cal_date).toLocaleDateString() : "—"}
                </StatusPill>
              ) },
              { key: "status", label: "Status", render: (r: any) => <StatusPill tone={statusTone(r.status)}>{r.status}</StatusPill> },
            ]}
            fields={[
              { name: "code", label: "Code", required: true, placeholder: "CAL-001" },
              { name: "name", label: "Name", required: true, placeholder: "Mitutoyo Caliper 200mm" },
              { name: "gage_type", label: "Type", placeholder: "Caliper" },
              { name: "manufacturer", label: "Manufacturer" },
              { name: "serial_number", label: "Serial number" },
              { name: "resolution", label: "Resolution", type: "number" },
              { name: "location", label: "Location" },
              { name: "last_cal_date", label: "Last cal date", type: "date" },
              { name: "next_cal_date", label: "Next cal date", type: "date" },
            ]}
          />
        </MesPage>
      </AppShell>
    </AuthGate>
  ),
});
