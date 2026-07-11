import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const NC_STATUSES = ["open", "under_investigation", "corrective_action_defined", "closed", "rejected"] as const;

export function NcBoardPage() {
  const list = useQuery({
    queryKey: ["nc-board"],
    queryFn: async () => (await supabase.from("non_conformances")
      .select("id, number, severity, status, description, raised_at, inspections(products(name))")
      .order("raised_at", { ascending: false }).limit(200)).data ?? [],
  });
  return (
    <div className="max-w-full space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Non-Conformances</h1>
          <p className="text-sm text-muted-foreground">Kanban board by status</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline"><Link to="/non-conformances/list">Table view</Link></Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        {NC_STATUSES.map((s) => {
          const rows = (list.data ?? []).filter((n: any) => n.status === s);
          return (
            <div key={s} className="rounded-lg bg-muted/40 p-3 min-h-40">
              <div className="flex items-center justify-between mb-2">
                <StatusBadge status={s} kind="nc" />
                <span className="text-xs text-muted-foreground">{rows.length}</span>
              </div>
              <div className="space-y-2">
                {list.isLoading ? <Skeleton className="h-24" /> :
                 rows.map((n: any) => (
                  <Link key={n.id} to="/non-conformances/$id" params={{ id: n.id }} className="block rounded bg-card border p-2 hover:shadow-sm text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-mono">{n.number}</span>
                      <StatusBadge status={n.severity} kind="severity" />
                    </div>
                    <div className="mt-1 line-clamp-2">{n.description}</div>
                    <div className="text-muted-foreground mt-1">{n.inspections?.products?.name}</div>
                  </Link>
                 ))}
              </div>
            </div>
          );
        })}
      </div>
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
        .select("*, inspections(products(name)), profiles!non_conformances_raised_by_profile_fkey(full_name)", { count: "exact" })
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
        {list.isLoading ? <div className="p-6"><Skeleton className="h-32" /></div> :
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
               <TableHead>By</TableHead>
             </TableRow>
           </TableHeader>
           <TableBody>
             {list.data.rows.map((n) => (
               <TableRow key={n.id} className="cursor-pointer" onClick={() => (window.location.href = `/non-conformances/${n.id}`)}>
                 <TableCell className="font-mono">{n.number}</TableCell>
                 <TableCell>{n.inspections?.products?.name}</TableCell>
                 <TableCell><StatusBadge status={n.severity} kind="severity" /></TableCell>
                 <TableCell><StatusBadge status={n.status} kind="nc" /></TableCell>
                 <TableCell>{new Date(n.raised_at).toLocaleDateString()}</TableCell>
                 <TableCell>{n.profiles?.full_name ?? "—"}</TableCell>
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
