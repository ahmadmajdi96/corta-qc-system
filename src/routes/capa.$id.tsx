import { createFileRoute, Link, useParams, useNavigate, useSearch } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AuthGate } from "@/components/auth-gate";
import { AppShell } from "@/components/app-shell";
import { MesPage, StatusPill } from "@/components/mes/mes-page";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FileSearch, ArrowLeft, CheckCircle2, History, ArrowUp, ArrowDown, X } from "lucide-react";
import { toast } from "sonner";
import { notifyError } from "@/lib/toast";
import { useEffect, useState } from "react";
import { ElectronicSignatureDialog } from "@/components/electronic-signature-dialog";



type StepDef = { key: string; label: string; help: string };

const STEPS_8D: StepDef[] = [
  { key: "d1_team", label: "D1 — Team", help: "Establish a cross-functional team with the right skills." },
  { key: "d2_problem", label: "D2 — Problem", help: "Describe the problem in measurable terms (what, where, when, how many)." },
  { key: "d3_containment", label: "D3 — Containment", help: "Interim actions to protect the customer from the problem." },
  { key: "d4_root_cause", label: "D4 — Root cause", help: "Identify all root causes using 5-Why / Fishbone / data analysis." },
  { key: "d5_corrective", label: "D5 — Corrective action", help: "Choose and verify permanent corrective actions." },
  { key: "d6_implement", label: "D6 — Implementation", help: "Implement the corrective actions and validate results." },
  { key: "d7_prevent", label: "D7 — Prevent recurrence", help: "Systemic changes (procedures, training, poka-yoke) to prevent recurrence." },
  { key: "d8_recognition", label: "D8 — Recognition & closure", help: "Recognize the team and formally close the CAPA." },
];

const STEPS_5WHY: StepDef[] = [
  { key: "d2_problem", label: "Problem statement", help: "Describe the problem in measurable terms." },
  { key: "d1_team", label: "Why #1", help: "Why did this happen? First layer." },
  { key: "d3_containment", label: "Why #2", help: "Why did that happen? Dig deeper." },
  { key: "d4_root_cause", label: "Why #3 → #5 (Root cause)", help: "Continue asking until you reach the systemic root cause." },
  { key: "d5_corrective", label: "Corrective action", help: "Action that addresses the identified root cause." },
  { key: "d7_prevent", label: "Preventive action", help: "Systemic change to prevent recurrence." },
];

const STEPS_FISHBONE: StepDef[] = [
  { key: "d2_problem", label: "Problem statement", help: "The effect being analyzed." },
  { key: "d1_team", label: "Man / People", help: "Human-factor causes: skills, training, fatigue, communication." },
  { key: "d3_containment", label: "Machine / Equipment", help: "Tooling, machines, fixtures, gauges." },
  { key: "d4_root_cause", label: "Method", help: "Procedures, work instructions, standards." },
  { key: "d5_corrective", label: "Material", help: "Raw material, components, consumables." },
  { key: "d6_implement", label: "Measurement", help: "Inspection, gauges, calibration, sampling." },
  { key: "d7_prevent", label: "Environment", help: "Temperature, humidity, layout, lighting." },
  { key: "d8_recognition", label: "Root cause & corrective actions", help: "Confirmed root cause(s) and permanent actions." },
];

const STEPS_A3: StepDef[] = [
  { key: "d2_problem", label: "Background", help: "Context — why this problem matters." },
  { key: "d1_team", label: "Current condition", help: "Facts and data describing today's state." },
  { key: "d3_containment", label: "Goal / Target condition", help: "Measurable target state." },
  { key: "d4_root_cause", label: "Root cause analysis", help: "Analysis leading to the root cause(s)." },
  { key: "d5_corrective", label: "Countermeasures", help: "Selected countermeasures to close the gap." },
  { key: "d6_implement", label: "Implementation plan", help: "Who, what, when — the action plan." },
  { key: "d7_prevent", label: "Follow-up / effect confirmation", help: "Verify results and standardize." },
];

function stepsFor(methodology: string | null | undefined): StepDef[] {
  switch (methodology) {
    case "5why": return STEPS_5WHY;
    case "fishbone": return STEPS_FISHBONE;
    case "a3": return STEPS_A3;
    case "8d":
    default: return STEPS_8D;
  }
}

const METHODOLOGY_LABEL: Record<string, string> = {
  "8d": "8D — Eight Disciplines",
  "5why": "5-Why",
  "fishbone": "Fishbone / Ishikawa",
  "a3": "A3",
};

const AUDIT_PAGE_SIZES = [10, 25, 50, 100] as const;
const AUDIT_DEFAULTS = { auditPage: 0, auditStep: "all", auditSort: "desc" as const, auditSize: 10 };

function CapaDetail() {
  const { id } = useParams({ from: "/capa/$id" });
  const search = useSearch({ from: "/capa/$id" }) as { auditPage?: number; auditStep?: string; auditSort?: "asc" | "desc"; auditSize?: number };
  const navigate = useNavigate({ from: "/capa/$id" });
  const qc = useQueryClient();
  const { user } = useSession();
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [esigOpen, setEsigOpen] = useState(false);

  const auditPage = search.auditPage ?? AUDIT_DEFAULTS.auditPage;
  const auditStep = search.auditStep ?? AUDIT_DEFAULTS.auditStep;
  const auditSort: "asc" | "desc" = search.auditSort ?? AUDIT_DEFAULTS.auditSort;
  const auditSize = AUDIT_PAGE_SIZES.includes(search.auditSize as any) ? (search.auditSize as number) : AUDIT_DEFAULTS.auditSize;
  const filtersActive = auditStep !== AUDIT_DEFAULTS.auditStep || auditSort !== AUDIT_DEFAULTS.auditSort || auditSize !== AUDIT_DEFAULTS.auditSize || auditPage !== AUDIT_DEFAULTS.auditPage;
  const setSearch = (patch: Partial<{ auditPage: number; auditStep: string; auditSort: "asc" | "desc"; auditSize: number }>) =>
    navigate({ search: (prev: any) => ({ ...prev, ...patch }), replace: true });
  const resetFilters = () =>
    navigate({ search: (prev: any) => ({ ...prev, auditPage: undefined, auditStep: undefined, auditSort: undefined, auditSize: undefined }), replace: true });

  const capa = useQuery({

    queryKey: ["capa", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("capa_records").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Not found");
      return data as any;
    },
  });

  const trail = useQuery({
    queryKey: ["capa-audit", id, auditPage, auditStep, auditSort, auditSize],
    queryFn: async () => {
      let q = supabase.from("audit_logs")
        .select("id, action, details, created_at, profiles:user_id(full_name, email)", { count: "exact" })
        .eq("entity_type", "capa").eq("entity_id", id);
      if (auditStep === "closed") q = q.eq("action", "capa.closed");
      else if (auditStep !== "all") q = q.eq("action", "capa.step_updated").contains("details", { step: auditStep });
      const { data, count, error } = await q
        .order("created_at", { ascending: auditSort === "asc" })
        .range(auditPage * auditSize, auditPage * auditSize + auditSize - 1);
      if (error) throw error;
      return { rows: data ?? [], count: count ?? 0 };
    },
  });




  const steps = stepsFor(capa.data?.methodology);
  const methodLabel = METHODOLOGY_LABEL[capa.data?.methodology] ?? capa.data?.methodology ?? "";

  useEffect(() => {
    if (capa.data) {
      const d: Record<string, string> = {};
      for (const s of stepsFor(capa.data.methodology)) d[s.key] = capa.data[s.key] ?? "";
      setDraft(d);
    }
  }, [capa.data]);

  const save = useMutation({
    mutationFn: async (patch: { key: string; before: string; after: string }) => {
      const { error } = await supabase.from("capa_records").update({ [patch.key]: patch.after } as any).eq("id", id);
      if (error) throw error;
      await supabase.from("audit_logs").insert({
        user_id: user?.id ?? null,
        action: "capa.step_updated",
        entity_type: "capa",
        entity_id: id,
        details: { step: patch.key, before: patch.before, after: patch.after },
      });
    },
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["capa", id] });
      qc.invalidateQueries({ queryKey: ["capa-audit", id] });
    },
    onError: (e) => notifyError(e),
  });

  const close = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("capa_records").update({ status: "closed" }).eq("id", id);
      if (error) throw error;
      await supabase.from("audit_logs").insert({
        user_id: user?.id ?? null, action: "capa.closed", entity_type: "capa", entity_id: id,
      });
    },
    onSuccess: () => {
      toast.success("CAPA closed");
      qc.invalidateQueries({ queryKey: ["capa", id] });
      qc.invalidateQueries({ queryKey: ["capa-audit", id] });
    },
    onError: (e) => notifyError(e),
  });


  if (capa.isLoading) return <Skeleton className="h-96 w-full" />;
  if (capa.error) return <div className="text-destructive">Failed to load.</div>;
  const c = capa.data;
  const progress = steps.filter((s: StepDef) => (draft[s.key] ?? "").trim().length > 0).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Link to="/capa" className="text-sm text-muted-foreground hover:underline inline-flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Back to CAPA
        </Link>
        <div className="flex items-center gap-3">
          <StatusPill tone="info">{methodLabel}</StatusPill>
          <StatusPill tone={c.status === "closed" ? "success" : c.status === "in_progress" ? "info" : "warning"}>{c.status}</StatusPill>
          <span className="text-xs font-mono text-muted-foreground">{progress}/{steps.length} steps</span>
          {c.status !== "closed" && (
            <Button size="sm" variant="outline" className="gap-2" onClick={() => setEsigOpen(true)} disabled={progress < steps.length}>
              <CheckCircle2 className="h-4 w-4" /> Close CAPA
            </Button>
          )}
        </div>
      </div>

      <ElectronicSignatureDialog
        open={esigOpen}
        onOpenChange={setEsigOpen}
        entityType="capa_record"
        entityId={id}
        meaning={`Approve and close CAPA — I certify all ${methodLabel} steps are complete and effective.`}
        requiredRoles={["administrator", "quality_manager", "quality_engineer"]}
        onSigned={() => close.mutate()}
      />

      <div className="glass-panel rounded-2xl p-6">
        <div className="mb-1 text-xs uppercase tracking-[0.18em] text-muted-foreground font-mono">{c.capa_number ?? "—"}</div>
        <h2 className="text-xl font-semibold tracking-tight">{c.d2_problem ?? "Problem statement pending"}</h2>
      </div>

      <div className="space-y-3">
        {steps.map((s: StepDef) => {
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
                  const before = c[s.key] ?? "";
                  const after = e.target.value;
                  if (after !== before) save.mutate({ key: s.key, before, after });
                }}

                disabled={c.status === "closed"}
                placeholder="Type your response..."
              />
            </div>
          );
        })}
      </div>

      <div className="glass-panel rounded-2xl p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <History className="h-4 w-4" /> Audit trail
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={auditStep}
              onChange={(e) => setSearch({ auditStep: e.target.value, auditPage: 0 })}
              className="h-8 rounded-md border border-border/60 bg-card/60 px-2 text-xs"
            >
              <option value="all">All events</option>
              <option value="closed">CAPA closed</option>
              {steps.map((s: StepDef) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
            <select
              value={auditSize}
              onChange={(e) => setSearch({ auditSize: Number(e.target.value), auditPage: 0 })}
              className="h-8 rounded-md border border-border/60 bg-card/60 px-2 text-xs"
              title="Rows per page"
            >
              {AUDIT_PAGE_SIZES.map((s) => <option key={s} value={s}>{s} / page</option>)}
            </select>
            <Button
              variant="outline" size="sm" className="h-8 gap-1"
              onClick={() => setSearch({ auditSort: auditSort === "asc" ? "desc" : "asc", auditPage: 0 })}
              title={`Sort by date: ${auditSort === "asc" ? "oldest first" : "newest first"}`}
            >
              Date {auditSort === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
            </Button>
            {filtersActive && (
              <Button variant="ghost" size="sm" className="h-8 gap-1 text-muted-foreground" onClick={resetFilters} title="Clear all filters and sorting">
                <X className="h-3 w-3" /> Reset filters
              </Button>
            )}
          </div>
        </div>
        {trail.isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : (trail.data?.rows.length ?? 0) === 0 ? (
          <div className="text-sm text-muted-foreground">No changes match.</div>
        ) : (
          <>
            <ul className="divide-y divide-border/40">
              {trail.data!.rows.map((e: any) => {
                const who = e.profiles?.full_name || e.profiles?.email || "system";
                const step = e.details?.step ? steps.find((s: StepDef) => s.key === e.details.step)?.label ?? e.details.step : null;
                return (
                  <li key={e.id} className="py-2 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{who}</span>
                        <span className="text-xs text-muted-foreground">
                          {e.action === "capa.closed" ? "closed the CAPA" : step ? `updated ${step}` : e.action}
                        </span>
                      </div>
                      <span className="text-xs font-mono text-muted-foreground">{new Date(e.created_at).toLocaleString()}</span>
                    </div>
                    {e.details?.step && (
                      <div className="mt-1 grid gap-1 md:grid-cols-2 text-xs">
                        <div className="rounded bg-destructive/5 border border-destructive/20 p-2">
                          <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-0.5">Before</div>
                          <div className="whitespace-pre-wrap text-muted-foreground">{e.details.before || <em>empty</em>}</div>
                        </div>
                        <div className="rounded bg-primary/5 border border-primary/20 p-2">
                          <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-0.5">After</div>
                          <div className="whitespace-pre-wrap">{e.details.after || <em>empty</em>}</div>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            {trail.data!.count > auditSize && (
              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span>{trail.data!.count} events · page {auditPage + 1} of {Math.ceil(trail.data!.count / auditSize)}</span>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" className="h-7 px-2" disabled={auditPage === 0} onClick={() => setSearch({ auditPage: auditPage - 1 })}>Prev</Button>
                  <Button variant="ghost" size="sm" className="h-7 px-2"
                    disabled={(auditPage + 1) * auditSize >= trail.data!.count}
                    onClick={() => setSearch({ auditPage: auditPage + 1 })}>Next</Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>


    </div>
  );
}


export const Route = createFileRoute("/capa/$id")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    auditPage: Number(s.auditPage) || 0,
    auditStep: typeof s.auditStep === "string" ? s.auditStep : "all",
    auditSort: s.auditSort === "asc" ? "asc" as const : "desc" as const,
    auditSize: [10, 25, 50, 100].includes(Number(s.auditSize)) ? Number(s.auditSize) : 10,
  }),
  head: () => ({ meta: [{ title: "CAPA — CORTA QC" }, { name: "robots", content: "noindex" }] }),

  component: () => (
    <AuthGate>
      <AppShell>
        <MesPage
          icon={<FileSearch className="h-5 w-5" />}
          title="CAPA"
          description="Structured problem-solving — methodology-driven workflow."
        >
          <CapaDetail />
        </MesPage>
      </AppShell>
    </AuthGate>
  ),
});
