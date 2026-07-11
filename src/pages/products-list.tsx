import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Search, Pencil, Power } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { z } from "zod";
import { useMyRoles, hasAnyRole } from "@/lib/auth";
import { EmptyState } from "@/components/empty-state";

const PAGE_SIZE = 20;

const productSchema = z.object({
  sku: z.string().trim().min(1, "SKU is required").max(50),
  name: z.string().trim().min(1, "Name is required").max(200),
  description: z.string().max(2000).optional(),
  category_id: z.string().uuid().nullable().optional(),
  is_active: z.boolean(),
});
type ProductForm = z.infer<typeof productSchema>;

export function ProductsListPage() {
  const { data: roles } = useMyRoles();
  const canManage = hasAnyRole(roles, "administrator", "quality_manager");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [page, setPage] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deactivate, setDeactivate] = useState<any>(null);
  const qc = useQueryClient();

  useEffect(() => {
    const t = setTimeout(() => { setDebounced(search); setPage(0); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const cats = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("product_categories").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  const list = useQuery({
    queryKey: ["products", debounced, category, page],
    queryFn: async () => {
      let q = supabase.from("products").select("*, product_categories(name)", { count: "exact" }).order("created_at", { ascending: false });
      if (debounced) q = q.or(`name.ilike.%${debounced}%,sku.ilike.%${debounced}%`);
      if (category !== "all") q = q.eq("category_id", category);
      q = q.range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: data ?? [], count: count ?? 0 };
    },
  });

  const upsert = useMutation({
    mutationFn: async (v: ProductForm & { id?: string }) => {
      const parsed = productSchema.parse(v);
      if (v.id) {
        const { error } = await supabase.from("products").update(parsed).eq("id", v.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("products").insert(parsed);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Product updated" : "Product created");
      setDialogOpen(false); setEditing(null);
      qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e: Error) => toast.error(e.message.includes("duplicate") ? "SKU already exists" : e.message),
  });

  const setActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("products").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Updated"); qc.invalidateQueries({ queryKey: ["products"] }); setDeactivate(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  const totalPages = Math.max(1, Math.ceil((list.data?.count ?? 0) / PAGE_SIZE));

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Products</h1>
          <p className="text-sm text-muted-foreground">Manage product catalogue and specifications</p>
        </div>
        {canManage && (
          <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />Add Product
          </Button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name or SKU..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={category} onValueChange={(v) => { setCategory(v); setPage(0); }}>
          <SelectTrigger className="w-56"><SelectValue placeholder="All categories" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {cats.data?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border bg-card">
        {list.isLoading ? (
          <div className="p-6 space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
        ) : list.error ? (
          <div className="p-6 text-sm text-destructive">Failed to load. <button className="underline" onClick={() => list.refetch()}>Retry</button></div>
        ) : !list.data?.rows.length ? (
          <EmptyState title="No products found" description={debounced ? "Try a different search." : undefined}
            action={canManage ? <Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-2" />Add your first product</Button> : undefined} />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Active</TableHead>
                  {canManage && <TableHead className="w-32">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.data.rows.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell><Link to="/products/$id" params={{ id: p.id }} className="text-primary hover:underline font-mono text-sm">{p.sku}</Link></TableCell>
                    <TableCell><Link to="/products/$id" params={{ id: p.id }} className="hover:underline">{p.name}</Link></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.product_categories?.name ?? "—"}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${p.is_active ? "bg-status-completed/15 text-status-completed" : "bg-muted text-muted-foreground"}`}>
                        {p.is_active ? "Active" : "Inactive"}
                      </span>
                    </TableCell>
                    {canManage && (
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => { setEditing(p); setDialogOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => setDeactivate(p)}><Power className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex items-center justify-between px-4 py-3 border-t text-sm text-muted-foreground">
              <div>{list.data.count} product{list.data.count !== 1 && "s"}</div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Prev</Button>
                <div className="px-2 py-1">Page {page + 1} of {totalPages}</div>
                <Button variant="outline" size="sm" disabled={page + 1 >= totalPages} onClick={() => setPage(page + 1)}>Next</Button>
              </div>
            </div>
          </>
        )}
      </div>

      <ProductDialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(null); }}
        initial={editing} categories={cats.data ?? []} onSubmit={(v) => upsert.mutate({ ...v, id: editing?.id })} pending={upsert.isPending} />

      <AlertDialog open={!!deactivate} onOpenChange={(o) => !o && setDeactivate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm {deactivate?.is_active ? "deactivate" : "activate"}</AlertDialogTitle>
            <AlertDialogDescription>
              {deactivate?.is_active ? "Deactivated products won't appear when creating inspections." : "Activate this product?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => setActive.mutate({ id: deactivate.id, is_active: !deactivate.is_active })}>
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ProductDialog({ open, onOpenChange, initial, categories, onSubmit, pending }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: any;
  categories: { id: string; name: string }[];
  onSubmit: (v: ProductForm) => void;
  pending: boolean;
}) {
  const [form, setForm] = useState<ProductForm>({ sku: "", name: "", description: "", category_id: null, is_active: true });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setForm({
        sku: initial?.sku ?? "",
        name: initial?.name ?? "",
        description: initial?.description ?? "",
        category_id: initial?.category_id ?? null,
        is_active: initial?.is_active ?? true,
      });
      setErrors({});
    }
  }, [open, initial]);

  function submit() {
    const parsed = productSchema.safeParse(form);
    if (!parsed.success) {
      const e: Record<string, string> = {};
      for (const iss of parsed.error.issues) e[iss.path[0] as string] = iss.message;
      setErrors(e);
      return;
    }
    onSubmit(parsed.data);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{initial ? "Edit Product" : "Add Product"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>SKU *</Label>
            <Input value={form.sku} onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))} />
            {errors.sku && <p className="text-xs text-destructive">{errors.sku}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Name *</Label>
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea value={form.description ?? ""} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={3} />
          </div>
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={form.category_id ?? "none"} onValueChange={(v) => setForm((f) => ({ ...f, category_id: v === "none" ? null : v }))}>
              <SelectTrigger><SelectValue placeholder="Choose category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— None —</SelectItem>
                {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between">
            <Label>Active</Label>
            <Switch checked={form.is_active} onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={pending}>{pending ? "Saving..." : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
