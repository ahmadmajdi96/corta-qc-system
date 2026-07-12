import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Loader2, ArrowUp, ArrowDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/lib/auth";
import { notifyError, notifySuccess } from "@/lib/toast";

type Step = { station_id: string; notes: string };

export function NewProductRequestDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: (id: string) => void;
}) {
  const { user } = useSession();
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [steps, setSteps] = useState<Step[]>([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) {
      setSku(""); setName(""); setDescription(""); setCategoryId("");
      setAssigneeId(""); setSteps([]); setErr({});
    }
  }, [open]);

  const stations = useQuery({
    queryKey: ["stations-active"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stations")
        .select("id, code, name, sequence, station_type, line_id, production_lines(name)")
        .eq("is_active", true)
        .order("sequence", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const categories = useQuery({
    queryKey: ["product-categories"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase.from("product_categories").select("id, name").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const qcAssignees = useQuery({
    queryKey: ["qc-assignees"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("user_id, roles!inner(name), profiles!inner(id, full_name, email)")
        .in("roles.name", ["quality_manager", "qc_engineer", "administrator"]);
      if (error) throw error;
      const map = new Map<string, { id: string; label: string }>();
      for (const r of (data ?? []) as any[]) {
        const p = r.profiles;
        if (p?.id && !map.has(p.id)) map.set(p.id, { id: p.id, label: p.full_name || p.email || p.id });
      }
      return [...map.values()];
    },
  });

  const addStep = () => setSteps((s) => [...s, { station_id: "", notes: "" }]);
  const removeStep = (i: number) => setSteps((s) => s.filter((_, idx) => idx !== i));
  const moveStep = (i: number, dir: -1 | 1) => setSteps((s) => {
    const next = [...s]; const j = i + dir;
    if (j < 0 || j >= next.length) return s;
    [next[i], next[j]] = [next[j], next[i]]; return next;
  });
  const setStep = (i: number, patch: Partial<Step>) => setSteps((s) => s.map((st, idx) => idx === i ? { ...st, ...patch } : st));

  const submit = async () => {
    const errs: Record<string, string> = {};
    if (!sku.trim()) errs.sku = "SKU is required";
    if (!name.trim()) errs.name = "Product name is required";
    if (steps.length === 0) errs.steps = "Add at least one production step";
    steps.forEach((s, i) => { if (!s.station_id) errs[`step-${i}`] = "Station required"; });
    setErr(errs);
    if (Object.keys(errs).length > 0 || !user) return;
    setSaving(true);
    try {
      const payload = {
        product: { sku: sku.trim(), name: name.trim(), description: description.trim() || null, category_id: categoryId || null },
        steps: steps.map((s, i) => ({ sequence: i + 1, station_id: s.station_id, notes: s.notes || null })),
      };
      const { data, error } = await supabase
        .from("requests")
        .insert({
          kind: "new_product",
          title: `New product: ${name.trim()} (${sku.trim()})`,
          description: description.trim() || null,
          requester_id: user.id,
          assignee_id: assigneeId || null,
          payload,
        })
        .select("id")
        .single();
      if (error) throw error;
      await supabase.from("request_events").insert({
        request_id: data.id, actor_id: user.id, event_type: "created", to_status: "pending",
      });
      notifySuccess("Request submitted");
      onCreated?.(data.id);
    } catch (e) {
      notifyError(e, { fallback: "Failed to submit request" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>New Product Request</DialogTitle>
          <DialogDescription>
            Submit a new product to QC. Define the production steps by picking stations from the MES system in the order they should be executed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>SKU *</Label>
              <Input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="SKU-001" />
              {err.sku && <p className="mt-1 text-xs text-destructive">{err.sku}</p>}
            </div>
            <div>
              <Label>Product name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Widget A" />
              {err.name && <p className="mt-1 text-xs text-destructive">{err.name}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Category</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger><SelectValue placeholder={categories.isLoading ? "Loading…" : "Select category"} /></SelectTrigger>
                <SelectContent>
                  {(categories.data ?? []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Assign to (QC)</Label>
              <Select value={assigneeId} onValueChange={setAssigneeId}>
                <SelectTrigger><SelectValue placeholder={qcAssignees.isLoading ? "Loading…" : "Auto-assign"} /></SelectTrigger>
                <SelectContent>
                  {(qcAssignees.data ?? []).map((u) => <SelectItem key={u.id} value={u.id}>{u.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Purpose, target line, expected volume…" />
          </div>

          <div className="rounded-xl border p-3">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Production steps</div>
                <div className="text-xs text-muted-foreground">Stations from the MES system, in order.</div>
              </div>
              <Button type="button" size="sm" variant="outline" onClick={addStep} className="gap-2">
                <Plus className="h-4 w-4" /> Add step
              </Button>
            </div>
            {err.steps && <p className="mb-2 text-xs text-destructive">{err.steps}</p>}
            {stations.isLoading ? (
              <div className="flex items-center gap-2 py-4 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Loading MES stations…</div>
            ) : steps.length === 0 ? (
              <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">No steps yet.</div>
            ) : (
              <ol className="space-y-2">
                {steps.map((s, i) => (
                  <li key={i} className="grid grid-cols-[auto_1fr_1fr_auto] items-center gap-2 rounded-lg bg-muted/30 p-2">
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{i + 1}</span>
                    <div>
                      <Select value={s.station_id} onValueChange={(v) => setStep(i, { station_id: v })}>
                        <SelectTrigger><SelectValue placeholder="Pick station" /></SelectTrigger>
                        <SelectContent>
                          {(stations.data ?? []).map((st: any) => (
                            <SelectItem key={st.id} value={st.id}>
                              {(st.code ? `${st.code} · ` : "") + st.name}{st.production_lines?.name ? ` — ${st.production_lines.name}` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {err[`step-${i}`] && <p className="mt-1 text-xs text-destructive">{err[`step-${i}`]}</p>}
                    </div>
                    <Input value={s.notes} onChange={(e) => setStep(i, { notes: e.target.value })} placeholder="Notes / QC checks" />
                    <div className="flex gap-1">
                      <Button type="button" size="icon" variant="ghost" onClick={() => moveStep(i, -1)} disabled={i === 0}><ArrowUp className="h-4 w-4" /></Button>
                      <Button type="button" size="icon" variant="ghost" onClick={() => moveStep(i, 1)} disabled={i === steps.length - 1}><ArrowDown className="h-4 w-4" /></Button>
                      <Button type="button" size="icon" variant="ghost" onClick={() => removeStep(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={submit} disabled={saving} className="gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Submit request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
