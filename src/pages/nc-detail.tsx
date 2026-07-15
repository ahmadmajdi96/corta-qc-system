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
import { ArrowLeft, Plus, FileSearch } from "lucide-react";
import { toast } from "sonner";
import { notifyError } from "@/lib/toast";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMyRoles, hasAnyRole, useSession } from "@/lib/auth";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ElectronicSignatureDialog } from "@/components/electronic-signature-dialog";

const NEXT_TRANSITIONS: Record<string, { label: string; next: string }[]> = {
  open: [{ label: "Investigate", next: "under_investigation" }],
  under_investigation: [
    { label: "Propose Corrective Action", next: "corrective_action_defined" },
    { label: "Reject", next: "rejected" },
  ],
  corrective_action_defined: [{ label: "Close", next: "closed" }, { label: "Re-open", next: "under_investigation" }],
  closed: [{ label: "Re-open", next: "under_investigation" }],
  rejected: [{ label: "Re-open", next: "open" }],
};

export function NcDetailPage({ id }: { id: string }) {
  const { user } = useSession();
  const { data: roles } = useMyRoles();
  const canManage = hasAnyRole(roles, "administrator", "quality_manager");
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [tab, setTab] = useState("info");
  const [showInlineCa, setShowInlineCa] = useState(false);
  const [esigOpen, setEsigOpen] = useState(false);

  const nc = useQuery({
    queryKey: ["nc", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("non_conformances")
        .select(`*, inspections(id, products(id, name, sku)),
                 profiles!non_conformances_raised_by_profile_fkey(full_name),
                 corrective_actions(*, profiles!corrective_actions_assigned_to_profile_fkey(full_name))`)
        .eq("id", id).maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Not found");
      return data as any;
    },
  });

  const audit = useQuery({
    queryKey: ["audit", "non_conformance", id],
    queryFn: async () => (await supabase.from("audit_logs")
      .select("*, profiles(full_name)")
      .eq("entity_type", "non_conformance").eq("entity_id", id)
      .order("created_at", { ascending: false })).data ?? [],
  });

  const transition = useMutation({
    mutationFn: async ({ next, reason }: { next: string; reason?: string }) => {
      if (next === "closed") {
        // Fetch fresh CAs to enforce "all verified before close"
        const { data: cas, error: caErr } = await supabase.from("corrective_actions")
          .select("id, status").eq("non_conformance_id", id);
        if (caErr) throw caErr;
        if (!cas || cas.length === 0) throw new Error("Cannot close: at least one corrective action must be verified first");
        const unverified = cas.filter((c: any) => c.status !== "verified");
        if (unverified.length) throw new Error(`Cannot close: ${unverified.length} corrective action(s) are not verified yet`);
      }
      const patch: any = { status: next };
      if (next === "closed") patch.closed_at = new Date().toISOString();
      if (next === "rejected") patch.rejection_reason = reason ?? null;
      const { error } = await supabase.from("non_conformances").update(patch).eq("id", id);
      if (error) throw error;
      await supabase.from("audit_logs").insert({
        user_id: user!.id, action: `nc.status.${next}`, entity_type: "non_conformance", entity_id: id,
        details: reason ? { reason } : null,
      });
    },
    onSuccess: () => {
      toast.success("Status updated");
      setRejectOpen(false); setRejectReason("");
      qc.invalidateQueries({ queryKey: ["nc", id] });
      qc.invalidateQueries({ queryKey: ["audit", "non_conformance", id] });
    },
    onError: (e: Error) => notifyError(e.message),
  });

  const updateFields = useMutation({
    mutationFn: async (patch: Record<string, any>) => {
      const { error } = await (supabase.from("non_conformances") as any).update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["nc", id] }); },
    onError: (e: Error) => notifyError(e.message),
  });

  const linkedCapa = useQuery({
    queryKey: ["nc-capa", id],
    queryFn: async () => {
      const { data } = await supabase.from("capa_records").select("id, capa_number, status")
        .eq("nc_id", id).maybeSingle();
      return data;
    },
  });

  const openCapa = useMutation({
    mutationFn: async () => {
      if (linkedCapa.data) return linkedCapa.data;
      const n = nc.data;
      const problem = [
        n?.description ? `Problem: ${n.description}` : null,
        n?.category ? `Category: ${n.category}` : null,
        n?.severity ? `Severity: ${n.severity}` : null,
        n?.number ? `Source NC: ${n.number}` : null,
      ].filter(Boolean).join("\n");
      const containment = [
        n?.containment,
        n?.quarantine_location && `Location: ${n.quarantine_location}`,
        n?.quarantine_qty != null && `Qty: ${n.quarantine_qty}`,
        n?.quarantine_tag && `Tag: ${n.quarantine_tag}`,
        n?.segregation_status && `Segregation: ${n.segregation_status}`,
      ].filter(Boolean).join("\n") || null;
      const { data, error } = await supabase.from("capa_records").insert({
        nc_id: id,
        methodology: "8d",
        status: "open",
        d2_problem: problem,
        d3_containment: containment,
        d4_root_cause: n?.root_cause ?? null,
        created_by: user!.id,
        owner_id: user!.id,
      } as any).select("id, capa_number").single();
      if (error) throw error;
      // Persist the reverse link on the NC so the relationship is reliable.
      await (supabase.from("non_conformances") as any).update({ capa_id: data.id }).eq("id", id);
      await supabase.from("audit_logs").insert({
        user_id: user!.id, action: "capa.opened_from_nc", entity_type: "non_conformance", entity_id: id,
        details: { capa_id: data.id, capa_number: data.capa_number },
      });
      return data;
    },
    onSuccess: (c) => {
      qc.invalidateQueries({ queryKey: ["nc-capa", id] });
      qc.invalidateQueries({ queryKey: ["nc", id] });
      if (c?.id) navigate({ to: "/capa/$id", params: { id: c.id } });
    },
    onError: (e: Error) => notifyError(e.message),
  });


  if (nc.isLoading) return <div className="max-w-4xl"><Skeleton className="h-64" /></div>;
  if (nc.error) return <div className="text-destructive">Failed to load.</div>;
  const n = nc.data;

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <Link to="/non-conformances" className="text-sm text-muted-foreground hover:underline inline-flex items-center gap-1"><ArrowLeft className="h-4 w-4" />Back</Link>
        <div className="flex items-center justify-between mt-2">
          <div>
            <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2 font-mono">{n.number}</h1>
            <div className="flex items-center gap-2 mt-1">
              <StatusBadge status={n.severity} kind="severity" />
              <StatusBadge status={n.status} kind="nc" />
              <span className="text-xs text-muted-foreground">Raised {new Date(n.raised_at).toLocaleString()} by {n.profiles?.full_name}</span>
            </div>
          </div>
          {canManage && (
            <div className="flex gap-2 flex-wrap justify-end">
              {(NEXT_TRANSITIONS[n.status] ?? []).map((t) => (
                <Button key={t.next} size="sm" variant="outline"
                  onClick={() => {
                    if (t.next === "rejected") setRejectOpen(true);
                    else if (t.next === "closed") setEsigOpen(true);
                    else transition.mutate({ next: t.next });
                  }}>
                  {t.label}
                </Button>
              ))}
              <Button size="sm" onClick={() => { setTab("cas"); setShowInlineCa(true); }}>
                <Plus className="h-4 w-4 mr-1" />Define Corrective Action
              </Button>
              {linkedCapa.data ? (
                <Button size="sm" variant="secondary" asChild>
                  <Link to="/capa/$id" params={{ id: linkedCapa.data.id }}>
                    <FileSearch className="h-4 w-4 mr-1" />Open CAPA {linkedCapa.data.capa_number ?? ""}
                  </Link>
                </Button>
              ) : (
                <Button size="sm" variant="secondary" onClick={() => openCapa.mutate()} disabled={openCapa.isPending}>
                  <FileSearch className="h-4 w-4 mr-1" />{openCapa.isPending ? "Opening…" : "Open CAPA (8D)"}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="info">Details</TabsTrigger>
          <TabsTrigger value="cas">Corrective Actions ({n.corrective_actions?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="audit">History</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="mt-4 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Row label="Product"><Link to="/products/$id" params={{ id: n.inspections?.products?.id }} className="hover:underline">{n.inspections?.products?.name}</Link></Row>
              <Row label="Inspection"><Link to="/inspections/$id" params={{ id: n.inspections?.id }} className="hover:underline">View</Link></Row>
              <Row label="Category">{n.category ?? "—"}</Row>
              <Row label="Description"><div className="whitespace-pre-wrap">{n.description}</div></Row>
              {n.rejection_reason && <Row label="Rejection reason">{n.rejection_reason}</Row>}
              {n.closed_at && <Row label="Closed">{new Date(n.closed_at).toLocaleString()}</Row>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Investigation</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label>Root cause category</Label>
                  <Select
                    value={(n.root_cause_category as string | null) ?? "__none"}
                    onValueChange={(v) => updateFields.mutate({ root_cause_category: v === "__none" ? null : v })}
                    disabled={!canManage}
                  >
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">—</SelectItem>
                      <SelectItem value="human">Human</SelectItem>
                      <SelectItem value="equipment">Equipment / Machine</SelectItem>
                      <SelectItem value="material">Material</SelectItem>
                      <SelectItem value="method">Method / Process</SelectItem>
                      <SelectItem value="measurement">Measurement</SelectItem>
                      <SelectItem value="environment">Environment</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Category</Label>
                  <Input
                    defaultValue={n.category ?? ""}
                    onBlur={(e) => e.target.value !== (n.category ?? "") && updateFields.mutate({ category: e.target.value || null })}
                    disabled={!canManage}
                    placeholder="e.g. dimensional, cosmetic"
                  />
                </div>
              </div>
              <div>
                <Label>Root cause</Label>
                <Textarea defaultValue={n.root_cause ?? ""} rows={3}
                  onBlur={(e) => e.target.value !== (n.root_cause ?? "") && updateFields.mutate({ root_cause: e.target.value })}
                  disabled={!canManage} />
              </div>
              <div>
                <Label>Containment / narrative</Label>
                <Textarea defaultValue={n.containment ?? ""} rows={2}
                  onBlur={(e) => e.target.value !== (n.containment ?? "") && updateFields.mutate({ containment: e.target.value })}
                  disabled={!canManage}
                  placeholder="Immediate action taken to contain the issue…" />
              </div>
              <div className="rounded-md border bg-muted/20 p-3 space-y-3">
                <div className="text-sm font-medium">Segregation & Quarantine</div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">Quarantine location</Label>
                    <Input defaultValue={n.quarantine_location ?? ""} disabled={!canManage}
                      placeholder="e.g. QC Cage A / Bin 12"
                      onBlur={(e) => e.target.value !== (n.quarantine_location ?? "") &&
                        updateFields.mutate({ quarantine_location: e.target.value || null })} />
                  </div>
                  <div>
                    <Label className="text-xs">Quantity</Label>
                    <Input type="number" step="any" defaultValue={n.quarantine_qty ?? ""} disabled={!canManage}
                      placeholder="e.g. 24"
                      onBlur={(e) => {
                        const raw = e.target.value;
                        const val = raw === "" ? null : Number(raw);
                        if (val !== (n.quarantine_qty ?? null))
                          updateFields.mutate({ quarantine_qty: val });
                      }} />
                  </div>
                  <div>
                    <Label className="text-xs">Quarantine tag #</Label>
                    <Input defaultValue={n.quarantine_tag ?? ""} disabled={!canManage}
                      placeholder="e.g. QT-2026-0123"
                      onBlur={(e) => e.target.value !== (n.quarantine_tag ?? "") &&
                        updateFields.mutate({ quarantine_tag: e.target.value || null })} />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Segregation status</Label>
                  <Select
                    value={(n.segregation_status as string | null) ?? "__none"}
                    onValueChange={(v) => updateFields.mutate({ segregation_status: v === "__none" ? null : v })}
                    disabled={!canManage}
                  >
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">—</SelectItem>
                      <SelectItem value="pending">Pending segregation</SelectItem>
                      <SelectItem value="segregated">Segregated / tagged</SelectItem>
                      <SelectItem value="quarantined">Quarantined (locked)</SelectItem>
                      <SelectItem value="released">Released</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Disposition</CardTitle>
              <p className="text-xs text-muted-foreground">
                Saving a disposition automatically opens or updates a linked 8D CAPA and stores the linkage on this NC.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>Decision</Label>
                <Select
                  value={(n.disposition as string | null) ?? "__none"}
                  onValueChange={async (v) => {
                    const value = v === "__none" ? null : v;
                    await updateFields.mutateAsync({ disposition: value });
                    if (!value) return;
                    if (!linkedCapa.data) {
                      openCapa.mutate();
                    } else {
                      // Update existing CAPA's D3 containment with latest structured data.
                      const containment = [
                        n.containment,
                        n.quarantine_location && `Location: ${n.quarantine_location}`,
                        n.quarantine_qty != null && `Qty: ${n.quarantine_qty}`,
                        n.quarantine_tag && `Tag: ${n.quarantine_tag}`,
                        n.segregation_status && `Segregation: ${n.segregation_status}`,
                        `Disposition: ${value}`,
                      ].filter(Boolean).join("\n");
                      await supabase.from("capa_records").update({
                        d3_containment: containment,
                        d4_root_cause: n.root_cause ?? null,
                      } as any).eq("id", linkedCapa.data.id);
                      // Ensure NC.capa_id link is set (older records may lack it).
                      if (!n.capa_id) await (supabase.from("non_conformances") as any)
                        .update({ capa_id: linkedCapa.data.id }).eq("id", id);
                      qc.invalidateQueries({ queryKey: ["nc-capa", id] });
                      toast.success("Linked CAPA updated");
                    }
                  }}
                  disabled={!canManage}
                >
                  <SelectTrigger><SelectValue placeholder="Choose disposition…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">—</SelectItem>
                    <SelectItem value="scrap">Scrap</SelectItem>
                    <SelectItem value="rework">Rework</SelectItem>
                    <SelectItem value="repair">Repair</SelectItem>
                    <SelectItem value="return_to_vendor">Return to vendor</SelectItem>
                    <SelectItem value="use_as_is">Use as-is (concession)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {n.disposition && (
                <div className="rounded-md border bg-muted/40 p-3 text-sm space-y-1">
                  <div>
                    Disposition: <span className="font-medium capitalize">{String(n.disposition).replace(/_/g, " ")}</span>
                  </div>
                  {linkedCapa.data ? (
                    <div className="text-xs text-muted-foreground">
                      Linked CAPA:{" "}
                      <Link to="/capa/$id" params={{ id: linkedCapa.data.id }} className="underline">
                        {linkedCapa.data.capa_number ?? linkedCapa.data.id.slice(0, 8)}
                      </Link>
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground">Opening CAPA…</div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cas" className="mt-4 space-y-3">
          {(n.corrective_actions ?? []).length ? (
            <div className="space-y-2">
              {n.corrective_actions.map((ca: any) => (
                <Link key={ca.id} to="/corrective-actions/$id" params={{ id: ca.id }} className="block rounded border p-3 hover:bg-accent/40">
                  <div className="flex items-center justify-between">
                    <div className="text-sm line-clamp-1">{ca.description}</div>
                    <StatusBadge status={ca.status} kind="ca" />
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Assigned: {ca.profiles?.full_name ?? "—"} · Due: {ca.due_date ?? "—"}
                  </div>
                </Link>
              ))}
            </div>
          ) : !showInlineCa ? (
            <EmptyState title="No corrective actions yet"
              action={canManage ? <Button onClick={() => setShowInlineCa(true)}><Plus className="h-4 w-4 mr-2" />Define Corrective Action</Button> : undefined} />
          ) : null}

          {canManage && (
            showInlineCa ? (
              <InlineCaForm ncId={id} onCancel={() => setShowInlineCa(false)}
                onCreated={() => { setShowInlineCa(false); qc.invalidateQueries({ queryKey: ["nc", id] }); }} />
            ) : (n.corrective_actions ?? []).length ? (
              <Button variant="outline" size="sm" onClick={() => setShowInlineCa(true)}>
                <Plus className="h-4 w-4 mr-2" />Define another corrective action
              </Button>
            ) : null
          )}
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          {audit.isLoading ? <Skeleton className="h-24" /> :
           !audit.data?.length ? <EmptyState title="No history yet" /> :
           <ul className="space-y-2 text-sm">
             {(audit.data as any[]).map((a) => (
               <li key={a.id} className="rounded border p-3">
                 <div className="flex items-center justify-between">
                   <div className="font-medium">{a.action}</div>
                   <div className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</div>
                 </div>
                 <div className="text-xs text-muted-foreground">by {a.profiles?.full_name ?? "system"}</div>
                 {a.details && <pre className="text-xs mt-1 bg-muted p-2 rounded">{JSON.stringify(a.details, null, 2)}</pre>}
               </li>
             ))}
           </ul>}
        </TabsContent>
      </Tabs>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject NC</DialogTitle></DialogHeader>
          <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Reason" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
            <Button onClick={() => transition.mutate({ next: "rejected", reason: rejectReason })} disabled={!rejectReason.trim()}>Reject</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ElectronicSignatureDialog
        open={esigOpen}
        onOpenChange={setEsigOpen}
        entityType="non_conformance"
        entityId={id}
        meaning="Approve NC disposition and close — I certify all corrective actions are verified."
        requiredRoles={["administrator", "quality_manager", "disposition_approver"]}
        onSigned={() => transition.mutate({ next: "closed" })}
      />
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="grid grid-cols-3 gap-4"><div className="text-muted-foreground">{label}</div><div className="col-span-2">{children}</div></div>;
}

function InlineCaForm({ ncId, onCancel, onCreated }: { ncId: string; onCancel: () => void; onCreated: () => void }) {
  const { user } = useSession();
  const [desc, setDesc] = useState("");
  const [due, setDue] = useState("");
  const [assignee, setAssignee] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const users = useQuery({
    queryKey: ["users-all"],
    queryFn: async () => (await supabase.from("profiles").select("id, full_name, email").eq("is_active", true).order("full_name")).data ?? [],
  });
  async function submit() {
    if (!desc.trim()) { notifyError("Description required"); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from("corrective_actions").insert({
        non_conformance_id: ncId, description: desc, due_date: due || null,
        assigned_to: assignee, status: "open",
      });
      if (error) throw error;
      await supabase.from("audit_logs").insert({
        user_id: user!.id, action: "ca.create", entity_type: "non_conformance", entity_id: ncId,
      });
      toast.success("Corrective action added");
      onCreated();
    } catch (e: any) { notifyError(e.message); } finally { setSaving(false); }
  }
  return (
    <Card className="border-primary/40">
      <CardHeader><CardTitle className="text-sm">Define Corrective Action</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div><Label>Description</Label><Textarea rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Describe the corrective action to be taken..." /></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label>Assign to</Label>
            <Select value={assignee ?? "none"} onValueChange={(v) => setAssignee(v === "none" ? null : v)}>
              <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Unassigned —</SelectItem>
                {users.data?.map((u: any) => <SelectItem key={u.id} value={u.id}>{u.full_name || u.email}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Due date</Label><Input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={submit} disabled={saving || !desc.trim()}>{saving ? "Adding..." : "Add corrective action"}</Button>
        </div>
      </CardContent>
    </Card>
  );
}
