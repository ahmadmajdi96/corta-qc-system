import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthGate } from "@/components/auth-gate";
import { AppShell } from "@/components/app-shell";
import { MesPage, StatusPill } from "@/components/mes/mes-page";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Inbox, Send, Plus, Loader2, Search, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/lib/auth";
import { NewProductRequestDialog } from "@/components/new-product-request-dialog";
import { downloadCSV } from "@/lib/csv";

type Row = {
  id: string;
  number: string;
  kind: string;
  title: string;
  status: string;
  requester_id: string;
  assignee_id: string | null;
  created_at: string;
  requester?: { full_name: string | null; email: string | null } | null;
  assignee?: { full_name: string | null; email: string | null } | null;
};

const STATUSES = ["pending", "in_review", "approved", "rejected", "completed", "cancelled"] as const;

function statusTone(s: string): "success" | "warning" | "danger" | "info" | "muted" {
  if (s === "approved" || s === "completed") return "success";
  if (s === "rejected" || s === "cancelled") return "danger";
  if (s === "in_review") return "info";
  return "warning";
}

function RequestsPage() {
  const { user } = useSession();
  const [tab, setTab] = useState<"incoming" | "outbound" | "all">("all");
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [pageSize, setPageSize] = useState<number>(25);
  const [page, setPage] = useState<number>(1);
  const [open, setOpen] = useState(false);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["requests", tab, user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Row[]> => {
      let query = supabase
        .from("requests")
        .select(
          "id, number, kind, title, status, requester_id, assignee_id, created_at, requester:profiles!requests_requester_id_fkey(full_name,email), assignee:profiles!requests_assignee_id_fkey(full_name,email)"
        )
        .order("created_at", { ascending: false })
        .limit(1000);
      if (tab === "incoming") query = query.or(`assignee_id.eq.${user!.id},assignee_id.is.null`);
      if (tab === "outbound") query = query.eq("requester_id", user!.id);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const from = fromDate ? new Date(fromDate).getTime() : null;
    const to = toDate ? new Date(toDate).getTime() + 24 * 3600 * 1000 : null;
    return (data ?? []).filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (from !== null && new Date(r.created_at).getTime() < from) return false;
      if (to !== null && new Date(r.created_at).getTime() > to) return false;
      if (!s) return true;
      return (
        r.number.toLowerCase().includes(s) ||
        r.title.toLowerCase().includes(s) ||
        r.status.toLowerCase().includes(s) ||
        (r.requester?.full_name ?? "").toLowerCase().includes(s) ||
        (r.requester?.email ?? "").toLowerCase().includes(s) ||
        (r.assignee?.full_name ?? "").toLowerCase().includes(s) ||
        (r.assignee?.email ?? "").toLowerCase().includes(s)
      );
    });
  }, [data, q, statusFilter, fromDate, toDate]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageSafe = Math.min(page, totalPages);
  const pageRows = filtered.slice((pageSafe - 1) * pageSize, pageSafe * pageSize);

  function resetPage() { setPage(1); }
  function exportCsv() {
    downloadCSV(
      `requests-${new Date().toISOString().slice(0, 10)}.csv`,
      filtered.map((r) => ({
        number: r.number,
        title: r.title,
        kind: r.kind,
        status: r.status,
        requester: r.requester?.full_name ?? r.requester?.email ?? "",
        assignee: r.assignee?.full_name ?? r.assignee?.email ?? "",
        created_at: r.created_at,
      }))
    );
  }

  return (
    <MesPage
      icon={<Inbox className="h-5 w-5" />}
      title="Requests"
      description="Incoming and outbound requests across departments — new product introductions, changes, and more."
      action={
        <Button onClick={() => setOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> New Product Request
        </Button>
      }
    >
      <Tabs value={tab} onValueChange={(v) => { setTab(v as any); resetPage(); }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="incoming" className="gap-2"><Inbox className="h-4 w-4" /> Incoming</TabsTrigger>
            <TabsTrigger value="outbound" className="gap-2"><Send className="h-4 w-4" /> Outbound</TabsTrigger>
          </TabsList>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => { setQ(e.target.value); resetPage(); }} placeholder="Search…" className="w-56 pl-8" />
            </div>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); resetPage(); }}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input type="date" value={fromDate} onChange={(e) => { setFromDate(e.target.value); resetPage(); }} className="w-36" title="Created from" />
            <Input type="date" value={toDate} onChange={(e) => { setToDate(e.target.value); resetPage(); }} className="w-36" title="Created to" />
            <Button variant="outline" size="sm" onClick={exportCsv} className="gap-1.5"><Download className="h-4 w-4" /> Export</Button>
          </div>
        </div>

        <TabsContent value={tab} className="mt-4">
          {isLoading ? (
            <div className="flex items-center gap-2 py-10 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
              No requests match your filters{tab === "outbound" ? " — click New Product Request to create one." : "."}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left">Number</th>
                      <th className="px-3 py-2 text-left">Title</th>
                      <th className="px-3 py-2 text-left">Kind</th>
                      <th className="px-3 py-2 text-left">Requester</th>
                      <th className="px-3 py-2 text-left">Assignee</th>
                      <th className="px-3 py-2 text-left">Status</th>
                      <th className="px-3 py-2 text-left">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((r) => (
                      <tr key={r.id} className="border-t hover:bg-muted/30">
                        <td className="px-3 py-2">
                          <Link to="/requests/$id" params={{ id: r.id }} className="font-mono text-xs text-primary hover:underline">
                            {r.number}
                          </Link>
                        </td>
                        <td className="px-3 py-2">{r.title}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{r.kind.replace("_", " ")}</td>
                        <td className="px-3 py-2 text-xs">{r.requester?.full_name ?? r.requester?.email ?? "—"}</td>
                        <td className="px-3 py-2 text-xs">{r.assignee?.full_name ?? r.assignee?.email ?? "— unassigned —"}</td>
                        <td className="px-3 py-2"><StatusPill tone={statusTone(r.status)}>{r.status.replace("_", " ")}</StatusPill></td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                <div>
                  Showing {(pageSafe - 1) * pageSize + 1}–{Math.min(pageSafe * pageSize, filtered.length)} of {filtered.length}
                </div>
                <div className="flex items-center gap-2">
                  <span>Rows per page</span>
                  <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); resetPage(); }}>
                    <SelectTrigger className="w-20 h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[25, 50, 100, 200].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={pageSafe <= 1}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="tabular-nums">Page {pageSafe} / {totalPages}</span>
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={pageSafe >= totalPages}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>

      <NewProductRequestDialog
        open={open}
        onOpenChange={setOpen}
        onCreated={() => {
          setOpen(false);
          refetch();
        }}
      />
      {isRefetching && <div className="mt-2 text-xs text-muted-foreground">Refreshing…</div>}
    </MesPage>
  );
}

export const Route = createFileRoute("/requests/")({
  ssr: false,
  head: () => ({ meta: [{ title: "Requests — CORTA QC" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <AuthGate>
      <AppShell>
        <RequestsPage />
      </AppShell>
    </AuthGate>
  ),
});
