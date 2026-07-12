import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Play, CheckCircle2, XCircle, RefreshCcw, AlertOctagon, Check, X } from "lucide-react";
import { toast } from "sonner";
import { notifyError } from "@/lib/toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { useMyRoles, hasAnyRole, useSession } from "@/lib/auth";
import { RaiseNcDialog } from "@/components/raise-nc-dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function InspectionDetailPage({ id }: { id: string }) {
  const { user } = useSession();
  const { data: roles } = useMyRoles();
  const isAdmin = hasAnyRole(roles, "administrator");
  const canPerform = hasAnyRole(roles, "administrator", "quality_manager", "inspector");
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [raiseNc, setRaiseNc] = useState<{ measurement?: any } | null>(null);

  const insp = useQuery({
    queryKey: ["inspection", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("inspections")
        .select(`*, products(id, name, sku), quality_specifications(version), profiles!inspections_performed_by_profile_fkey(full_name),
                 inspection_measurements(*, specification_items(*)),
                 non_conformances(id, number, severity, status, description)`)
        .eq("id", id).maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Inspection not found");
      return data;
    },
  });

  const audit = useQuery({
    queryKey: ["audit", "inspection", id],
    queryFn: async () => (await supabase.from("audit_logs")
      .select("*, profiles(full_name)").eq("entity_type", "inspection").eq("entity_id", id)
      .order("created_at", { ascending: false })).data ?? [],
  });

  const specItems = useQuery({
    queryKey: ["spec-items", insp.data?.spec_id],
    enabled: !!insp.data?.spec_id,
    queryFn: async () => (await supabase.from("specification_items").select("*").eq("spec_id", insp.data!.spec_id).order("sequence")).data ?? [],
  });

  const transition = useMutation({
    mutationFn: async (next: "in_progress" | "completed" | "cancelled" | "planned") => {
      const patch: any = { status: next };
      if (next === "in_progress") { patch.started_at = new Date().toISOString(); patch.performed_by = user?.id; }
      if (next === "completed") { patch.completed_at = new Date().toISOString(); }
      if (next === "cancelled") { patch.cancel_reason = cancelReason || null; }
      const { error } = await supabase.from("inspections").update(patch).eq("id", id);
      if (error) throw error;
      await supabase.from("audit_logs").insert({
        user_id: user?.id, action: `inspection.${next}`, entity_type: "inspection", entity_id: id,
        details: cancelReason ? { reason: cancelReason } : null,
      });
    },
    onSuccess: (_v, next) => {
      toast.success(`Inspection ${next.replace("_", " ")}`);
      setCancelOpen(false); setCancelReason("");
      qc.invalidateQueries({ queryKey: ["inspection", id] });
      qc.invalidateQueries({ queryKey: ["audit", "inspection", id] });
    },
    onError: (e: Error) => notifyError(e.message),
  });

  if (insp.isLoading) return <div className="max-w-5xl space-y-3"><Skeleton className="h-8 w-64" /><Skeleton className="h-64" /></div>;
  if (insp.error) return <div className="text-destructive">Failed to load.</div>;
  const i = insp.data! as any;

  const measByItem: Record<string, any> = {};
  (i.inspection_measurements ?? []).forEach((m: any) => measByItem[m.spec_item_id] = m);

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <Link to="/inspections" className="text-sm text-muted-foreground hover:underline inline-flex items-center gap-1"><ArrowLeft className="h-4 w-4" />Back to inspections</Link>
        <div className="flex items-center justify-between mt-2">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              Inspection · {i.products?.name}
              {i.lot_number && <span className="text-sm text-muted-foreground ml-2">Lot {i.lot_number}</span>}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <StatusBadge status={i.status} kind="inspection" />
              <span className="text-xs text-muted-foreground">Scheduled {i.scheduled_date} · Spec v{i.quality_specifications?.version}</span>
            </div>
          </div>
          <div className="flex gap-2">
            {i.status === "planned" && canPerform && (
              <Button onClick={() => transition.mutate("in_progress")}><Play className="h-4 w-4 mr-2" />Start</Button>
            )}
            {i.status === "in_progress" && canPerform && (
              <>
                <Button asChild variant="outline"><Link to="/inspections/$id/execute" params={{ id }}>Record Measurements</Link></Button>
                <Button onClick={() => transition.mutate("completed")}><CheckCircle2 className="h-4 w-4 mr-2" />Complete</Button>
              </>
            )}
            {(i.status === "planned" || i.status === "in_progress") && canPerform && (
              <Button variant="outline" onClick={() => setCancelOpen(true)}><XCircle className="h-4 w-4 mr-2" />Cancel</Button>
            )}
            {(i.status === "completed" || i.status === "cancelled") && isAdmin && (
              <Button variant="outline" onClick={() => transition.mutate("planned")}><RefreshCcw className="h-4 w-4 mr-2" />Re-open</Button>
            )}
          </div>
        </div>
      </div>

      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">Info & Measurements</TabsTrigger>
          <TabsTrigger value="ncs">Non-Conformances ({(i.non_conformances ?? []).length})</TabsTrigger>
          <TabsTrigger value="audit">Audit Trail</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="mt-4 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Inspection Info</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Product"><Link to="/products/$id" params={{ id: i.products?.id }} className="hover:underline">{i.products?.name}</Link></Row>
              <Row label="Spec version">v{i.quality_specifications?.version}</Row>
              <Row label="Scheduled">{i.scheduled_date}</Row>
              <Row label="Performed by">{i.profiles?.full_name ?? "—"}</Row>
              <Row label="Started">{i.started_at ? new Date(i.started_at).toLocaleString() : "—"}</Row>
              <Row label="Completed">{i.completed_at ? new Date(i.completed_at).toLocaleString() : "—"}</Row>
              <Row label="Lot">{i.lot_number ?? "—"}</Row>
              <Row label="Notes">{i.notes ?? "—"}</Row>
              {i.cancel_reason && <Row label="Cancellation reason">{i.cancel_reason}</Row>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Measurements</CardTitle></CardHeader>
            <CardContent>
              {specItems.isLoading ? <Skeleton className="h-24" /> :
               !specItems.data?.length ? <EmptyState title="Spec has no items" /> :
               <div className="rounded-md border divide-y">
                 {specItems.data.map((it: any) => {
                   const m = measByItem[it.id];
                   return (
                     <div key={it.id} className="p-3 flex items-center justify-between gap-2">
                       <div className="flex-1">
                         <div className="text-sm font-medium">
                           {it.sequence}. {it.name}
                           {it.is_critical && <Badge variant="destructive" className="ml-2">CCP</Badge>}
                         </div>
                         <div className="text-xs text-muted-foreground">
                           Target: {it.target_value ?? "—"}{it.unit ?? ""} · Range {it.lower_tolerance ?? "—"}—{it.upper_tolerance ?? "—"}
                         </div>
                       </div>
                       <div className="text-sm w-32 text-right">{m?.measured_value ?? <span className="text-muted-foreground">not recorded</span>}</div>
                       <div className="w-8 flex justify-center">
                         {m?.is_pass === true && <Check className="h-5 w-5 text-status-completed" aria-label="Pass" />}
                         {m?.is_pass === false && <X className="h-5 w-5 text-destructive" aria-label="Fail" />}
                         {m?.is_pass == null && <span className="text-muted-foreground text-xs">—</span>}
                       </div>
                       {m?.is_pass === false && canPerform && (
                         <Button size="sm" variant="outline" onClick={() => setRaiseNc({ measurement: { ...m, spec_item: it } })}>
                           <AlertOctagon className="h-4 w-4 mr-1" />Raise NC
                         </Button>
                       )}
                     </div>
                   );
                 })}
               </div>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ncs" className="mt-4">
          {(i.non_conformances ?? []).length === 0 ? <EmptyState title="No non-conformances raised" action={canPerform ? <Button variant="outline" onClick={() => setRaiseNc({})}><AlertOctagon className="h-4 w-4 mr-2" />Raise NC</Button> : undefined} /> :
           <div className="space-y-2">
             {i.non_conformances.map((n: any) => (
               <Link key={n.id} to="/non-conformances/$id" params={{ id: n.id }} className="block rounded-md border p-3 hover:bg-accent/40">
                 <div className="flex items-center justify-between">
                   <div className="font-mono text-sm">{n.number}</div>
                   <div className="flex gap-2"><StatusBadge status={n.severity} kind="severity" /><StatusBadge status={n.status} kind="nc" /></div>
                 </div>
                 <div className="text-sm mt-1 line-clamp-2">{n.description}</div>
               </Link>
             ))}
           </div>}
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          {audit.isLoading ? <Skeleton className="h-24" /> :
           !audit.data?.length ? <EmptyState title="No activity yet" /> :
           <ul className="space-y-2 text-sm">
             {audit.data.map((a: any) => (
               <li key={a.id} className="rounded border p-3">
                 <div className="flex items-center justify-between">
                   <div className="font-medium">{a.action}</div>
                   <div className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</div>
                 </div>
                 <div className="text-xs text-muted-foreground">by {a.profiles?.full_name ?? "system"}</div>
                 {a.details && <pre className="text-xs mt-1 bg-muted p-2 rounded overflow-x-auto">{JSON.stringify(a.details, null, 2)}</pre>}
               </li>
             ))}
           </ul>}
        </TabsContent>
      </Tabs>

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Inspection</AlertDialogTitle>
            <AlertDialogDescription>Provide a reason. This cannot be undone (except by an administrator).</AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Reason for cancellation" />
          <AlertDialogFooter>
            <AlertDialogCancel>Back</AlertDialogCancel>
            <AlertDialogAction onClick={() => transition.mutate("cancelled")} disabled={!cancelReason.trim()}>Cancel Inspection</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <RaiseNcDialog open={!!raiseNc} onOpenChange={(o: boolean) => !o && setRaiseNc(null)}
        inspectionId={id} measurement={raiseNc?.measurement}
        onCreated={(ncId: string) => { setRaiseNc(null); navigate({ to: "/non-conformances/$id", params: { id: ncId } }); }} />
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="text-muted-foreground">{label}</div>
      <div className="col-span-2">{children}</div>
    </div>
  );
}

export function InspectionExecutePage({ id }: { id: string }) {
  const { user } = useSession();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const insp = useQuery({
    queryKey: ["inspection", id],
    queryFn: async () => (await supabase.from("inspections").select("*, products(name), inspection_plans(id, name)").eq("id", id).maybeSingle()).data,
  });
  const items = useQuery({
    queryKey: ["spec-items", insp.data?.spec_id],
    enabled: !!insp.data?.spec_id,
    queryFn: async () => (await supabase.from("specification_items").select("*").eq("spec_id", insp.data!.spec_id).order("sequence")).data ?? [],
  });
  const existing = useQuery({
    queryKey: ["measurements", id],
    queryFn: async () => (await supabase.from("inspection_measurements").select("*").eq("inspection_id", id)).data ?? [],
  });
  const gages = useQuery({
    queryKey: ["gages", "active"],
    queryFn: async () => (await supabase.from("gages").select("id, code, name, gage_type, status").eq("status", "active").order("code")).data ?? [],
  });
  const planId = (insp.data as any)?.plan_id as string | null | undefined;
  const signoffPoints = useQuery({
    queryKey: ["signoff-points", planId],
    enabled: !!planId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("plan_characteristics")
        .select("id, sequence, activity, point_type, responsibility_role, required_documents, acceptance_criteria")
        .eq("plan_id", planId)
        .in("point_type", ["hold", "witness", "review"])
        .order("sequence", { ascending: true });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
  const signoffs = useQuery({
    queryKey: ["signoffs", id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("inspection_signoffs")
        .select("*")
        .eq("inspection_id", id);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
  const signMut = useMutation({
    mutationFn: async (args: {
      characteristic_id: string; point_type: string;
      notes?: string; unsign?: boolean;
      result_details?: any; is_pass?: boolean | null;
    }) => {
      if (!user) throw new Error("Not authenticated");
      const existingRow = (signoffs.data ?? []).find((s: any) => s.characteristic_id === args.characteristic_id);
      if (args.unsign) {
        if (!existingRow) return;
        const { error } = await (supabase as any)
          .from("inspection_signoffs")
          .update({ status: "pending", signed_by: null, signed_at: null })
          .eq("id", existingRow.id);
        if (error) throw error;
        return;
      }
      const payload: any = {
        inspection_id: id,
        characteristic_id: args.characteristic_id,
        point_type: args.point_type,
        status: "signed",
        signed_by: user.id,
        signed_at: new Date().toISOString(),
        notes: args.notes ?? null,
        result_details: args.result_details ?? null,
        is_pass: args.is_pass ?? null,
      };
      if (existingRow) {
        const { error } = await (supabase as any).from("inspection_signoffs").update(payload).eq("id", existingRow.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("inspection_signoffs").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["signoffs", id] }); },
    onError: (e: Error) => notifyError(e.message),
  });


  type MethodResult = {
    visual_findings?: string; visual_result?: "pass" | "fail" | "";
    ndt_method?: string; ndt_reference?: string; ndt_indications?: string; ndt_result?: "pass" | "fail" | "";
    func_expected?: string; func_observed?: string; func_result?: "pass" | "fail" | "";
  };
  type Row = {
    value: string; notes: string; na: boolean;
    attachment_url: string | null; gage_id: string | null;
    method: string; result_details: MethodResult;
  };
  const [values, setValues] = useState<Record<string, Row>>({});
  const [signValues, setSignValues] = useState<Record<string, { method: string; result_details: MethodResult; notes: string }>>({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [page, setPage] = useState(0);
  const [methodFilter, setMethodFilter] = useState<string>("all");
  const PAGE = 8;

  function inferMethod(it: any): string {
    if (it.measurement_type === "numeric") return "dimensional";
    if (it.measurement_type === "boolean") return "visual";
    return "visual";
  }

  const initedRef = useState({ done: false })[0];
  if (!initedRef.done && existing.data && items.data) {
    const map: Record<string, Row> = {};
    items.data.forEach((it: any) => {
      const m = existing.data.find((x: any) => x.spec_item_id === it.id);
      const rd = (m?.result_details ?? {}) as any;
      map[it.id] = {
        value: m?.measured_value ?? "",
        notes: m?.notes ?? "",
        na: !!m?.is_na,
        attachment_url: m?.attachment_url ?? null,
        gage_id: m?.gage_id ?? null,
        method: rd.method ?? inferMethod(it),
        result_details: rd,
      };
    });
    initedRef.done = true;
    setValues(map);
  }

  const signInitedRef = useState({ done: false })[0];
  if (!signInitedRef.done && signoffPoints.data && signoffs.data) {
    const map: Record<string, { method: string; result_details: MethodResult; notes: string }> = {};
    (signoffPoints.data ?? []).forEach((p: any) => {
      const so = (signoffs.data ?? []).find((s: any) => s.characteristic_id === p.id);
      const rd = (so?.result_details ?? {}) as any;
      map[p.id] = {
        method: rd.method ?? p.inspection_method ?? "visual",
        result_details: rd,
        notes: so?.notes ?? "",
      };
    });
    signInitedRef.done = true;
    setSignValues(map);
  }

  function evaluateFromMethod(method: string, rd: MethodResult): boolean | null {
    if (method === "visual") return rd.visual_result ? rd.visual_result === "pass" : null;
    if (method === "ndt") return rd.ndt_result ? rd.ndt_result === "pass" : null;
    if (method === "functional") return rd.func_result ? rd.func_result === "pass" : null;
    return null;
  }

  function evaluatePass(it: any, raw: string, method?: string, rd?: MethodResult): boolean | null {
    if (method && method !== "dimensional") {
      const p = evaluateFromMethod(method, rd ?? {});
      if (p !== null) return p;
    }
    if (raw === "" || raw == null) return null;
    if (it.measurement_type === "numeric") {
      const n = Number(raw); if (isNaN(n)) return null;
      const lo = it.lower_tolerance != null ? Number(it.lower_tolerance) : -Infinity;
      const hi = it.upper_tolerance != null ? Number(it.upper_tolerance) : Infinity;
      return n >= lo && n <= hi;
    }
    if (it.measurement_type === "boolean") return raw === "true" || raw === "pass";
    return null;
  }

  async function uploadPhoto(itemId: string, file: File) {
    if (!user) return;
    setUploading(itemId);
    try {
      const path = `${user.id}/${id}/${itemId}-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g,"_")}`;
      const { error } = await supabase.storage.from("attachments").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("attachments").createSignedUrl ? await supabase.storage.from("attachments").createSignedUrl(path, 60 * 60 * 24 * 365) : { data: { signedUrl: path } } as any;
      const url = (data as any)?.signedUrl ?? path;
      setValues(v => ({ ...v, [itemId]: { ...(v[itemId] ?? { value: "", notes: "", na: false, attachment_url: null }), attachment_url: url } }));
      toast.success("Photo attached");
    } catch (e: any) { notifyError(e.message ?? "Upload failed"); }
    finally { setUploading(null); }
  }

  async function save(complete: boolean) {
    if (!user || !insp.data || !items.data) return;
    setErrors({});
    setSaving(true);
    try {
      if (insp.data.status === "planned") {
        await supabase.from("inspections").update({ status: "in_progress", started_at: new Date().toISOString(), performed_by: user.id }).eq("id", id);
      }
      if (complete) {
        const errs: Record<string,string> = {};
        (items.data ?? []).forEach((it: any) => {
          const v = values[it.id] ?? { value: "", notes: "", na: false, attachment_url: null };
          if (it.is_required && !v.na && !v.value.trim()) errs[it.id] = "This measurement is required";
        });
        if (Object.keys(errs).length) {
          setErrors(errs);
          throw new Error(`Please record all required measurements (${Object.keys(errs).length} missing).`);
        }
        const holdRows = (signoffPoints.data ?? []).filter((p: any) => p.point_type === "hold");
        const signedIds = new Set((signoffs.data ?? []).filter((s: any) => s.status === "signed").map((s: any) => s.characteristic_id));
        const unsignedHolds = holdRows.filter((p: any) => !signedIds.has(p.id));
        if (unsignedHolds.length) {
          throw new Error(`${unsignedHolds.length} Hold point${unsignedHolds.length > 1 ? "s" : ""} not signed off. Sign off all Hold points before completing.`);
        }
      }
      const rows = items.data.map((it: any) => {
        const v = values[it.id] ?? { value: "", notes: "", na: false, attachment_url: null, gage_id: null, method: inferMethod(it), result_details: {} as MethodResult };
        const rd = { ...(v.result_details ?? {}), method: v.method };
        return {
          inspection_id: id, spec_item_id: it.id,
          measured_value: v.na ? null : (v.value || null),
          notes: v.notes || null,
          is_pass: v.na ? null : evaluatePass(it, v.value, v.method, v.result_details),
          is_na: v.na,
          attachment_url: v.attachment_url,
          gage_id: v.gage_id,
          result_details: v.na ? null : rd,
          recorded_by: user.id, recorded_at: new Date().toISOString(),
        } as any;
      }).filter((r: any) => r.measured_value !== null || r.notes !== null || r.is_na || r.attachment_url || r.gage_id || r.result_details);
      if (rows.length) {
        const { error } = await supabase.from("inspection_measurements").upsert(rows, { onConflict: "inspection_id,spec_item_id" });
        if (error) throw error;
      }
      if (complete) {
        await supabase.from("inspections").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", id);
        await supabase.from("audit_logs").insert({ user_id: user.id, action: "inspection.completed", entity_type: "inspection", entity_id: id });
        toast.success("Inspection completed");
      } else {
        toast.success("Draft saved");
      }
      qc.invalidateQueries({ queryKey: ["inspection", id] });
      qc.invalidateQueries({ queryKey: ["measurements", id] });
      if (complete) navigate({ to: "/inspections/$id", params: { id } });
    } catch (e: any) { notifyError(e.message); } finally { setSaving(false); }
  }

  if (insp.isLoading || items.isLoading) return <div className="max-w-3xl"><Skeleton className="h-64" /></div>;
  if (!insp.data) return <div>Inspection not found.</div>;

  const recorded = Object.values(values).filter((v) => v.value || v.na || Object.keys(v.result_details ?? {}).length > 1).length;

  // Per-method + overall breakdown (spec items + H/W/R sign-off characteristics)
  const breakdown: Record<string, { pass: number; fail: number; na: number; pending: number }> = {};
  const bumpB = (m: string, k: "pass" | "fail" | "na" | "pending") => {
    breakdown[m] = breakdown[m] ?? { pass: 0, fail: 0, na: 0, pending: 0 };
    breakdown[m][k] += 1;
  };
  let passCount = 0, failCount = 0, naCount = 0, pendingCount = 0;
  (items.data ?? []).forEach((it: any) => {
    const v = values[it.id] ?? { value: "", notes: "", na: false, attachment_url: null, gage_id: null, method: inferMethod(it), result_details: {} as MethodResult };
    if (v.na) { naCount++; bumpB(v.method, "na"); return; }
    const p = evaluatePass(it, v.value, v.method, v.result_details);
    if (p === true) { passCount++; bumpB(v.method, "pass"); }
    else if (p === false) { failCount++; bumpB(v.method, "fail"); }
    else { pendingCount++; bumpB(v.method, "pending"); }
  });
  (signoffPoints.data ?? []).forEach((p: any) => {
    const sv = signValues[p.id] ?? { method: p.inspection_method ?? "visual", result_details: {} as MethodResult, notes: "" };
    const so = (signoffs.data ?? []).find((s: any) => s.characteristic_id === p.id);
    let verdict = evaluateFromMethod(sv.method, sv.result_details);
    if (verdict === null && so?.is_pass != null) verdict = so.is_pass;
    if (verdict === true) { passCount++; bumpB(sv.method, "pass"); }
    else if (verdict === false) { failCount++; bumpB(sv.method, "fail"); }
    else { pendingCount++; bumpB(sv.method, "pending"); }
  });
  const totalCount = passCount + failCount + naCount + pendingCount || 1;
  const overallVerdict: "pass" | "fail" | "pending" =
    pendingCount > 0 ? "pending" : failCount > 0 ? "fail" : "pass";

  const methodsInPlay = Object.keys(breakdown);
  const filteredItems = (items.data ?? []).filter((it: any) => {
    if (methodFilter === "all") return true;
    const v = values[it.id]; const m = v?.method ?? inferMethod(it);
    return m === methodFilter;
  });
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE));
  const pageSafe = Math.min(page, totalPages - 1);
  const pageItems = filteredItems.slice(pageSafe * PAGE, pageSafe * PAGE + PAGE);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link to="/inspections/$id" params={{ id }} className="text-sm text-muted-foreground hover:underline inline-flex items-center gap-1"><ArrowLeft className="h-4 w-4" />Back</Link>
        <h1 className="text-xl font-semibold tracking-tight mt-2">Record Measurements · {insp.data.products?.name}</h1>
        <div className="text-sm text-muted-foreground mt-1">
          {recorded} of {items.data?.length ?? 0} recorded {insp.data.lot_number ? `· Lot ${insp.data.lot_number}` : ""}
        </div>
      </div>

      <Card>
        <CardContent className="pt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="text-sm font-medium mr-2">Overall verdict</div>
            {overallVerdict === "pass" && <Badge className="bg-status-completed text-white">PASS</Badge>}
            {overallVerdict === "fail" && <Badge variant="destructive">FAIL</Badge>}
            {overallVerdict === "pending" && <Badge variant="secondary">Pending</Badge>}
            <span className="text-xs text-muted-foreground">
              {passCount} pass · {failCount} fail · {naCount} N/A · {pendingCount} pending
            </span>
          </div>
          <div className="h-2 rounded bg-muted overflow-hidden flex">
            {passCount > 0 && <div className="bg-status-completed" style={{ width: `${(passCount / totalCount) * 100}%` }} />}
            {failCount > 0 && <div className="bg-destructive" style={{ width: `${(failCount / totalCount) * 100}%` }} />}
            {naCount > 0 && <div className="bg-muted-foreground/40" style={{ width: `${(naCount / totalCount) * 100}%` }} />}
          </div>
          {methodsInPlay.length > 0 && (
            <div className="pt-2 border-t">
              <div className="text-xs font-medium mb-1.5">Breakdown by method</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {methodsInPlay.map((m) => {
                  const b = breakdown[m];
                  return (
                    <div key={m} className="rounded border p-2 text-xs">
                      <div className="font-medium capitalize">{m}</div>
                      <div className="mt-1 text-muted-foreground">
                        <span className="text-status-completed">{b.pass} pass</span> ·{" "}
                        <span className="text-destructive">{b.fail} fail</span> ·{" "}
                        {b.na} N/A · {b.pending} pending
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>



      {(signoffPoints.data ?? []).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Hold / Witness / Review sign-offs</CardTitle>
            <p className="text-xs text-muted-foreground">
              Record method results here. Hold points must be signed off before completion.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {(signoffPoints.data ?? []).map((p: any) => {
              const so = (signoffs.data ?? []).find((s: any) => s.characteristic_id === p.id);
              const isSigned = so?.status === "signed";
              const sv = signValues[p.id] ?? { method: p.inspection_method ?? "visual", result_details: {} as MethodResult, notes: "" };
              const setSv = (patch: Partial<typeof sv>) =>
                setSignValues({ ...signValues, [p.id]: { ...sv, ...patch } });
              const setRd = (patch: Partial<MethodResult>) =>
                setSv({ result_details: { ...sv.result_details, ...patch } });
              const tone =
                p.point_type === "hold"
                  ? "bg-destructive/10 text-destructive border-destructive/40"
                  : p.point_type === "witness"
                  ? "bg-amber-500/10 text-amber-700 border-amber-500/40 dark:text-amber-400"
                  : "bg-sky-500/10 text-sky-700 border-sky-500/40 dark:text-sky-400";
              const docs = Array.isArray(p.required_documents) ? p.required_documents : [];
              const verdict = evaluateFromMethod(sv.method, sv.result_details);
              return (
                <div key={p.id} className="rounded-md border p-3 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded border ${tone}`}>{p.point_type}</span>
                    <span className="font-medium">{p.sequence}. {p.activity ?? "—"}</span>
                    {p.responsibility_role && <span className="text-xs text-muted-foreground">· {p.responsibility_role}</span>}
                    {verdict === true && <Badge className="bg-status-completed text-white ml-auto">Pass</Badge>}
                    {verdict === false && <Badge variant="destructive" className="ml-auto">Fail</Badge>}
                    {verdict == null && <Badge variant="secondary" className="ml-auto">Pending</Badge>}
                  </div>
                  {p.acceptance_criteria && (
                    <div className="text-xs text-muted-foreground">Acceptance: {p.acceptance_criteria}</div>
                  )}
                  {docs.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {docs.map((d: string) => (
                        <span key={d} className="text-[10px] rounded border bg-muted px-1.5 py-0.5">{d}</span>
                      ))}
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Method</Label>
                      <Select value={sv.method} onValueChange={(v) => setSv({ method: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="visual">Visual</SelectItem>
                          <SelectItem value="dimensional">Dimensional</SelectItem>
                          <SelectItem value="ndt">NDT</SelectItem>
                          <SelectItem value="functional">Functional</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Notes</Label>
                      <Input value={sv.notes} onChange={(e) => setSv({ notes: e.target.value })} placeholder="Optional" />
                    </div>
                  </div>
                  <MethodFields method={sv.method} rd={sv.result_details} onChange={setRd} />
                  <div className="flex items-center justify-end gap-2">
                    {isSigned && so?.signed_at && (
                      <span className="text-[11px] text-muted-foreground mr-auto">Signed {new Date(so.signed_at).toLocaleString()}</span>
                    )}
                    {isSigned ? (
                      <>
                        <Badge className="bg-status-completed text-white">Signed</Badge>
                        <Button size="sm" variant="outline"
                          onClick={() => signMut.mutate({ characteristic_id: p.id, point_type: p.point_type, unsign: true })}
                          disabled={signMut.isPending}>Unsign</Button>
                      </>
                    ) : (
                      <Button size="sm"
                        onClick={() => signMut.mutate({
                          characteristic_id: p.id,
                          point_type: p.point_type,
                          notes: sv.notes || undefined,
                          result_details: { ...sv.result_details, method: sv.method },
                          is_pass: verdict,
                        })}
                        disabled={signMut.isPending}>
                        Sign off
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">ITP characteristics · Measurements</div>
        <div className="flex items-center gap-2">
          <Select value={methodFilter} onValueChange={(v) => { setMethodFilter(v); setPage(0); }}>
            <SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All methods</SelectItem>
              <SelectItem value="visual">Visual</SelectItem>
              <SelectItem value="dimensional">Dimensional</SelectItem>
              <SelectItem value="ndt">NDT</SelectItem>
              <SelectItem value="functional">Functional</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">
            {filteredItems.length ? `${pageSafe * PAGE + 1}–${Math.min(filteredItems.length, (pageSafe + 1) * PAGE)} of ${filteredItems.length}` : "0 items"}
          </span>
        </div>
      </div>

      <div className="space-y-3">
        {pageItems.map((it: any) => {
          const v = values[it.id] ?? { value: "", notes: "", na: false, attachment_url: null, gage_id: null, method: inferMethod(it), result_details: {} as MethodResult };
          const setV = (patch: Partial<Row>) => setValues({ ...values, [it.id]: { ...v, ...patch } });
          const pass = v.na ? null : evaluatePass(it, v.value, v.method, v.result_details);
          const err = errors[it.id];
          return (
            <Card key={it.id} className={err ? "border-destructive" : ""}>
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">
                      {it.sequence}. {it.name}
                      {it.is_critical && <Badge variant="destructive" className="ml-1">CCP</Badge>}
                      {it.is_required && <span className="text-destructive ml-1">*</span>}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {it.measurement_type} · Target {it.target_value ?? "—"}{it.unit ?? ""} · {it.lower_tolerance ?? "—"}—{it.upper_tolerance ?? "—"}
                    </div>
                    {it.pass_criteria && <div className="text-xs mt-1">Pass: {it.pass_criteria}</div>}
                  </div>
                  {pass === true && <Check className="h-5 w-5 text-status-completed" />}
                  {pass === false && <X className="h-5 w-5 text-destructive" />}
                  {v.na && <Badge variant="secondary">N/A</Badge>}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Method</Label>
                    <Select value={v.method} onValueChange={(m) => setV({ method: m })} disabled={v.na}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="visual">Visual</SelectItem>
                        <SelectItem value="dimensional">Dimensional</SelectItem>
                        <SelectItem value="ndt">NDT</SelectItem>
                        <SelectItem value="functional">Functional</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Measurement</Label>
                    {it.measurement_type === "boolean" ? (
                      <Select value={v.value} onValueChange={(val) => setV({ value: val, na: false })} disabled={v.na}>
                        <SelectTrigger><SelectValue placeholder="Choose" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="true">Pass</SelectItem>
                          <SelectItem value="false">Fail</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input type={it.measurement_type === "numeric" ? "number" : "text"} step="any" disabled={v.na}
                        value={v.value} onChange={(e) => setV({ value: e.target.value })} />
                    )}
                  </div>
                </div>
                <MethodFields method={v.method} rd={v.result_details} onChange={(rd) => setV({ result_details: { ...v.result_details, ...rd } })} />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Notes</Label>
                    <Input value={v.notes} onChange={(e) => setV({ notes: e.target.value })} placeholder="Optional" />
                  </div>
                  <div>
                    <Label className="text-xs">Gage / Standard</Label>
                    <Select value={v.gage_id ?? "none"} onValueChange={(val) => setV({ gage_id: val === "none" ? null : val })} disabled={v.na}>
                      <SelectTrigger><SelectValue placeholder="Select gage used" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— No gage —</SelectItem>
                        {gages.data?.map((g: any) => (
                          <SelectItem key={g.id} value={g.id}>
                            <span className="font-mono text-xs mr-2">{g.code}</span>{g.name} <span className="text-muted-foreground">· {g.gage_type}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex items-center gap-4 flex-wrap">
                  <label className="flex items-center gap-2 text-xs">
                    <input type="checkbox" checked={v.na}
                      onChange={(e) => setV({ na: e.target.checked, value: e.target.checked ? "" : v.value })} />
                    Mark N/A
                  </label>
                  <label className="text-xs inline-flex items-center gap-2 cursor-pointer">
                    <span className="rounded border px-2 py-1 hover:bg-accent">
                      {uploading === it.id ? "Uploading..." : v.attachment_url ? "Replace photo" : "📷 Add photo"}
                    </span>
                    <input type="file" accept="image/*" capture="environment" className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPhoto(it.id, f); }} />
                  </label>
                  {v.attachment_url && (
                    <a href={v.attachment_url} target="_blank" rel="noreferrer" className="text-xs text-primary underline">View photo</a>
                  )}
                </div>
                {err && <div className="text-xs text-destructive">{err}</div>}
              </CardContent>
            </Card>
          );
        })}
        {filteredItems.length === 0 && (
          <EmptyState title="No characteristics match this filter" />
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={pageSafe === 0}>Prev</Button>
          <span className="text-xs text-muted-foreground">Page {pageSafe + 1} / {totalPages}</span>
          <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={pageSafe >= totalPages - 1}>Next</Button>
        </div>
      )}

      <div className="sticky bottom-4 flex gap-2 justify-end bg-background/80 backdrop-blur p-3 rounded-lg border">
        <Button variant="outline" onClick={() => save(false)} disabled={saving}>Save Draft</Button>
        <Button onClick={() => save(true)} disabled={saving}>Submit & Complete</Button>
      </div>
    </div>
  );
}

function MethodFields({ method, rd, onChange }: { method: string; rd: any; onChange: (patch: any) => void }) {
  if (method === "visual") {
    return (
      <div className="rounded border bg-muted/30 p-3 space-y-2">
        <div className="text-xs font-medium">Visual inspection</div>
        <div>
          <Label className="text-xs">Findings</Label>
          <Textarea rows={2} value={rd.visual_findings ?? ""} onChange={(e) => onChange({ visual_findings: e.target.value })} placeholder="e.g. no visible cracks or discoloration" />
        </div>
        <div>
          <Label className="text-xs">Result</Label>
          <Select value={rd.visual_result || ""} onValueChange={(v) => onChange({ visual_result: v as any })}>
            <SelectTrigger><SelectValue placeholder="Select verdict" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pass">Pass</SelectItem>
              <SelectItem value="fail">Fail</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    );
  }
  if (method === "ndt") {
    return (
      <div className="rounded border bg-muted/30 p-3 space-y-2">
        <div className="text-xs font-medium">Non-Destructive Test</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">NDT method</Label>
            <Select value={rd.ndt_method || ""} onValueChange={(v) => onChange({ ndt_method: v })}>
              <SelectTrigger><SelectValue placeholder="Select NDT method" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="UT">Ultrasonic (UT)</SelectItem>
                <SelectItem value="RT">Radiographic (RT)</SelectItem>
                <SelectItem value="MT">Magnetic Particle (MT)</SelectItem>
                <SelectItem value="PT">Liquid Penetrant (PT)</SelectItem>
                <SelectItem value="VT">Visual (VT)</SelectItem>
                <SelectItem value="ET">Eddy Current (ET)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Reference standard</Label>
            <Input value={rd.ndt_reference ?? ""} onChange={(e) => onChange({ ndt_reference: e.target.value })} placeholder="e.g. ASME V, Art. 4" />
          </div>
        </div>
        <div>
          <Label className="text-xs">Indications / findings</Label>
          <Textarea rows={2} value={rd.ndt_indications ?? ""} onChange={(e) => onChange({ ndt_indications: e.target.value })} placeholder="Describe indications found (or none)" />
        </div>
        <div>
          <Label className="text-xs">Result</Label>
          <Select value={rd.ndt_result || ""} onValueChange={(v) => onChange({ ndt_result: v as any })}>
            <SelectTrigger><SelectValue placeholder="Select verdict" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pass">Pass (no rejectable indications)</SelectItem>
              <SelectItem value="fail">Fail (rejectable indications)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    );
  }
  if (method === "functional") {
    return (
      <div className="rounded border bg-muted/30 p-3 space-y-2">
        <div className="text-xs font-medium">Functional test</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Expected behaviour</Label>
            <Textarea rows={2} value={rd.func_expected ?? ""} onChange={(e) => onChange({ func_expected: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Observed behaviour</Label>
            <Textarea rows={2} value={rd.func_observed ?? ""} onChange={(e) => onChange({ func_observed: e.target.value })} />
          </div>
        </div>
        <div>
          <Label className="text-xs">Result</Label>
          <Select value={rd.func_result || ""} onValueChange={(v) => onChange({ func_result: v as any })}>
            <SelectTrigger><SelectValue placeholder="Select verdict" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pass">Pass</SelectItem>
              <SelectItem value="fail">Fail</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    );
  }
  return null;
}
