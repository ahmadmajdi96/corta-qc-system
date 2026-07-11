import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AuthGate } from "@/components/auth-gate";
import { AppShell } from "@/components/app-shell";
import { MesPage, StatusPill } from "@/components/mes/mes-page";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FileSearch, ArrowLeft, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { notifyError } from "@/lib/toast";
import { useState, useEffect } from "react";

const D_STEPS: { key: string; label: string; help: string }[] = [
  { key: "d1_team", label: "D1 — Team", help: "Establish a cross-functional team with the right skills." },
  { key: "d2_problem", label: "D2 — Problem", help: "Describe the problem in measurable terms (what, where, when, how many)." },
  { key: "d3_containment", label: "D3 — Containment", help: "Interim actions to protect the customer from the problem." },
  { key: "d4_root_cause", label: "D4 — Root cause", help: "Identify all root causes using 5-Why / Fishbone / data analysis." },
  { key: "d5_corrective", label: "D5 — Corrective action", help: "Choose and verify permanent corrective actions." },
  { key: "d6_implement", label: "D6 — Implementation", help: "Implement the corrective actions and validate results." },
  { key: "d7_prevent", label: "D7 — Prevent recurrence", help: "Systemic changes (procedures, training, poka-yoke) to prevent recurrence." },
  { key: "d8_recognition", label: "D8 — Recognition & closure", help: "Recognize the team and formally close the CAPA." },
];

function CapaDetail() {
  const { id } = useParams({ from: "/capa/$id" });
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Record<string, string>>({});

  const capa = useQuery({
    queryKey: ["capa", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("capa_records").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Not found");
      return data as any;
    },
  });

  useEffect(() => {
    if (capa.data) {
      const d: Record<string, string> = {};
      for (const s of D_STEPS) d[s.key] = capa.data[s.key] ?? "";
      setDraft(d);
    }
  }, [capa.data]);

  const save = useMutation({
    mutationFn: async (patch: Record<string, any>) => {
      const { error } = await supabase.from("capa_records").update(patch as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["capa", id] }); },
    onError: (e) => notifyError(e),
  });

  const close = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("capa_records").update({ status: "closed" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("CAPA closed"); qc.invalidateQueries({ queryKey: ["capa", id] }); },
    onError: (e) => notifyError(e),
  });

  if (capa.isLoading) return <Skeleton className="h-96 w-full" />;
  if (capa.error) return <div className="text-destructive">Failed to load.</div>;
  const c = capa.data;
  const progress = D_STEPS.filter((s) => (draft[s.key] ?? "").trim().length > 0).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Link to="/capa" className="text-sm text-muted-foreground hover:underline inline-flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Back to CAPA
        </Link>
        <div className="flex items-center gap-3">
          <StatusPill tone={c.status === "closed" ? "success" : c.status === "in_progress" ? "info" : "warning"}>{c.status}</StatusPill>
          <span className="text-xs font-mono text-muted-foreground">{progress}/8 steps</span>
          {c.status !== "closed" && (
            <Button size="sm" variant="outline" className="gap-2" onClick={() => close.mutate()} disabled={progress < 8}>
              <CheckCircle2 className="h-4 w-4" /> Close CAPA
            </Button>
          )}
        </div>
      </div>

      <div className="glass-panel rounded-2xl p-6">
        <div className="mb-1 text-xs uppercase tracking-[0.18em] text-muted-foreground font-mono">{c.capa_number ?? "—"}</div>
        <h2 className="text-xl font-semibold tracking-tight">{c.d2_problem ?? "Problem statement pending"}</h2>
      </div>

      <div className="space-y-3">
        {D_STEPS.map((s) => {
          const filled = (draft[s.key] ?? "").trim().length > 0;
          return (
            <div key={s.key} className="glass-panel rounded-xl p-4">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold">{s.label}</div>
                  <div className="text-xs text-muted-foreground">{s.help}</div>
                </div>
                <StatusPill tone={filled ? "success" : "muted"}>{filled ? "Complete" : "Pending"}</StatusPill>
              </div>
              <Label htmlFor={s.key} className="sr-only">{s.label}</Label>
              <Textarea
                id={s.key}
                rows={3}
                value={draft[s.key] ?? ""}
                onChange={(e) => setDraft({ ...draft, [s.key]: e.target.value })}
                onBlur={(e) => {
                  if (e.target.value !== (c[s.key] ?? "")) save.mutate({ [s.key]: e.target.value });
                }}
                disabled={c.status === "closed"}
                placeholder="Type your response..."
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const Route = createFileRoute("/capa/$id")({
  ssr: false,
  head: () => ({ meta: [{ title: "CAPA — CORTA QC" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <AuthGate>
      <AppShell>
        <MesPage
          icon={<FileSearch className="h-5 w-5" />}
          title="CAPA (8D)"
          description="Structured 8-discipline problem solving workflow."
        >
          <CapaDetail />
        </MesPage>
      </AppShell>
    </AuthGate>
  ),
});
