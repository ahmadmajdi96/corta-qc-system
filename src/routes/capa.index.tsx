import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthGate } from "@/components/auth-gate";
import { AppShell } from "@/components/app-shell";
import { MesPage, StatusPill } from "@/components/mes/mes-page";
import { SimpleList } from "@/components/mes/simple-list";
import { supabase } from "@/integrations/supabase/client";
import { FileSearch } from "lucide-react";
import { Button } from "@/components/ui/button";

function tone(s: string): "success" | "warning" | "danger" | "info" | "muted" {
  if (s === "closed") return "success";
  if (s === "in_progress" || s === "verification") return "info";
  if (s === "cancelled") return "muted";
  return "warning";
}

async function loadOptions(table: string, label: string, extra = "") {
  const { data, error } = await supabase.from(table as any).select(`id, ${label}${extra}`).limit(200);
  if (error) return [];
  return (data ?? []).map((r: any) => ({
    value: r.id,
    label: extra ? `${r[label]} · ${r[extra.replace(/^,\s*/, "")] ?? ""}` : r[label] ?? r.id.slice(0, 8),
  }));
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
              { key: "capa_number", label: "Number", render: (r: any) => <span className="font-mono text-xs">{r.capa_number ?? "—"}</span> },
              { key: "d2_problem", label: "Problem", render: (r: any) => <span className="line-clamp-1 max-w-md">{r.d2_problem ?? "—"}</span> },
              { key: "methodology", label: "Method", render: (r: any) => <StatusPill tone="info">{r.methodology}</StatusPill> },
              { key: "status", label: "Status", render: (r: any) => <StatusPill tone={tone(r.status)}>{r.status}</StatusPill> },
              { key: "due_date", label: "Due", render: (r: any) => r.due_date ?? "—" },
            ]}
            fields={[
              { name: "capa_number", label: "Number", placeholder: "CAPA-2026-0001" },
              {
                name: "methodology", label: "Methodology", type: "select",
                options: [
                  { value: "8d", label: "8D — Eight Disciplines" },
                  { value: "5why", label: "5-Why" },
                  { value: "fishbone", label: "Fishbone / Ishikawa" },
                  { value: "a3", label: "A3" },
                ],
              },
              {
                name: "nc_id", label: "Linked Non-Conformance", type: "select",
                placeholder: "— None —",
                loadOptions: () => loadOptions("non_conformances", "number", ", description"),
              },
              {
                name: "owner_id", label: "Owner", type: "select",
                placeholder: "— None —",
                loadOptions: () => loadOptions("profiles", "full_name", ", email"),
              },
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

