import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Pencil, Save, X, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useMyRoles, hasAnyRole, useSession } from "@/lib/auth";
import { NewInspectionDialog } from "@/components/new-inspection-dialog";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

export function ProductDetailPage({ id }: { id: string }) {
  const { user } = useSession();
  const { data: roles } = useMyRoles();
  const canManage = hasAnyRole(roles, "administrator", "quality_manager");
  const isAdmin = hasAnyRole(roles, "administrator");
  const qc = useQueryClient();
  const [editMode, setEditMode] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const product = useQuery({
    queryKey: ["product", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*, product_categories(name)").eq("id", id).maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Product not found");
      return data;
    },
  });

  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: async () => (await supabase.from("product_categories").select("id, name").order("name")).data ?? [],
  });

  const [form, setForm] = useState<any>(null);
  function startEdit() {
    setForm({ ...product.data });
    setEditMode(true);
  }

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("products").update({
        name: form.name,
        description: form.description,
        category_id: form.category_id,
        is_active: form.is_active,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Product updated");
      setEditMode(false);
      qc.invalidateQueries({ queryKey: ["product", id] });
      qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const specs = useQuery({
    queryKey: ["product-specs", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quality_specifications")
        .select("*, profiles!quality_specifications_created_by_fkey(full_name), specification_items(id)")
        .eq("product_id", id)
        .order("version", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const history = useQuery({
    queryKey: ["product-history", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inspections")
        .select("id, status, scheduled_date, lot_number, performed_by, profiles!inspections_performed_by_fkey(full_name), inspection_measurements(is_pass)")
        .eq("product_id", id)
        .order("scheduled_date", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  const [specDialogOpen, setSpecDialogOpen] = useState(false);
  const activeSpec = specs.data?.find((s: any) => s.is_active);

  if (product.isLoading) return <div className="space-y-3 max-w-5xl"><Skeleton className="h-8 w-64" /><Skeleton className="h-32" /></div>;
  if (product.error) return <div className="text-destructive">Failed to load product.</div>;
  const p = product.data!;

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <Link to="/products" className="text-sm text-muted-foreground hover:underline inline-flex items-center gap-1"><ArrowLeft className="h-4 w-4" />Back to products</Link>
        <div className="flex items-center justify-between mt-2">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{p.name}</h1>
            <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
              <span className="font-mono">{p.sku}</span>
              <Badge variant={p.is_active ? "default" : "secondary"}>{p.is_active ? "Active" : "Inactive"}</Badge>
            </div>
          </div>
          <Button variant="outline" onClick={() => setShowNew(true)}><Plus className="h-4 w-4 mr-2" />Start Inspection</Button>
        </div>
      </div>

      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">Product Info</TabsTrigger>
          <TabsTrigger value="specs">Specifications</TabsTrigger>
          <TabsTrigger value="history">Inspection History</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Product Information</CardTitle>
              {canManage && !editMode && <Button size="sm" variant="outline" onClick={startEdit}><Pencil className="h-4 w-4 mr-2" />Edit</Button>}
              {editMode && (
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setEditMode(false)}><X className="h-4 w-4 mr-1" />Cancel</Button>
                  <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}><Save className="h-4 w-4 mr-1" />Save</Button>
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {editMode ? (
                <>
                  <div><Label>SKU</Label><Input disabled value={form.sku} /></div>
                  <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                  <div><Label>Description</Label><Textarea value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} /></div>
                  <div><Label>Category</Label>
                    <Select value={form.category_id ?? "none"} onValueChange={(v) => setForm({ ...form, category_id: v === "none" ? null : v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— None —</SelectItem>
                        {categories.data?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between"><Label>Active</Label>
                    <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                  </div>
                </>
              ) : (
                <>
                  <Row label="SKU" value={p.sku} mono />
                  <Row label="Name" value={p.name} />
                  <Row label="Description" value={p.description || "—"} />
                  <Row label="Category" value={p.product_categories?.name ?? "—"} />
                  <Row label="Created" value={new Date(p.created_at).toLocaleString()} />
                </>
              )}
            </CardContent>
          </Card>

          {activeSpec && (
            <Card className="mt-4">
              <CardHeader><CardTitle className="text-base">Current Active Specification</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div>Version <b>{activeSpec.version}</b></div>
                <div className="text-muted-foreground">Items: {activeSpec.specification_items?.length ?? 0}</div>
                <div className="text-muted-foreground">Effective from: {activeSpec.effective_date ?? "—"}</div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="specs" className="mt-4">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm text-muted-foreground">All specification versions for this product</div>
            {canManage && <Button size="sm" onClick={() => setSpecDialogOpen(true)}><Plus className="h-4 w-4 mr-2" />New Version</Button>}
          </div>
          {specs.isLoading ? <Skeleton className="h-32" /> :
           !specs.data?.length ? <EmptyState title="No specifications yet" action={canManage ? <Button onClick={() => setSpecDialogOpen(true)}><Plus className="h-4 w-4 mr-2" />Create first version</Button> : undefined} /> :
           <div className="space-y-3">
              {specs.data.map((s: any) => (
                <SpecCard key={s.id} spec={s} canManage={canManage} onChanged={() => qc.invalidateQueries({ queryKey: ["product-specs", id] })} />
              ))}
           </div>}

          <SpecEditorDialog open={specDialogOpen} onOpenChange={setSpecDialogOpen} productId={id} userId={user?.id!} nextVersion={(specs.data?.[0]?.version ?? 0) + 1} onCreated={() => qc.invalidateQueries({ queryKey: ["product-specs", id] })} />
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          {history.isLoading ? <Skeleton className="h-32" /> :
           !history.data?.length ? <EmptyState title="No inspections yet" /> :
           <div className="rounded-lg border bg-card divide-y">
             {history.data.map((i: any) => {
                const total = i.inspection_measurements?.length ?? 0;
                const evaluated = (i.inspection_measurements ?? []).filter((m: any) => m.is_pass !== null);
                const passRate = evaluated.length ? Math.round((evaluated.filter((m: any) => m.is_pass).length / evaluated.length) * 100) : null;
                return (
                  <Link key={i.id} to="/inspections/$id" params={{ id: i.id }} className="flex items-center justify-between p-4 hover:bg-accent/40">
                    <div>
                      <div className="text-sm font-medium">{i.scheduled_date} {i.lot_number ? `· Lot ${i.lot_number}` : ""}</div>
                      <div className="text-xs text-muted-foreground">{i.profiles?.full_name ?? "Unassigned"} · {total} measurement{total !== 1 && "s"}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      {passRate !== null && <div className="text-xs">Pass {passRate}%</div>}
                      <StatusBadge status={i.status} kind="inspection" />
                    </div>
                  </Link>
                );
             })}
           </div>}
        </TabsContent>
      </Tabs>

      <NewInspectionDialog open={showNew} onOpenChange={setShowNew} defaultProductId={id} />
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="grid grid-cols-3 gap-4 text-sm">
      <div className="text-muted-foreground">{label}</div>
      <div className={`col-span-2 ${mono ? "font-mono" : ""}`}>{value}</div>
    </div>
  );
}

function SpecCard({ spec, canManage, onChanged }: { spec: any; canManage: boolean; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const items = useQuery({
    queryKey: ["spec-items", spec.id],
    enabled: open,
    queryFn: async () => (await supabase.from("specification_items").select("*").eq("spec_id", spec.id).order("sequence")).data ?? [],
  });
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-sm">Version {spec.version} {spec.is_active && <Badge className="ml-2">Active</Badge>}</CardTitle>
          <div className="text-xs text-muted-foreground mt-1">
            {spec.specification_items?.length ?? 0} items · created {new Date(spec.created_at).toLocaleDateString()} by {spec.profiles?.full_name ?? "unknown"}
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setOpen(!open)}>{open ? "Hide" : "View full spec"}</Button>
          {canManage && spec.is_active && (
            <Button size="sm" variant="ghost" onClick={async () => {
              const { error } = await supabase.from("quality_specifications").update({ is_active: false }).eq("id", spec.id);
              if (error) toast.error(error.message); else { toast.success("Deactivated"); onChanged(); }
            }}>Deactivate</Button>
          )}
        </div>
      </CardHeader>
      {open && (
        <CardContent>
          {items.isLoading ? <Skeleton className="h-24" /> :
           !items.data?.length ? <div className="text-sm text-muted-foreground">No items</div> :
           <ul className="text-sm divide-y">
             {items.data.map((it: any) => (
               <li key={it.id} className="py-2 grid grid-cols-6 gap-2">
                 <div className="col-span-2 font-medium">{it.sequence}. {it.name} {it.is_critical && <Badge variant="destructive" className="ml-1">CCP</Badge>}</div>
                 <div>{it.measurement_type}</div>
                 <div>{it.target_value ?? "—"}{it.unit ?? ""}</div>
                 <div>{it.lower_tolerance ?? "—"} / {it.upper_tolerance ?? "—"}</div>
                 <div className="text-muted-foreground text-xs truncate">{it.pass_criteria ?? ""}</div>
               </li>
             ))}
           </ul>}
        </CardContent>
      )}
    </Card>
  );
}

function SpecEditorDialog({ open, onOpenChange, productId, userId, nextVersion, onCreated }: {
  open: boolean; onOpenChange: (v: boolean) => void; productId: string; userId: string;
  nextVersion: number; onCreated: () => void;
}) {
  const [items, setItems] = useState<any[]>([
    { sequence: 1, name: "", measurement_type: "numeric", unit: "", target_value: "", lower_tolerance: "", upper_tolerance: "", pass_criteria: "", is_critical: false },
  ]);
  const [effectiveDate, setEffectiveDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  async function save() {
    if (items.some((i) => !i.name.trim())) { toast.error("Each item needs a name"); return; }
    setSaving(true);
    try {
      // Deactivate current
      await supabase.from("quality_specifications").update({ is_active: false }).eq("product_id", productId).eq("is_active", true);
      const { data: spec, error } = await supabase.from("quality_specifications").insert({
        product_id: productId, version: nextVersion, is_active: true, created_by: userId, effective_date: effectiveDate,
      }).select("id").single();
      if (error) throw error;
      const rows = items.map((it, idx) => ({
        spec_id: spec.id, sequence: idx + 1, name: it.name, measurement_type: it.measurement_type,
        unit: it.unit || null,
        target_value: it.target_value === "" ? null : Number(it.target_value),
        lower_tolerance: it.lower_tolerance === "" ? null : Number(it.lower_tolerance),
        upper_tolerance: it.upper_tolerance === "" ? null : Number(it.upper_tolerance),
        pass_criteria: it.pass_criteria || null, is_critical: it.is_critical,
      }));
      const { error: itemsErr } = await supabase.from("specification_items").insert(rows);
      if (itemsErr) throw itemsErr;
      toast.success(`Version ${nextVersion} created`);
      onCreated();
      onOpenChange(false);
      setItems([{ sequence: 1, name: "", measurement_type: "numeric", unit: "", target_value: "", lower_tolerance: "", upper_tolerance: "", pass_criteria: "", is_critical: false }]);
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>New Specification — Version {nextVersion}</DialogTitle></DialogHeader>
        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          <div className="w-64"><Label>Effective date</Label><Input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} /></div>
          <div className="space-y-3">
            {items.map((it, idx) => (
              <div key={idx} className="border rounded-md p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="text-xs text-muted-foreground w-8">#{idx + 1}</div>
                  <Input placeholder="Item name (e.g. Core temperature)" value={it.name} onChange={(e) => setItems(items.map((x, i) => i === idx ? { ...x, name: e.target.value } : x))} />
                  <Button size="icon" variant="ghost" onClick={() => setItems(items.filter((_, i) => i !== idx))} disabled={items.length === 1}><Trash2 className="h-4 w-4" /></Button>
                </div>
                <div className="grid grid-cols-5 gap-2">
                  <Select value={it.measurement_type} onValueChange={(v) => setItems(items.map((x, i) => i === idx ? { ...x, measurement_type: v } : x))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="numeric">Numeric</SelectItem>
                      <SelectItem value="boolean">Boolean</SelectItem>
                      <SelectItem value="text">Text</SelectItem>
                      <SelectItem value="visual">Visual</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input placeholder="Unit" value={it.unit} onChange={(e) => setItems(items.map((x, i) => i === idx ? { ...x, unit: e.target.value } : x))} />
                  <Input placeholder="Target" value={it.target_value} onChange={(e) => setItems(items.map((x, i) => i === idx ? { ...x, target_value: e.target.value } : x))} />
                  <Input placeholder="Lower" value={it.lower_tolerance} onChange={(e) => setItems(items.map((x, i) => i === idx ? { ...x, lower_tolerance: e.target.value } : x))} />
                  <Input placeholder="Upper" value={it.upper_tolerance} onChange={(e) => setItems(items.map((x, i) => i === idx ? { ...x, upper_tolerance: e.target.value } : x))} />
                </div>
                <Textarea placeholder="Pass criteria (for qualitative)" rows={2} value={it.pass_criteria} onChange={(e) => setItems(items.map((x, i) => i === idx ? { ...x, pass_criteria: e.target.value } : x))} />
                <div className="flex items-center gap-2 text-sm">
                  <Switch checked={it.is_critical} onCheckedChange={(v) => setItems(items.map((x, i) => i === idx ? { ...x, is_critical: v } : x))} />
                  <span>Critical (CCP)</span>
                </div>
              </div>
            ))}
            <Button variant="outline" onClick={() => setItems([...items, { sequence: items.length + 1, name: "", measurement_type: "numeric", unit: "", target_value: "", lower_tolerance: "", upper_tolerance: "", pass_criteria: "", is_critical: false }])}>
              <Plus className="h-4 w-4 mr-2" />Add item
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Create version"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
