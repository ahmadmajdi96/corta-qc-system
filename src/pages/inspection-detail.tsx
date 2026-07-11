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
        .select(`*, products(id, name, sku), quality_specifications(version), profiles!inspections_performed_by_fkey(full_name),
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
    onError: (e: Error) => toast.error(e.message),
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
          {(i.non_conformances ?? []).length === 0 ? <EmptyState title="No non-conformances raised" /> :
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
    queryFn: async () => (await supabase.from("inspections").select("*, products(name)").eq("id", id).maybeSingle()).data,
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

  const [values, setValues] = useState<Record<string, { value: string; notes: string }>>({});
  const [saving, setSaving] = useState(false);

  // Init values from existing
  const initedRef = useState({ done: false })[0];
  if (!initedRef.done && existing.data && items.data) {
    const map: Record<string, { value: string; notes: string }> = {};
    items.data.forEach((it: any) => {
      const m = existing.data.find((x: any) => x.spec_item_id === it.id);
      map[it.id] = { value: m?.measured_value ?? "", notes: m?.notes ?? "" };
    });
    initedRef.done = true;
    setValues(map);
  }

  function evaluatePass(it: any, raw: string): boolean | null {
    if (raw === "" || raw == null) return null;
    if (it.measurement_type === "numeric") {
      const n = Number(raw); if (isNaN(n)) return null;
      const lo = it.lower_tolerance != null ? Number(it.lower_tolerance) : -Infinity;
      const hi = it.upper_tolerance != null ? Number(it.upper_tolerance) : Infinity;
      return n >= lo && n <= hi;
    }
    if (it.measurement_type === "boolean") return raw === "true" || raw === "pass";
    return null; // text / visual: user judges
  }

  async function save(complete: boolean) {
    if (!user || !insp.data || !items.data) return;
    setSaving(true);
    try {
      // Ensure in_progress
      if (insp.data.status === "planned") {
        await supabase.from("inspections").update({ status: "in_progress", started_at: new Date().toISOString(), performed_by: user.id }).eq("id", id);
      }
      const rows = items.data.map((it: any) => {
        const v = values[it.id] ?? { value: "", notes: "" };
        return {
          inspection_id: id, spec_item_id: it.id,
          measured_value: v.value || null,
          notes: v.notes || null,
          is_pass: evaluatePass(it, v.value),
          recorded_by: user.id, recorded_at: new Date().toISOString(),
        };
      }).filter((r) => r.measured_value !== null || r.notes !== null);
      if (rows.length) {
        const { error } = await supabase.from("inspection_measurements").upsert(rows, { onConflict: "inspection_id,spec_item_id" });
        if (error) throw error;
      }
      if (complete) {
        // require all items recorded
        const missing = items.data.filter((it: any) => !(values[it.id]?.value));
        if (missing.length) throw new Error(`Please record all measurements first (${missing.length} missing).`);
        await supabase.from("inspections").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", id);
        await supabase.from("audit_logs").insert({ user_id: user.id, action: "inspection.completed", entity_type: "inspection", entity_id: id });
        toast.success("Inspection completed");
      } else {
        toast.success("Draft saved");
      }
      qc.invalidateQueries({ queryKey: ["inspection", id] });
      qc.invalidateQueries({ queryKey: ["measurements", id] });
      if (complete) navigate({ to: "/inspections/$id", params: { id } });
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  }

  if (insp.isLoading || items.isLoading) return <div className="max-w-3xl"><Skeleton className="h-64" /></div>;
  if (!insp.data) return <div>Inspection not found.</div>;

  const recorded = Object.values(values).filter((v) => v.value).length;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link to="/inspections/$id" params={{ id }} className="text-sm text-muted-foreground hover:underline inline-flex items-center gap-1"><ArrowLeft className="h-4 w-4" />Back</Link>
        <h1 className="text-xl font-semibold tracking-tight mt-2">Record Measurements · {insp.data.products?.name}</h1>
        <div className="text-sm text-muted-foreground mt-1">
          {recorded} of {items.data?.length ?? 0} recorded {insp.data.lot_number ? `· Lot ${insp.data.lot_number}` : ""}
        </div>
      </div>

      <div className="space-y-3">
        {(items.data ?? []).map((it: any) => {
          const v = values[it.id] ?? { value: "", notes: "" };
          const pass = evaluatePass(it, v.value);
          return (
            <Card key={it.id}>
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{it.sequence}. {it.name} {it.is_critical && <Badge variant="destructive" className="ml-1">CCP</Badge>}</div>
                    <div className="text-xs text-muted-foreground">
                      {it.measurement_type} · Target {it.target_value ?? "—"}{it.unit ?? ""} · {it.lower_tolerance ?? "—"}—{it.upper_tolerance ?? "—"}
                    </div>
                    {it.pass_criteria && <div className="text-xs mt-1">Pass: {it.pass_criteria}</div>}
                  </div>
                  {pass === true && <Check className="h-5 w-5 text-status-completed" />}
                  {pass === false && <X className="h-5 w-5 text-destructive" />}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Measurement</Label>
                    {it.measurement_type === "boolean" ? (
                      <Select value={v.value} onValueChange={(val) => setValues({ ...values, [it.id]: { ...v, value: val } })}>
                        <SelectTrigger><SelectValue placeholder="Choose" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="true">Pass</SelectItem>
                          <SelectItem value="false">Fail</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input type={it.measurement_type === "numeric" ? "number" : "text"} step="any"
                        value={v.value} onChange={(e) => setValues({ ...values, [it.id]: { ...v, value: e.target.value } })} />
                    )}
                  </div>
                  <div>
                    <Label className="text-xs">Notes</Label>
                    <Input value={v.notes} onChange={(e) => setValues({ ...values, [it.id]: { ...v, notes: e.target.value } })} placeholder="Optional" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="sticky bottom-4 flex gap-2 justify-end bg-background/80 backdrop-blur p-3 rounded-lg border">
        <Button variant="outline" onClick={() => save(false)} disabled={saving}>Save Draft</Button>
        <Button onClick={() => save(true)} disabled={saving}>Submit & Complete</Button>
      </div>
    </div>
  );
}
