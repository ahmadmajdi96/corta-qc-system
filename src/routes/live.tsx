import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AuthGate } from "@/components/auth-gate";
import { AppShell } from "@/components/app-shell";
import { MesPage, StatusPill } from "@/components/mes/mes-page";
import { supabase } from "@/integrations/supabase/client";
import { Radio, ScrollText, ShieldCheck, ClipboardCheck } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

function StatCard({ label, value, tone = "info", icon }: { label: string; value: string | number; tone?: "info" | "success" | "warning" | "danger"; icon: React.ReactNode }) {
  const rings: Record<string, string> = {
    info: "from-primary/25 to-info/10",
    success: "from-success/25 to-success/5",
    warning: "from-warning/25 to-warning/5",
    danger: "from-destructive/25 to-destructive/5",
  };
  return (
    <div className={`glass-panel rounded-2xl p-5 relative overflow-hidden`}>
      <div className={`absolute inset-0 bg-gradient-to-br ${rings[tone]} opacity-60 pointer-events-none`} />
      <div className="relative flex items-start justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
          <div className="mt-2 text-3xl font-semibold font-mono tracking-tight">{value}</div>
        </div>
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-background/40 text-primary">{icon}</div>
      </div>
    </div>
  );
}

function LiveBoard() {
  const wo = useQuery({
    queryKey: ["live", "work_orders"],
    queryFn: async () => {
      const { data } = await supabase.from("work_orders").select("id,number,status,quantity,quantity_completed,priority").order("created_at", { ascending: false }).limit(8);
      return data ?? [];
    },
    refetchInterval: 15000,
  });
  const holds = useQuery({
    queryKey: ["live", "holds"],
    queryFn: async () => {
      const { data } = await supabase.from("quality_holds").select("id,number,status,reason,opened_at").eq("status", "open").order("opened_at", { ascending: false }).limit(6);
      return data ?? [];
    },
    refetchInterval: 15000,
  });
  const insp = useQuery({
    queryKey: ["live", "inspections"],
    queryFn: async () => {
      const { data } = await supabase.from("inspections").select("id,status,scheduled_for").order("scheduled_for", { ascending: false }).limit(50);
      return data ?? [];
    },
    refetchInterval: 15000,
  });

  const activeWOs = wo.data?.filter((w: any) => w.status === "in_progress" || w.status === "released").length ?? 0;
  const openHolds = holds.data?.length ?? 0;
  const todayInsp = insp.data?.filter((i: any) => {
    if (!i.scheduled_for) return false;
    const d = new Date(i.scheduled_for);
    const t = new Date();
    return d.toDateString() === t.toDateString();
  }).length ?? 0;
  const passRate = (() => {
    const done = insp.data?.filter((i: any) => i.status === "completed" || i.status === "passed" || i.status === "failed") ?? [];
    if (!done.length) return "—";
    const pass = done.filter((i: any) => i.status === "passed" || i.status === "completed").length;
    return `${Math.round((pass / done.length) * 100)}%`;
  })();

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active WOs" value={activeWOs} icon={<ScrollText className="h-4 w-4" />} tone="info" />
        <StatCard label="Open Holds" value={openHolds} icon={<ShieldCheck className="h-4 w-4" />} tone={openHolds > 0 ? "danger" : "success"} />
        <StatCard label="Inspections Today" value={todayInsp} icon={<ClipboardCheck className="h-4 w-4" />} tone="info" />
        <StatCard label="Pass Rate (recent)" value={passRate} icon={<Radio className="h-4 w-4" />} tone="success" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="glass-panel rounded-2xl p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-medium">Active Work Orders</div>
            <span className="status-dot animate-pulse-glow text-success" />
          </div>
          {wo.isLoading ? <Skeleton className="h-40 w-full" /> : !wo.data?.length ? (
            <div className="py-6 text-center text-sm text-muted-foreground">No work orders</div>
          ) : (
            <div className="space-y-2">
              {wo.data.map((w: any) => (
                <div key={w.id} className="flex items-center justify-between rounded-lg border border-border/60 bg-background/40 px-3 py-2 text-sm">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-primary">{w.number}</span>
                    <StatusPill tone={w.status === "completed" ? "success" : w.status === "on_hold" ? "danger" : "info"}>{w.status}</StatusPill>
                  </div>
                  <span className="font-mono text-xs text-muted-foreground">{w.quantity_completed ?? 0}/{w.quantity ?? 0}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="glass-panel rounded-2xl p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-medium">Open Holds</div>
            <span className="status-dot animate-pulse-glow text-destructive" />
          </div>
          {holds.isLoading ? <Skeleton className="h-40 w-full" /> : !holds.data?.length ? (
            <div className="py-6 text-center text-sm text-muted-foreground">No open holds — line is clear</div>
          ) : (
            <div className="space-y-2">
              {holds.data.map((h: any) => (
                <div key={h.id} className="rounded-lg border border-border/60 bg-background/40 px-3 py-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-warning">{h.number}</span>
                    <span className="text-[11px] text-muted-foreground">{new Date(h.opened_at).toLocaleTimeString()}</span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground line-clamp-2">{h.reason}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/live")({
  ssr: false,
  head: () => ({ meta: [{ title: "Live Operations — CORTA QC" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <AuthGate>
      <AppShell>
        <MesPage
          icon={<Radio className="h-5 w-5" />}
          title="Live Operations"
          description="Real-time view of active work orders, open holds and inspection throughput."
        >
          <LiveBoard />
        </MesPage>
      </AppShell>
    </AuthGate>
  ),
});
