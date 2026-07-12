import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthGate } from "@/components/auth-gate";
import { AppShell } from "@/components/app-shell";
import { MesPage, StatusPill } from "@/components/mes/mes-page";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Inbox, Send, Plus, Loader2, Search } from "lucide-react";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/lib/auth";
import { NewProductRequestDialog } from "@/components/new-product-request-dialog";

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

function statusTone(s: string): "success" | "warning" | "danger" | "info" | "muted" {
  if (s === "approved" || s === "completed") return "success";
  if (s === "rejected" || s === "cancelled") return "danger";
  if (s === "in_review") return "info";
  return "warning";
}

function RequestsPage() {
  const { user } = useSession();
  const [tab, setTab] = useState<"incoming" | "outbound" | "all">("incoming");
  const [q, setQ] = useState("");
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
        .limit(200);
      if (tab === "incoming") query = query.or(`assignee_id.eq.${user!.id},assignee_id.is.null`);
      if (tab === "outbound") query = query.eq("requester_id", user!.id);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  const filtered = useMemo(() => {
    if (!q.trim()) return data ?? [];
    const s = q.toLowerCase();
    return (data ?? []).filter(
      (r) =>
        r.number.toLowerCase().includes(s) ||
        r.title.toLowerCase().includes(s) ||
        r.status.toLowerCase().includes(s)
    );
  }, [data, q]);

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
      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="incoming" className="gap-2"><Inbox className="h-4 w-4" /> Incoming</TabsTrigger>
            <TabsTrigger value="outbound" className="gap-2"><Send className="h-4 w-4" /> Outbound</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="w-64 pl-8" />
          </div>
        </div>

        <TabsContent value={tab} className="mt-4">
          {isLoading ? (
            <div className="flex items-center gap-2 py-10 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
              No requests to show{tab === "outbound" ? " — click New Product Request to create one." : "."}
            </div>
          ) : (
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
                  {filtered.map((r) => (
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
