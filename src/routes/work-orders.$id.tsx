import { createFileRoute, Link, useParams, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AuthGate } from "@/components/auth-gate";
import { AppShell } from "@/components/app-shell";
import { MesPage, StatusPill } from "@/components/mes/mes-page";
import { supabase } from "@/integrations/supabase/client";
import { useSession, useMyRoles, hasAnyRole } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, ScrollText, Play, PauseCircle, CheckCircle2, ShieldCheck, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { toast } from "sonner";
import { notifyError } from "@/lib/toast";

function tone(status: string): "success" | "warning" | "danger" | "info" | "muted" {
  if (status === "released" || status === "in_progress") return "info";
  if (status === "completed" || status === "closed") return "success";
  if (status === "on_hold") return "danger";
  return "warning";
}

function WoDetail() {
  const { id } = useParams({ from: "/work-orders/$id" });
  const { user } = useSession();
  const { data: roles } = useMyRoles();
  const canManage = hasAnyRole(roles, "administrator", "quality_manager", "qc_engineer");
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [holdOpen, setHoldOpen] = useState(false);
  const [holdReason, setHoldReason] = useState("");

  const PAGE = 10;
  const [inspPage, setInspPage] = useState(0);
  const [inspStatus, setInspStatus] = useState<string>("all");
  const [holdPage, setHoldPage] = useState(0);
  const [holdStatus, setHoldStatus] = useState<string>("all");

  const wo = useQuery({
    queryKey: ["wo", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("work_orders")
        .select("*, products(id, name, sku), production_lines(name)")
        .eq("id", id).maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Not found");
      return data as any;
    },
  });

  const inspections = useQuery({
    queryKey: ["wo-inspections", id, inspPage, inspStatus],
    queryFn: async () => {
      let q = supabase.from("inspections")
        .select("id, status, scheduled_date, plan_id, inspection_plans(name)", { count: "exact" })
        .eq("work_order_id", id);
      if (inspStatus !== "all") q = q.eq("status", inspStatus);
      const { data, count, error } = await q
        .order("scheduled_date", { ascending: false })
        .range(inspPage * PAGE, inspPage * PAGE + PAGE - 1);
      if (error) throw error;
      return { rows: data ?? [], count: count ?? 0 };
    },
  });

  const holds = useQuery({
    queryKey: ["wo-holds", id, holdPage, holdStatus],
    queryFn: async () => {
      let q = supabase.from("quality_holds")
        .select("id, hold_number, status, reason, created_at", { count: "exact" })
        .eq("work_order_id", id);
      if (holdStatus !== "all") q = q.eq("status", holdStatus);
      const { data, count, error } = await q
        .order("created_at", { ascending: false })
        .range(holdPage * PAGE, holdPage * PAGE + PAGE - 1);
      if (error) throw error;
      return { rows: data ?? [], count: count ?? 0 };
    },
  });


  const release = useMutation({
    mutationFn: async () => {
      const w = wo.data!;
      if (!w.product_id) throw new Error("Work order has no product — cannot release without a product to inspect.");
      // Find active inspection plans for this product
      const { data: plans, error: pErr } = await supabase.from("inspection_plans")
        .select("id, product_id, plan_type").eq("product_id", w.product_id).eq("is_active", true);
      if (pErr) throw pErr;
      // Find an active spec for the product
      const { data: specs, error: sErr } = await supabase.from("quality_specifications")
        .select("id").eq("product_id", w.product_id).eq("is_active", true).order("created_at", { ascending: false }).limit(1);
      if (sErr) throw sErr;
      const specId = specs?.[0]?.id;
      // Release
      const { error: uErr } = await supabase.from("work_orders")
        .update({ status: "released", actual_start: new Date().toISOString() }).eq("id", id);
      if (uErr) throw uErr;
      // Auto-create inspections
      let created = 0;
      if (specId && plans?.length) {
        const rows = plans.map((p: any) => ({
          product_id: w.product_id,
          spec_id: specId,
          work_order_id: id,
          plan_id: p.id,
          plan_type: p.plan_type,
          scheduled_date: new Date().toISOString().slice(0, 10),
          lot_number: w.lot_number ?? null,
          status: "planned",
        }));
        const { error: iErr } = await supabase.from("inspections").insert(rows as any);
        if (iErr) throw iErr;
        created = rows.length;
      }
      await supabase.from("audit_logs").insert({
        user_id: user!.id, action: "wo.released", entity_type: "work_order", entity_id: id,
        details: { inspections_created: created },
      });
      return { created, hadSpec: !!specId, planCount: plans?.length ?? 0 };
    },
    onSuccess: (r) => {
      toast.success(
        r.created ? `Released — ${r.created} inspection(s) auto-created`
        : !r.hadSpec ? "Released — no active quality spec on product, no inspections created"
        : "Released — no active inspection plans for product"
      );
      qc.invalidateQueries({ queryKey: ["wo", id] });
      qc.invalidateQueries({ queryKey: ["wo-inspections", id] });
    },
    onError: (e) => notifyError(e),
  });

  const placeHold = useMutation({
    mutationFn: async () => {
      if (!holdReason.trim()) throw new Error("Reason required");
      const { error: hErr } = await supabase.from("quality_holds").insert({
        work_order_id: id,
        product_id: wo.data.product_id ?? null,
        reason: holdReason,
        status: "open",
        placed_by: user!.id,
      } as any);
      if (hErr) throw hErr;
      const { error: uErr } = await supabase.from("work_orders").update({ status: "on_hold" }).eq("id", id);
      if (uErr) throw uErr;
      await supabase.from("audit_logs").insert({
        user_id: user!.id, action: "wo.hold", entity_type: "work_order", entity_id: id, details: { reason: holdReason },
      });
    },
    onSuccess: () => {
      toast.success("Work order held"); setHoldOpen(false); setHoldReason("");
      qc.invalidateQueries({ queryKey: ["wo", id] });
      qc.invalidateQueries({ queryKey: ["wo-holds", id] });
    },
    onError: (e) => notifyError(e),
  });

  const complete = useMutation({
    mutationFn: async () => {
      const { data: openInspList, error: ie } = await supabase.from("inspections")
        .select("id", { count: "exact", head: true })
        .eq("work_order_id", id).not("status", "in", "(completed,cancelled)");
      if (ie) throw ie;
      const openCount = (openInspList as any)?.length ?? 0;
      // fallback: use count via select if head query didn't return it
      const { count } = await supabase.from("inspections")
        .select("id", { count: "exact", head: true })
        .eq("work_order_id", id).not("status", "in", "(completed,cancelled)");
      const total = count ?? openCount;
      if (total > 0) throw new Error(`${total} inspection(s) still open — complete or cancel them first`);
      const { error } = await supabase.from("work_orders").update({
        status: "completed", actual_end: new Date().toISOString(),
      }).eq("id", id);
      if (error) throw error;
      await supabase.from("audit_logs").insert({
        user_id: user!.id, action: "wo.completed", entity_type: "work_order", entity_id: id,
      });
    },
    onSuccess: () => { toast.success("Work order completed"); qc.invalidateQueries({ queryKey: ["wo", id] }); },
    onError: (e) => notifyError(e),
  });

  const regenerate = useMutation({
    mutationFn: async () => {
      const w = wo.data!;
      if (!w.product_id) throw new Error("Work order has no product.");
      const [{ data: plans, error: pErr }, { data: existing, error: eErr }, { data: specs, error: sErr }] = await Promise.all([
        supabase.from("inspection_plans").select("id, plan_type").eq("product_id", w.product_id).eq("is_active", true),
        supabase.from("inspections").select("plan_id").eq("work_order_id", id),
        supabase.from("quality_specifications").select("id").eq("product_id", w.product_id).eq("is_active", true).order("created_at", { ascending: false }).limit(1),
      ]);
      if (pErr) throw pErr; if (eErr) throw eErr; if (sErr) throw sErr;
      const specId = specs?.[0]?.id;
      if (!specId) throw new Error("No active quality spec on product.");
      const existingPlanIds = new Set((existing ?? []).map((r: any) => r.plan_id).filter(Boolean));
      const missing = (plans ?? []).filter((p: any) => !existingPlanIds.has(p.id));
      if (!missing.length) return { created: 0 };
      const rows = missing.map((p: any) => ({
        product_id: w.product_id, spec_id: specId, work_order_id: id, plan_id: p.id, plan_type: p.plan_type,
        scheduled_date: new Date().toISOString().slice(0, 10),
        lot_number: w.lot_number ?? null, status: "planned",
      }));
      const { error: iErr } = await supabase.from("inspections").insert(rows as any);
      if (iErr) throw iErr;
      await supabase.from("audit_logs").insert({
        user_id: user!.id, action: "wo.inspections_regenerated", entity_type: "work_order", entity_id: id,
        details: { created: rows.length, plan_ids: missing.map((p: any) => p.id) },
      });
      return { created: rows.length };
    },
    onSuccess: (r) => {
      toast.success(r.created ? `Created ${r.created} missing inspection(s)` : "All plans already have inspections");
      qc.invalidateQueries({ queryKey: ["wo-inspections", id] });
    },
    onError: (e) => notifyError(e),
  });


  if (wo.isLoading) return <Skeleton className="h-96 w-full" />;
  if (wo.error || !wo.data) return <div className="text-destructive">Failed to load.</div>;
  const w = wo.data;
  const status = w.status as string;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Link to="/work-orders" className="text-sm text-muted-foreground hover:underline inline-flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Back to Work Orders
        </Link>
        <StatusPill tone={tone(status)}>{status}</StatusPill>
      </div>

      <div className="glass-panel rounded-2xl p-6">
        <div className="mb-1 text-xs uppercase tracking-[0.18em] text-muted-foreground font-mono">{w.number}</div>
        <h2 className="text-xl font-semibold tracking-tight">{w.products?.name ?? "No product"}</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 md:grid-cols-4 text-sm">
          <Info label="Lot" value={w.lot_number ?? "—"} />
          <Info label="Planned qty" value={String(w.quantity_planned ?? 0)} />
          <Info label="Produced" value={String(w.quantity_produced ?? 0)} />
          <Info label="Line" value={w.production_lines?.name ?? "—"} />
          <Info label="Planned start" value={w.planned_start ? new Date(w.planned_start).toLocaleString() : "—"} />
          <Info label="Planned end" value={w.planned_end ? new Date(w.planned_end).toLocaleString() : "—"} />
          <Info label="Actual start" value={w.actual_start ? new Date(w.actual_start).toLocaleString() : "—"} />
          <Info label="Actual end" value={w.actual_end ? new Date(w.actual_end).toLocaleString() : "—"} />
        </div>
        {w.notes && <div className="mt-3 text-sm text-muted-foreground whitespace-pre-wrap">{w.notes}</div>}

        {canManage && (
          <div className="mt-4 flex flex-wrap gap-2 border-t border-border/50 pt-4">
            {status === "planned" && (
              <Button size="sm" onClick={() => release.mutate()} disabled={release.isPending} className="gap-2">
                <Play className="h-4 w-4" /> Release & auto-create inspections
              </Button>
            )}
            {(status === "released" || status === "in_progress") && (
              <>
                <Button size="sm" variant="outline" onClick={() => setHoldOpen(true)} className="gap-2">
                  <PauseCircle className="h-4 w-4" /> Place on hold
                </Button>
                <Button size="sm" onClick={() => complete.mutate()} disabled={complete.isPending} className="gap-2">
                  <CheckCircle2 className="h-4 w-4" /> Complete
                </Button>
              </>
            )}
            {status === "on_hold" && (
              <Button size="sm" onClick={async () => {
                const { error } = await supabase.from("work_orders").update({ status: "released" }).eq("id", id);
                if (error) return notifyError(error);
                toast.success("Released from hold");
                qc.invalidateQueries({ queryKey: ["wo", id] });
              }} className="gap-2">
                <Play className="h-4 w-4" /> Release from hold
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Section title="Inspections" icon={<ScrollText className="h-4 w-4" />}>
          {inspections.data?.length ? (
            <ul className="space-y-2">
              {inspections.data.map((i: any) => (
                <li key={i.id}>
                  <Link to="/inspections/$id" params={{ id: i.id }}
                    className="flex items-center justify-between rounded-lg border border-border/60 bg-card/60 p-3 hover:border-primary/40 transition">
                    <div>
                      <div className="text-sm">{i.inspection_plans?.name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{i.scheduled_date}</div>
                    </div>
                    <StatusPill tone={i.status === "completed" ? "success" : i.status === "in_progress" ? "info" : "muted"}>{i.status}</StatusPill>
                  </Link>
                </li>
              ))}
            </ul>
          ) : <div className="text-sm text-muted-foreground">No inspections yet.</div>}
        </Section>

        <Section title="Quality Holds" icon={<ShieldCheck className="h-4 w-4" />}>
          {holds.data?.length ? (
            <ul className="space-y-2">
              {holds.data.map((h: any) => (
                <li key={h.id} className="rounded-lg border border-border/60 bg-card/60 p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs">{h.hold_number ?? h.id.slice(0,8)}</span>
                    <StatusPill tone={h.status === "open" ? "danger" : "muted"}>{h.status}</StatusPill>
                  </div>
                  <div className="mt-1 text-sm">{h.reason}</div>
                </li>
              ))}
            </ul>
          ) : <div className="text-sm text-muted-foreground">No holds.</div>}
        </Section>
      </div>

      <Dialog open={holdOpen} onOpenChange={setHoldOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Place work order on hold</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Reason</Label>
            <Textarea value={holdReason} onChange={(e) => setHoldReason(e.target.value)} rows={4}
              placeholder="Describe the issue that requires holding this WO..." />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHoldOpen(false)}>Cancel</Button>
            <Button onClick={() => placeHold.mutate()} disabled={placeHold.isPending || !holdReason.trim()}>
              {placeHold.isPending ? "Holding..." : "Place on hold"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-mono">{value}</div>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="glass-panel rounded-2xl p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold">{icon}{title}</div>
      {children}
    </div>
  );
}

export const Route = createFileRoute("/work-orders/$id")({
  ssr: false,
  head: () => ({ meta: [{ title: "Work Order — CORTA QC" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <AuthGate>
      <AppShell>
        <MesPage
          icon={<ScrollText className="h-5 w-5" />}
          title="Work Order"
          description="Release, hold and complete production work orders with linked inspections."
        >
          <WoDetail />
        </MesPage>
      </AppShell>
    </AuthGate>
  ),
});
