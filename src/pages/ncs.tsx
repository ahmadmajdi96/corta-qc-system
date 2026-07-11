import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DndContext, useDraggable, useDroppable, DragOverlay, type DragEndEvent } from "@dnd-kit/core";
import { Plus, Trash2 } from "lucide-react";
import { AddNcDialog } from "@/components/add-nc-dialog";
import { toast } from "sonner";
import { useConfirm } from "@/components/confirm-provider";
import { useMyRoles, hasAnyRole } from "@/lib/auth";

const NC_STATUSES = ["open", "under_investigation", "corrective_action_defined", "closed", "rejected"] as const;
const BOARD_COLS = ["open","under_investigation","corrective_action_defined","closed"] as const;

function NcCard({ nc }: { nc: any }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: nc.id, data: { nc } });
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} style={{ opacity: isDragging ? 0.4 : 1 }}
      className="block rounded bg-card border p-2 hover:shadow-sm text-xs cursor-grab active:cursor-grabbing">
      <div className="flex items-center justify-between">
        <Link to="/non-conformances/$id" params={{ id: nc.id }} className="font-mono hover:underline" onClick={e => e.stopPropagation()}>
          {nc.number}
        </Link>
        <StatusBadge status={nc.severity} kind="severity" />
      </div>
      <div className="mt-1 line-clamp-2">{nc.description}</div>
      {nc.inspections?.products?.name && <div className="text-muted-foreground mt-1">{nc.inspections.products.name}</div>}
    </div>
  );
}

function DropCol({ status, children, count }: { status: string; children: React.ReactNode; count: number }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div ref={setNodeRef} className={`rounded-lg bg-muted/40 p-3 min-h-40 transition-colors ${isOver ? "bg-primary/10 ring-2 ring-primary" : ""}`}>
      <div className="flex items-center justify-between mb-2">
        <StatusBadge status={status} kind="nc" />
        <span className="text-xs text-muted-foreground">{count}</span>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

export function NcBoardPage() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const { data: myRoles } = useMyRoles();
  const isAdmin = hasAnyRole(myRoles, "administrator");
  const [addOpen, setAddOpen] = useState(false);
  const [dragging, setDragging] = useState<any>(null);
  const [product, setProduct] = useState("all");
  const [severity, setSeverity] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const products = useQuery({ queryKey: ["nc-board-products"], queryFn: async () => (await supabase.from("products").select("id,name").order("name")).data ?? [] });
  const list = useQuery({
    queryKey: ["nc-board", product, severity, from, to],
    queryFn: async () => {
      let q = supabase.from("non_conformances")
        .select("id, number, severity, status, description, raised_at, inspection_id, inspections(products(id,name))")
        .order("raised_at", { ascending: false }).limit(500);
      if (severity !== "all") q = q.eq("severity", severity);
      if (from) q = q.gte("raised_at", from);
      if (to) q = q.lte("raised_at", to + "T23:59:59");
      const { data, error } = await q;
      if (error) throw error;
      let rows = (data ?? []) as any[];
      if (product !== "all") rows = rows.filter(r => r.inspections?.products?.id === product);
      return rows;
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("non_conformances").update({ status } as any).eq("id", id);
      if (error) throw error;
    },
    // Optimistic update with snap-back on failure
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: ["nc-board", product, severity, from, to] });
      const prev = qc.getQueryData<any[]>(["nc-board", product, severity, from, to]);
      qc.setQueryData<any[]>(["nc-board", product, severity, from, to], (old) => (old ?? []).map(n => n.id === id ? { ...n, status } : n));
      return { prev };
    },
    onError: (e: any, _v, ctx) => {
      qc.setQueryData(["nc-board", product, severity, from, to], ctx?.prev);
      toast.error(e.message ?? "Move failed — reverted");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["nc-board"] }),
  });

  const delNc = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("non_conformances").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("NC deleted"); qc.invalidateQueries({ queryKey: ["nc-board"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  async function handleDelete(nc: any) {
    const ok = await confirm({ title: `Delete ${nc.number}?`, description: "This cannot be undone.", variant: "destructive", confirmText: "Delete" });
    if (ok) delNc.mutate(nc.id);
  }

  function onDragEnd(e: DragEndEvent) {
    setDragging(null);
    const targetStatus = e.over?.id as string | undefined;
    const nc = e.active?.data.current?.nc;
    if (!nc || !targetStatus) return;
    if (nc.status === targetStatus) return;
    updateStatus.mutate({ id: nc.id, status: targetStatus });
  }

  return (
    <div className="max-w-full space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Non-Conformances</h1>
          <p className="text-sm text-muted-foreground">Drag cards between columns to change status</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setAddOpen(true)}><Plus className="h-4 w-4 mr-2" />Add NC</Button>
          <Button asChild variant="outline"><Link to="/non-conformances/list">Table view</Link></Button>
        </div>
      </div>

      <Card><CardContent className="pt-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Select value={product} onValueChange={setProduct}>
            <SelectTrigger><SelectValue placeholder="Product" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All products</SelectItem>
              {(products.data ?? []).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={severity} onValueChange={setSeverity}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All severities</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="major">Major</SelectItem>
              <SelectItem value="minor">Minor</SelectItem>
            </SelectContent>
          </Select>
          <Input type="date" value={from} onChange={e => setFrom(e.target.value)} />
          <Input type="date" value={to} onChange={e => setTo(e.target.value)} />
        </div>
      </CardContent></Card>

      {list.isError ? <ErrorState onRetry={() => list.refetch()} /> :
       <DndContext onDragStart={(e) => setDragging(e.active.data.current?.nc)} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
         <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
           {BOARD_COLS.map((s) => {
             const rows = (list.data ?? []).filter((n: any) => n.status === s);
             return (
               <DropCol key={s} status={s} count={rows.length}>
                 {list.isLoading ? <Skeleton className="h-24" /> :
                  rows.length === 0 ? <div className="text-xs text-muted-foreground py-2">Empty</div> :
                  rows.map((n: any) => (
                    <div key={n.id} className="group relative">
                      <NcCard nc={n} />
                      {isAdmin && (
                        <button onClick={() => handleDelete(n)} className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 text-destructive p-1">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  ))}
               </DropCol>
             );
           })}
         </div>
         <DragOverlay>{dragging ? <NcCard nc={dragging} /> : null}</DragOverlay>
       </DndContext>
      }

      <AddNcDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}

const PAGE_SIZE = 25;

export function NcListPage() {
  const [status, setStatus] = useState("all");
  const [severity, setSeverity] = useState("all");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(0);

  useEffect(() => { const t = setTimeout(() => { setDebounced(search); setPage(0); }, 300); return () => clearTimeout(t); }, [search]);

  const list = useQuery({
    queryKey: ["ncs", status, severity, debounced, page],
    queryFn: async () => {
      let q = supabase.from("non_conformances")
        .select("*, inspections(products(name))", { count: "exact" })
        .order("raised_at", { ascending: false });
      if (status !== "all") q = q.eq("status", status);
      if (severity !== "all") q = q.eq("severity", severity);
      if (debounced) q = q.or(`number.ilike.%${debounced}%,description.ilike.%${debounced}%`);
      q = q.range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: (data ?? []) as any[], count: count ?? 0 };
    },
  });
  const totalPages = Math.max(1, Math.ceil((list.data?.count ?? 0) / PAGE_SIZE));

  return (
    <div className="max-w-7xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Non-Conformances</h1>
          <p className="text-sm text-muted-foreground">Table view</p>
        </div>
        <Button asChild variant="outline"><Link to="/non-conformances">Board view</Link></Button>
      </div>

      <Card><CardContent className="pt-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {NC_STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replaceAll("_"," ")}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={severity} onValueChange={setSeverity}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All severities</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="major">Major</SelectItem>
              <SelectItem value="minor">Minor</SelectItem>
            </SelectContent>
          </Select>
          <Input placeholder="Search number or description" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </CardContent></Card>

      <div className="rounded-lg border bg-card">
        {list.isError ? <ErrorState onRetry={() => list.refetch()} /> :
         list.isLoading ? <div className="p-6"><Skeleton className="h-32" /></div> :
         !list.data?.rows.length ? <EmptyState title="No NCs match" /> :
         <>
         <Table>
           <TableHeader>
             <TableRow>
               <TableHead>Number</TableHead>
               <TableHead>Product</TableHead>
               <TableHead>Severity</TableHead>
               <TableHead>Status</TableHead>
               <TableHead>Raised</TableHead>
             </TableRow>
           </TableHeader>
           <TableBody>
             {list.data.rows.map((n) => (
               <TableRow key={n.id} className="cursor-pointer" onClick={() => (window.location.href = `/non-conformances/${n.id}`)}>
                 <TableCell className="font-mono">{n.number}</TableCell>
                 <TableCell>{n.inspections?.products?.name ?? "—"}</TableCell>
                 <TableCell><StatusBadge status={n.severity} kind="severity" /></TableCell>
                 <TableCell><StatusBadge status={n.status} kind="nc" /></TableCell>
                 <TableCell>{new Date(n.raised_at).toLocaleDateString()}</TableCell>
               </TableRow>
             ))}
           </TableBody>
         </Table>
         <div className="flex items-center justify-between px-4 py-3 border-t text-sm text-muted-foreground">
           <div>{list.data.count} records</div>
           <div className="flex gap-2">
             <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Prev</Button>
             <div className="px-2 py-1">Page {page + 1} of {totalPages}</div>
             <Button variant="outline" size="sm" disabled={page + 1 >= totalPages} onClick={() => setPage(page + 1)}>Next</Button>
           </div>
         </div>
         </>
        }
      </div>
    </div>
  );
}
