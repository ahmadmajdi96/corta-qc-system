import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { useMyRoles, hasAnyRole, useSession } from "@/lib/auth";
import { Label } from "@/components/ui/label";

const PAGE_SIZE = 25;

export function CaListPage() {
  const { user } = useSession();
  const { data: roles } = useMyRoles();
  const [tab, setTab] = useState<"mine" | "all">("mine");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(0);

  const list = useQuery({
    queryKey: ["cas", tab, status, page, user?.id],
    enabled: !!user,
    queryFn: async () => {
      let q = supabase.from("corrective_actions")
        .select("*, non_conformances(number, inspections(products(name))), profiles!corrective_actions_assigned_to_profile_fkey(full_name)", { count: "exact" })
        .order("due_date", { ascending: true, nullsFirst: false });
      if (tab === "mine") q = q.eq("assigned_to", user!.id);
      if (status !== "all") q = q.eq("status", status);
      q = q.range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: (data ?? []) as any[], count: count ?? 0 };
    },
  });

  const totalPages = Math.max(1, Math.ceil((list.data?.count ?? 0) / PAGE_SIZE));

  return (
    <div className="max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Corrective Actions</h1>
        <p className="text-sm text-muted-foreground">CAPA workflow — track resolution of NCs</p>
      </div>
      <Tabs value={tab} onValueChange={(v) => { setTab(v as any); setPage(0); }}>
        <TabsList>
          <TabsTrigger value="mine">My Actions</TabsTrigger>
          <TabsTrigger value="all">All Actions</TabsTrigger>
        </TabsList>
      </Tabs>
      <Card><CardContent className="pt-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="verified">Verified</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent></Card>

      <div className="rounded-lg border bg-card">
        {list.isLoading ? <div className="p-6"><Skeleton className="h-32" /></div> :
         !list.data?.rows.length ? <EmptyState title="No corrective actions" /> :
         <>
         <Table>
           <TableHeader><TableRow>
             <TableHead>NC</TableHead><TableHead>Description</TableHead>
             <TableHead>Assigned</TableHead><TableHead>Due</TableHead><TableHead>Status</TableHead>
           </TableRow></TableHeader>
           <TableBody>
             {list.data.rows.map((c) => (
               <TableRow key={c.id} className="cursor-pointer" onClick={() => (window.location.href = `/corrective-actions/${c.id}`)}>
                 <TableCell className="font-mono text-xs">{c.non_conformances?.number}</TableCell>
                 <TableCell className="max-w-md truncate">{c.description}</TableCell>
                 <TableCell>{c.profiles?.full_name ?? "—"}</TableCell>
                 <TableCell>{c.due_date ?? "—"}</TableCell>
                 <TableCell><StatusBadge status={c.status} kind="ca" /></TableCell>
               </TableRow>
             ))}
           </TableBody>
         </Table>
         <div className="flex items-center justify-between px-4 py-3 border-t text-sm text-muted-foreground">
           <div>{list.data.count} actions</div>
           <div className="flex gap-2">
             <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Prev</Button>
             <div className="px-2 py-1">Page {page + 1} of {totalPages}</div>
             <Button variant="outline" size="sm" disabled={page + 1 >= totalPages} onClick={() => setPage(page + 1)}>Next</Button>
           </div>
         </div>
         </>}
      </div>
    </div>
  );
}

export function CaDetailPage({ id }: { id: string }) {
  const { user } = useSession();
  const { data: roles } = useMyRoles();
  const canVerify = hasAnyRole(roles, "administrator", "quality_manager", "auditor");
  const qc = useQueryClient();

  const ca = useQuery({
    queryKey: ["ca", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("corrective_actions")
        .select(`*, non_conformances(id, number),
                 profiles!corrective_actions_assigned_to_profile_fkey(full_name),
                 verifier:profiles!corrective_actions_verified_by_profile_fkey(full_name)`)
        .eq("id", id).maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Not found");
      return data as any;
    },
  });

  const [desc, setDesc] = useState("");
  const [due, setDue] = useState("");
  useEffect(() => { if (ca.data) { setDesc(ca.data.description ?? ""); setDue(ca.data.due_date ?? ""); } }, [ca.data]);

  const update = useMutation({
    mutationFn: async (patch: any) => {
      const { error } = await supabase.from("corrective_actions").update(patch).eq("id", id);
      if (error) throw error;
      await supabase.from("audit_logs").insert({
        user_id: user!.id, action: `ca.update`, entity_type: "corrective_action", entity_id: id, details: patch,
      });
    },
    onSuccess: () => { toast.success("Updated"); qc.invalidateQueries({ queryKey: ["ca", id] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (ca.isLoading) return <Skeleton className="h-64 max-w-3xl" />;
  const c = ca.data;
  const isAssignee = c.assigned_to === user?.id;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link to="/corrective-actions" className="text-sm text-muted-foreground hover:underline inline-flex items-center gap-1"><ArrowLeft className="h-4 w-4" />Back</Link>
        <div className="flex items-center justify-between mt-2">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Corrective Action</h1>
            <div className="flex items-center gap-2 mt-1">
              <StatusBadge status={c.status} kind="ca" />
              <Link to="/non-conformances/$id" params={{ id: c.non_conformances?.id }} className="text-xs text-muted-foreground hover:underline font-mono">
                {c.non_conformances?.number}
              </Link>
            </div>
          </div>
          <div className="flex gap-2">
            {isAssignee && (c.status === "open" || c.status === "in_progress") && (
              <>
                {c.status === "open" && <Button size="sm" variant="outline" onClick={() => update.mutate({ status: "in_progress" })}>Start</Button>}
                <Button size="sm" onClick={() => update.mutate({ status: "completed", completed_at: new Date().toISOString() })}>Mark Complete</Button>
              </>
            )}
            {c.status === "completed" && canVerify && (
              <Button size="sm" onClick={() => update.mutate({ status: "verified", verified_at: new Date().toISOString(), verified_by: user!.id })}>Verify</Button>
            )}
          </div>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Description</Label>
            <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={4}
              onBlur={() => desc !== c.description && update.mutate({ description: desc })} />
          </div>
          <div>
            <Label>Assigned to</Label>
            <div className="text-sm">{c.profiles?.full_name ?? "Unassigned"}</div>
          </div>
          <div>
            <Label>Due date</Label>
            <Input type="date" value={due} onChange={(e) => setDue(e.target.value)}
              onBlur={() => (due || null) !== c.due_date && update.mutate({ due_date: due || null })} />
          </div>
          {c.completed_at && <div className="text-sm text-muted-foreground">Completed {new Date(c.completed_at).toLocaleString()}</div>}
          {c.verified_at && <div className="text-sm text-muted-foreground">Verified {new Date(c.verified_at).toLocaleString()} by {c.verifier?.full_name}</div>}
        </CardContent>
      </Card>
    </div>
  );
}
