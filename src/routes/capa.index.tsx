import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthGate } from "@/components/auth-gate";
import { AppShell } from "@/components/app-shell";
import { MesPage, StatusPill } from "@/components/mes/mes-page";
import { SimpleList } from "@/components/mes/simple-list";
import { FileSearch } from "lucide-react";
import { Button } from "@/components/ui/button";

function tone(s: string): "success" | "warning" | "danger" | "info" | "muted" {
  if (s === "closed") return "success";
  if (s === "in_progress") return "info";
  if (s === "on_hold") return "warning";
  return "danger";
}

export const Route = createFileRoute("/capa/")({
  ssr: false,
  head: () => ({ meta: [{ title: "CAPA (8D) — CORTA QC" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <AuthGate>
      <AppShell>
        <MesPage
          icon={<FileSearch className="h-5 w-5" />}
          title="Corrective & Preventive Actions"
          description="8D problem-solving workflow — from team formation through closure."
        >
          <SimpleList
            table="capa_records"
            entityName="CAPA"
            emptyIcon={<FileSearch className="h-6 w-6" />}
            columns={[
              { key: "number", label: "Number", render: (r: any) => <span className="font-mono text-xs">{r.number}</span> },
              { key: "title", label: "Title" },
              { key: "methodology", label: "Method", render: (r: any) => <StatusPill tone="info">{r.methodology}</StatusPill> },
              { key: "status", label: "Status", render: (r: any) => <StatusPill tone={tone(r.status)}>{r.status}</StatusPill> },
              { key: "due_date", label: "Due", render: (r: any) => r.due_date ?? "—" },
            ]}
            fields={[
              { name: "number", label: "Number", required: true, placeholder: "CAPA-2026-0001" },
              { name: "title", label: "Title", required: true },
              { name: "methodology", label: "Methodology", placeholder: "8d | 5why | fishbone" },
              { name: "due_date", label: "Due date", type: "date" },
              { name: "d2_problem", label: "Problem description (D2)", type: "textarea" },
            ]}
            extraActions={(r: any) => (
              <Button asChild variant="ghost" size="sm">
                <Link to="/capa/$id" params={{ id: r.id }}>Open</Link>
              </Button>
            )}
          />
        </MesPage>
      </AppShell>
    </AuthGate>
  ),
});
