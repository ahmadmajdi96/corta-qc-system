import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AuthGate } from "@/components/auth-gate";
import { AppShell } from "@/components/app-shell";
import { MesPage, StatusPill } from "@/components/mes/mes-page";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, ListChecks, Plus, Trash2, Pencil } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { notifyError } from "@/lib/toast";
import { EmptyState } from "@/components/empty-state";

const POINT_TYPES = [
  { value: "hold", label: "Hold (H)", tone: "danger" as const },
  { value: "witness", label: "Witness (W)", tone: "warning" as const },
  { value: "review", label: "Review (R)", tone: "info" as const },
];
const METHODS = [
  { value: "dimensional", label: "Dimensional" },
  { value: "visual", label: "Visual" },
  { value: "ndt", label: "Non-Destructive Test" },
  { value: "functional", label: "Functional" },
];

type ItpRow = {
  id: string;
  plan_id: string;
  sequence: number;
  activity: string | null;
  procedure: string | null;
  check_points: string | null;
  acceptance_criteria: string | null;
  verifying_doc: string | null;
  inspected_by: string | null;
  comments: string | null;
  point_type: string | null;
  inspection_method: string | null;
  tools: string | null;
  responsibility_role: string | null;
  required_documents: string[] | null;
  is_critical: boolean;
};

const emptyRow = {
  activity: "",
  procedure: "",
  check_points: "",
  acceptance_criteria: "",
  verifying_doc: "",
  inspected_by: "",
  comments: "",
  point_type: "",
  inspection_method: "",
  tools: "",
  responsibility_role: "",
  required_documents: [] as string[],
  is_critical: false,
};

function PlanDetail() {
  const { id } = useParams({ from: "/inspection-plans/$id" });
  const qc = useQueryClient();
  const [rowOpen, setRowOpen] = useState(false);
  const [editing, setEditing] = useState<ItpRow | null>(null);
  const [form, setForm] = useState({ ...emptyRow });
  const [docInput, setDocInput] = useState("");
  const [formErr, setFormErr] = useState<Record<string, string>>({});

  const plan = useQuery({
    queryKey: ["inspection-plan", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inspection_plans")
        .select("*, products(sku, name)")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Plan not found");
      return data as any;
    },
  });

  const rows = useQuery({
    queryKey: ["itp-rows", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plan_characteristics")
        .select("*")
        .eq("plan_id", id)
        .order("sequence", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ItpRow[];
    },
  });

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!form.activity.trim()) errs.activity = "Activity is required";
    if (!form.acceptance_criteria.trim())
      errs.acceptance_criteria = "Acceptance criteria / tolerance is required";
    if (form.point_type === "hold" && !form.responsibility_role.trim())
      errs.responsibility_role = "Hold points must specify a responsible role";
    if (form.activity.length > 200) errs.activity = "Max 200 characters";
    setFormErr(errs);
    return Object.keys(errs).length === 0;
  }

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        plan_id: id,
        activity: form.activity.trim(),
        procedure: form.procedure.trim() || null,
        check_points: form.check_points.trim() || null,
        acceptance_criteria: form.acceptance_criteria.trim(),
        verifying_doc: form.verifying_doc.trim() || null,
        inspected_by: form.inspected_by.trim() || null,
        comments: form.comments.trim() || null,
        point_type: form.point_type || null,
        inspection_method: form.inspection_method || null,
        tools: form.tools.trim() || null,
        responsibility_role: form.responsibility_role.trim() || null,
        required_documents: form.required_documents,
        is_critical: form.is_critical,
      };
      if (editing) {
        const { error } = await supabase
          .from("plan_characteristics")
          .update(payload as any)
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const nextSeq = (rows.data ?? []).reduce((m, r) => Math.max(m, r.sequence), 0) + 1;
        const { error } = await supabase
          .from("plan_characteristics")
          .insert({ ...payload, sequence: nextSeq } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Row updated" : "Row added");
      qc.invalidateQueries({ queryKey: ["itp-rows", id] });
      setRowOpen(false);
      setEditing(null);
      setForm({ ...emptyRow });
      setFormErr({});
      setDocInput("");
    },
    onError: (e: Error) => notifyError(e.message, { retry: () => save.mutate() }),
  });

  const del = useMutation({
    mutationFn: async (rowId: string) => {
      const { error } = await supabase.from("plan_characteristics").delete().eq("id", rowId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Row deleted");
      qc.invalidateQueries({ queryKey: ["itp-rows", id] });
    },
    onError: (e: Error) => notifyError(e.message),
  });

  function openNew() {
    setEditing(null);
    setForm({ ...emptyRow });
    setFormErr({});
    setDocInput("");
    setRowOpen(true);
  }
  function openEdit(row: ItpRow) {
    setEditing(row);
    setForm({
      activity: row.activity ?? "",
      procedure: row.procedure ?? "",
      check_points: row.check_points ?? "",
      acceptance_criteria: row.acceptance_criteria ?? "",
      verifying_doc: row.verifying_doc ?? "",
      inspected_by: row.inspected_by ?? "",
      comments: row.comments ?? "",
      point_type: row.point_type ?? "",
      inspection_method: row.inspection_method ?? "",
      tools: (row as any).tools ?? "",
      responsibility_role: (row as any).responsibility_role ?? "",
      required_documents: Array.isArray((row as any).required_documents)
        ? ((row as any).required_documents as string[])
        : [],
      is_critical: !!row.is_critical,
    });
    setFormErr({});
    setDocInput("");
    setRowOpen(true);
  }

  function addDoc() {
    const v = docInput.trim();
    if (!v) return;
    if (form.required_documents.includes(v)) {
      setDocInput("");
      return;
    }
    setForm({ ...form, required_documents: [...form.required_documents, v] });
    setDocInput("");
  }
  function removeDoc(d: string) {
    setForm({ ...form, required_documents: form.required_documents.filter((x) => x !== d) });
  }

  function onSaveClick() {
    if (!validate()) return;
    save.mutate();
  }


  return (
    <MesPage
      icon={<ListChecks className="h-5 w-5" />}
      title={plan.data?.name ?? "Inspection Plan"}
      description="Inspection & Test Plan (ITP) — activities, checkpoints, acceptance criteria and sign-off."
      action={
        <Button variant="outline" size="sm" asChild>
          <Link to="/inspection-plans">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Link>
        </Button>
      }
    >
      {plan.isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : plan.data ? (
        <div className="rounded-lg border bg-card p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
          <div>
            <div className="text-xs text-muted-foreground">Type</div>
            <StatusPill tone="info">{plan.data.plan_type}</StatusPill>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">AQL level</div>
            <div>{plan.data.aql_level ?? "—"}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Sampling rule</div>
            <div>{plan.data.sample_size_rule ?? "—"}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Status</div>
            <StatusPill tone={plan.data.is_active ? "success" : "muted"}>
              {plan.data.is_active ? "Active" : "Inactive"}
            </StatusPill>
          </div>
          {plan.data.standard_reference && (
            <div className="sm:col-span-2">
              <div className="text-xs text-muted-foreground">Standard reference</div>
              <div>{plan.data.standard_reference}</div>
            </div>
          )}
          {plan.data.description && (
            <div className="sm:col-span-2 lg:col-span-4">
              <div className="text-xs text-muted-foreground">Description</div>
              <div className="whitespace-pre-wrap">{plan.data.description}</div>
            </div>
          )}
        </div>
      ) : null}

      <div className="mt-6 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Inspection & Test Plan rows</h2>
          <p className="text-xs text-muted-foreground">
            Add one row per activity — Hold / Witness / Review points guide inspector sign-off.
          </p>
        </div>
        <Button onClick={openNew} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Add row
        </Button>
      </div>

      <div className="mt-3 rounded-lg border bg-card overflow-x-auto">
        {rows.isLoading ? (
          <div className="p-4"><Skeleton className="h-24 w-full" /></div>
        ) : (rows.data?.length ?? 0) === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={<ListChecks className="h-6 w-6" />}
              title="No ITP rows yet"
              description="Add the first activity — e.g. 'Incoming raw material check'."
              action={<Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" />Add row</Button>}
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>Activity</TableHead>
                <TableHead>Procedure</TableHead>
                <TableHead>Check points</TableHead>
                <TableHead>Acceptance</TableHead>
                <TableHead>Verifying doc</TableHead>
                <TableHead>Inspected by</TableHead>
                <TableHead>Point</TableHead>
                <TableHead>Method</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.data!.map((r) => {
                const pt = POINT_TYPES.find((p) => p.value === r.point_type);
                const m = METHODS.find((x) => x.value === r.inspection_method);
                return (
                  <TableRow key={r.id}>
                    <TableCell>{r.sequence}</TableCell>
                    <TableCell className="max-w-[180px] truncate">{r.activity ?? "—"}</TableCell>
                    <TableCell className="max-w-[220px] truncate">{r.procedure ?? "—"}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{r.check_points ?? "—"}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{r.acceptance_criteria ?? "—"}</TableCell>
                    <TableCell className="max-w-[160px] truncate">{r.verifying_doc ?? "—"}</TableCell>
                    <TableCell>{r.inspected_by ?? "—"}</TableCell>
                    <TableCell>{pt ? <StatusPill tone={pt.tone}>{pt.label}</StatusPill> : "—"}</TableCell>
                    <TableCell>{m?.label ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(r)} title="Edit">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          if (confirm("Delete this ITP row?")) del.mutate(r.id);
                        }}
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={rowOpen} onOpenChange={setRowOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit ITP row" : "Add ITP row"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2 max-h-[65vh] overflow-y-auto pr-1">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Activity <span className="text-destructive">*</span></Label>
              <Input value={form.activity} onChange={(e) => setForm({ ...form, activity: e.target.value })} placeholder="e.g. Concrete pouring" />
              {formErr.activity && <p className="text-xs text-destructive">{formErr.activity}</p>}
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Procedure</Label>
              <Textarea rows={2} value={form.procedure} onChange={(e) => setForm({ ...form, procedure: e.target.value })} placeholder="Construction procedure to describe this activity" />
            </div>
            <div className="space-y-1.5">
              <Label>Inspection scope / Check points</Label>
              <Textarea rows={2} value={form.check_points} onChange={(e) => setForm({ ...form, check_points: e.target.value })} placeholder="What to inspect (features, dimensions, characteristics)" />
            </div>
            <div className="space-y-1.5">
              <Label>Acceptance criteria / tolerance <span className="text-destructive">*</span></Label>
              <Textarea rows={2} value={form.acceptance_criteria} onChange={(e) => setForm({ ...form, acceptance_criteria: e.target.value })} placeholder="e.g. ±0.1 mm, or Contract Spec section 4.2" />
              {formErr.acceptance_criteria && <p className="text-xs text-destructive">{formErr.acceptance_criteria}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Tools / equipment</Label>
              <Input value={form.tools} onChange={(e) => setForm({ ...form, tools: e.target.value })} placeholder="e.g. Caliper, CMM, UT probe" />
            </div>
            <div className="space-y-1.5">
              <Label>Inspection method</Label>
              <Select value={form.inspection_method || "__none"} onValueChange={(v) => setForm({ ...form, inspection_method: v === "__none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">—</SelectItem>
                  {METHODS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Point type</Label>
              <Select value={form.point_type || "__none"} onValueChange={(v) => setForm({ ...form, point_type: v === "__none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">—</SelectItem>
                  {POINT_TYPES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Hold blocks progression. Witness needs a witness present. Review is documentary.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Responsible role {form.point_type === "hold" && <span className="text-destructive">*</span>}</Label>
              <Input value={form.responsibility_role} onChange={(e) => setForm({ ...form, responsibility_role: e.target.value })} placeholder="e.g. quality_manager, client_representative" />
              {formErr.responsibility_role && <p className="text-xs text-destructive">{formErr.responsibility_role}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Inspected by (free text)</Label>
              <Input value={form.inspected_by} onChange={(e) => setForm({ ...form, inspected_by: e.target.value })} placeholder="Who inspects and when" />
            </div>
            <div className="space-y-1.5">
              <Label>Verifying document</Label>
              <Input value={form.verifying_doc} onChange={(e) => setForm({ ...form, verifying_doc: e.target.value })} placeholder="e.g. Checklist #, Test report" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Required documents</Label>
              <div className="flex gap-2">
                <Input
                  value={docInput}
                  onChange={(e) => setDocInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addDoc(); } }}
                  placeholder="Add a document name and press Enter (e.g. MTR, ITP, Calibration cert)"
                />
                <Button type="button" variant="outline" onClick={addDoc}>Add</Button>
              </div>
              {form.required_documents.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {form.required_documents.map((d) => (
                    <span key={d} className="inline-flex items-center gap-1 rounded-full border bg-muted px-2 py-0.5 text-xs">
                      {d}
                      <button type="button" onClick={() => removeDoc(d)} className="text-muted-foreground hover:text-destructive">×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-1.5 sm:col-span-2 flex items-center gap-2">
              <input
                id="row-critical"
                type="checkbox"
                checked={form.is_critical}
                onChange={(e) => setForm({ ...form, is_critical: e.target.checked })}
              />
              <Label htmlFor="row-critical" className="cursor-pointer">Critical characteristic (CCP)</Label>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Comments</Label>
              <Textarea rows={2} value={form.comments} onChange={(e) => setForm({ ...form, comments: e.target.value })} placeholder="Other requirements that need to be stated" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRowOpen(false)}>Cancel</Button>
            <Button onClick={onSaveClick} disabled={save.isPending}>
              {save.isPending ? "Saving..." : editing ? "Save" : "Add row"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MesPage>
  );
}

export const Route = createFileRoute("/inspection-plans/$id")({
  ssr: false,
  head: () => ({ meta: [{ title: "Inspection Plan — CORTA QC" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <AuthGate>
      <AppShell>
        <PlanDetail />
      </AppShell>
    </AuthGate>
  ),
});
