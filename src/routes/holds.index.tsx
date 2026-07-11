import { createFileRoute } from "@tanstack/react-router";
import { AuthGate } from "@/components/auth-gate";
import { AppShell } from "@/components/app-shell";
import { MesPage, StatusPill } from "@/components/mes/mes-page";
import { SimpleList } from "@/components/mes/simple-list";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { notifyError } from "@/lib/toast";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";

function tone(s: string): "success" | "warning" | "danger" | "info" | "muted" {
  if (s === "released") return "success";
  if (s === "scrapped" || s === "rework") return "warning";
  if (s === "under_review") return "info";
  return "danger";
}

const DISPOSITIONS = ["use_as_is", "rework", "scrap", "return_to_supplier"] as const;

function DispositionMenu({ id }: { id: string }) {
  const qc = useQueryClient();
  const set = useMutation({
    mutationFn: async (disposition: string) => {
      const patch: any = { disposition, status: disposition === "use_as_is" ? "released" : disposition === "scrap" ? "scrapped" : "rework", resolved_at: new Date().toISOString() };
      const { error } = await supabase.from("quality_holds").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Disposition set"); qc.invalidateQueries({ queryKey: ["quality_holds", "list"] }); },
    onError: (e) => notifyError(e),
  });
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1">Disposition <ChevronDown className="h-3 w-3" /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {DISPOSITIONS.map((d) => (
          <DropdownMenuItem key={d} onClick={() => set.mutate(d)}>{d.replace(/_/g, " ")}</DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export const Route = createFileRoute("/holds/")({
  ssr: false,
  head: () => ({ meta: [{ title: "Quality Holds — CORTA QC" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <AuthGate>
      <AppShell>
        <MesPage
          icon={<ShieldCheck className="h-5 w-5" />}
          title="Quality Holds"
          description="Quarantine, review and disposition non-conforming material."
        >
          <SimpleList
            table="quality_holds"
            entityName="Hold"
            emptyIcon={<ShieldCheck className="h-6 w-6" />}
            columns={[
              { key: "hold_number", label: "Number", render: (r: any) => <span className="font-mono text-xs">{r.hold_number ?? "—"}</span> },
              { key: "lot_number", label: "Lot" },
              { key: "status", label: "Status", render: (r: any) => <StatusPill tone={tone(r.status)}>{r.status}</StatusPill> },
              { key: "disposition", label: "Disposition", render: (r: any) => r.disposition ?? "—" },
              { key: "reason", label: "Reason" },
              { key: "created_at", label: "Opened", render: (r: any) => new Date(r.created_at).toLocaleString() },
            ]}
            fields={[
              { name: "hold_number", label: "Number", placeholder: "HLD-2026-0001" },
              { name: "lot_number", label: "Lot number" },
              { name: "reason", label: "Reason", type: "textarea", required: true },
              { name: "notes", label: "Notes", type: "textarea" },
            ]}
            extraActions={(r: any) => r.status !== "released" && r.status !== "scrapped" ? <DispositionMenu id={r.id} /> : null}
          />
        </MesPage>
      </AppShell>
    </AuthGate>
  ),
});
