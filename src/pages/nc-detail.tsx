import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Plus } from "lucide-react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMyRoles, hasAnyRole, useSession } from "@/lib/auth";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [caOpen, setCaOpen] = useState(false);

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
    onError: (e: Error) => toast.error(e.message),
  });

  const updateFields = useMutation({
    mutationFn: async (patch: Record<string, any>) => {
      const { error } = await supabase.from("non_conformances").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["nc", id] }); },
    onError: (e: Error) => toast.error(e.message),
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
                    else transition.mutate({ next: t.next });
                  }}>
                  {t.label}
                </Button>
              ))}
              <Button size="sm" onClick={() => setCaOpen(true)}><Plus className="h-4 w-4 mr-1" />Add CA</Button>
            </div>
          )}
        </div>
      </div>

      <Tabs defaultValue="info">
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
              <div>
                <Label>Root cause</Label>
                <Textarea defaultValue={n.root_cause ?? ""} rows={3}
                  onBlur={(e) => e.target.value !== (n.root_cause ?? "") && updateFields.mutate({ root_cause: e.target.value })}
                  disabled={!canManage} />
              </div>
              <div>
                <Label>Containment actions</Label>
                <Textarea defaultValue={n.containment ?? ""} rows={3}
                  onBlur={(e) => e.target.value !== (n.containment ?? "") && updateFields.mutate({ containment: e.target.value })}
                  disabled={!canManage} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cas" className="mt-4">
          {!(n.corrective_actions ?? []).length ? <EmptyState title="No corrective actions yet" /> :
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
           </div>}
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

      <NewCaDialog open={caOpen} onOpenChange={setCaOpen} ncId={id} onCreated={() => qc.invalidateQueries({ queryKey: ["nc", id] })} />
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="grid grid-cols-3 gap-4"><div className="text-muted-foreground">{label}</div><div className="col-span-2">{children}</div></div>;
}

function NewCaDialog({ open, onOpenChange, ncId, onCreated }: { open: boolean; onOpenChange: (v: boolean) => void; ncId: string; onCreated: () => void }) {
  const { user } = useSession();
  const [desc, setDesc] = useState("");
  const [due, setDue] = useState("");
  const [assignee, setAssignee] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const users = useQuery({
    queryKey: ["users-all"],
    enabled: open,
    queryFn: async () => (await supabase.from("profiles").select("id, full_name, email").eq("is_active", true).order("full_name")).data ?? [],
  });
  async function submit() {
    if (!desc.trim()) { toast.error("Description required"); return; }
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
      onCreated(); onOpenChange(false);
      setDesc(""); setDue(""); setAssignee(null);
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add Corrective Action</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Description</Label><Textarea rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
          <div><Label>Assign to</Label>
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
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Adding..." : "Add"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
