import { useEffect, useState, type ComponentType } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line as RLine,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  ClipboardCheck,
  Gauge,
  Package,
  Plus,
  ShieldAlert,
  Timer,
  TrendingUp,
  Wrench,
  Zap,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession, useMyRoles, hasAnyRole } from "@/lib/auth";
import { NewInspectionDialog } from "@/components/new-inspection-dialog";
import { AddNcDialog } from "@/components/add-nc-dialog";
import { Button } from "@/components/ui/button";

const tooltipStyle = {
  background: "oklch(0.16 0.02 240 / 0.98)",
  border: "1px solid oklch(0.35 0.02 245)",
  borderRadius: 8,
  fontSize: 12,
  color: "oklch(0.98 0 0)",
};
const tooltipLabelStyle = { color: "oklch(0.85 0 0)", fontSize: 11, marginBottom: 4 };
const tooltipItemStyle = { color: "oklch(0.98 0 0)" };


const SEVERITY_COLOR: Record<string, string> = {
  critical: "oklch(0.65 0.24 22)",
  major: "oklch(0.82 0.17 80)",
  minor: "oklch(0.72 0.14 230)",
  cosmetic: "oklch(0.68 0.02 245)",
};

type Accent = "primary" | "success" | "warning" | "info" | "accent" | "destructive";
const accentMap: Record<Accent, string> = {
  primary: "from-primary/20 to-primary/0 text-primary",
  success: "from-success/20 to-success/0 text-success",
  warning: "from-warning/20 to-warning/0 text-warning",
  info: "from-info/20 to-info/0 text-info",
  accent: "from-accent/20 to-accent/0 text-accent",
  destructive: "from-destructive/20 to-destructive/0 text-destructive",
};

function Kpi({
  label,
  value,
  delta,
  icon: Icon,
  accent = "primary",
  suffix,
  href,
}: {
  label: string;
  value: string | number;
  delta?: string;
  icon: ComponentType<{ className?: string }>;
  accent?: Accent;
  suffix?: string;
  href?: string;
}) {
  const body = (
    <div className="glass-panel relative overflow-hidden rounded-2xl p-4 transition hover:border-primary/50">
      <div className={`absolute inset-0 bg-gradient-to-br ${accentMap[accent]} opacity-60`} />
      <div className="relative">
        <div className="flex items-center justify-between">
          <span className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{label}</span>
          <Icon className={`h-4 w-4 ${accentMap[accent].split(" ").pop()}`} />
        </div>
        <div className="mt-3 flex items-baseline gap-1">
          <span className="font-mono text-3xl font-semibold tracking-tight">{value}</span>
          {suffix && <span className="text-sm text-muted-foreground">{suffix}</span>}
        </div>
        {delta && (
          <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
            <ArrowUpRight className="h-3 w-3 text-success" />
            <span>{delta}</span>
          </div>
        )}
      </div>
    </div>
  );
  return href ? <Link to={href as string} className="block">{body}</Link> : body;
}

function Legend({ dot, label }: { dot: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-muted-foreground">
      <span className={`h-2 w-2 rounded-sm ${dot}`} />
      {label}
    </span>
  );
}

export function DashboardPage() {
  const today = new Date().toISOString().slice(0, 10);
  const { user } = useSession();
  const roles = useMyRoles();
  const canCreateInspection = hasAnyRole(roles.data, "administrator", "quality_manager", "inspector");
  const canRaiseNc = hasAnyRole(roles.data, "administrator", "quality_manager", "inspector");
  const [newInsp, setNewInsp] = useState(false);
  const [raiseNc, setRaiseNc] = useState(false);
  const [clock, setClock] = useState("");
  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, []);

  const summary = useQuery({
    queryKey: ["dash-summary", today],
    queryFn: async () => {
      const thirtyAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
      const [insToday, openNC, overdueCA, recentMeas, openHolds, runningWO] = await Promise.all([
        supabase.from("inspections").select("id, status", { count: "exact" }).eq("scheduled_date", today),
        supabase.from("non_conformances").select("id", { count: "exact", head: true }).eq("status", "open"),
        supabase.from("corrective_actions").select("id", { count: "exact", head: true }).in("status", ["open", "in_progress"]).lt("due_date", today),
        supabase.from("inspection_measurements").select("is_pass, recorded_at").gte("recorded_at", thirtyAgo),
        supabase.from("quality_holds").select("id", { count: "exact", head: true }).eq("status", "open"),
        supabase.from("work_orders").select("id", { count: "exact", head: true }).eq("status", "in_progress"),
      ]);
      const err = insToday.error || openNC.error || overdueCA.error || recentMeas.error || openHolds.error || runningWO.error;
      if (err) throw err;
      const total = insToday.count ?? 0;
      const completed = (insToday.data ?? []).filter((r) => r.status === "completed").length;
      const meas = recentMeas.data ?? [];
      const evaluated = meas.filter((m) => m.is_pass !== null);
      const passRate = evaluated.length ? Math.round((evaluated.filter((m) => m.is_pass).length / evaluated.length) * 100) : 0;
      return {
        inspectionsToday: total,
        completionRate: total ? Math.round((completed / total) * 100) : 0,
        openNCs: openNC.count ?? 0,
        overdueCAs: overdueCA.count ?? 0,
        openHolds: openHolds.count ?? 0,
        runningWO: runningWO.count ?? 0,
        passRate,
        measurements: meas,
      };
    },
  });

  // Pass rate trend — daily buckets over last 14 days
  const trend = useQuery({
    queryKey: ["dash-trend"],
    queryFn: async () => {
      const DAYS = 14;
      const since = new Date(Date.now() - DAYS * 24 * 3600 * 1000).toISOString();
      const { data, error } = await supabase
        .from("inspection_measurements")
        .select("is_pass, recorded_at")
        .gte("recorded_at", since);
      if (error) throw error;
      const buckets = Array.from({ length: DAYS }, (_, i) => {
        const d = new Date(Date.now() - (DAYS - 1 - i) * 24 * 3600 * 1000);
        const label = `${d.getMonth() + 1}/${d.getDate()}`;
        return { hour: label, pass: 0, total: 0, key: d.toISOString().slice(0, 10) };
      });
      const idxByKey = new Map(buckets.map((b, i) => [b.key, i]));
      for (const m of data ?? []) {
        if (m.is_pass === null) continue;
        const key = new Date(m.recorded_at).toISOString().slice(0, 10);
        const idx = idxByKey.get(key);
        if (idx === undefined) continue;
        buckets[idx].total += 1;
        if (m.is_pass) buckets[idx].pass += 1;
      }
      return buckets.map((b) => ({
        hour: b.hour,
        passRate: b.total ? Math.round((b.pass / b.total) * 100) : null,
        volume: b.total,
      }));
    },
  });

  const runningWOs = useQuery({
    queryKey: ["dash-wos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("work_orders")
        .select("id, number, status, quantity_planned, quantity_produced, line_id, products(name, sku)")
        .order("updated_at", { ascending: false })
        .limit(6);
      if (error) throw error;
      return data ?? [];
    },
  });


  const urgentNCs = useQuery({
    queryKey: ["dash-urgent-ncs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("non_conformances")
        .select("id, number, severity, category, raised_at, description, status")
        .eq("status", "open")
        .order("raised_at", { ascending: false })
        .limit(6);
      if (error) throw error;
      return data ?? [];
    },
  });

  const ncMix = useQuery({
    queryKey: ["dash-nc-mix"],
    queryFn: async () => {
      const since = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString();
      const { data, error } = await supabase
        .from("non_conformances")
        .select("severity, category")
        .gte("raised_at", since);
      if (error) throw error;
      const bySev: Record<string, number> = {};
      const byCat: Record<string, number> = {};
      for (const n of data ?? []) {
        bySev[n.severity] = (bySev[n.severity] ?? 0) + 1;
        const c = n.category ?? "Uncategorized";
        byCat[c] = (byCat[c] ?? 0) + 1;
      }
      const severity = Object.entries(bySev).map(([name, value]) => ({
        name,
        value,
        color: SEVERITY_COLOR[name] ?? "oklch(0.72 0.14 280)",
      }));
      const category = Object.entries(byCat)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([name, value], i) => ({
          name,
          value,
          color: [
            "oklch(0.78 0.16 195)",
            "oklch(0.82 0.17 80)",
            "oklch(0.65 0.24 22)",
            "oklch(0.72 0.18 155)",
            "oklch(0.72 0.14 230)",
            "oklch(0.72 0.14 280)",
          ][i],
        }));
      return { severity, category };
    },
  });

  const myOverdueActions = useQuery({
    queryKey: ["my-overdue-actions", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("corrective_actions")
        .select("id, description, due_date, status, non_conformances(number)")
        .eq("assigned_to", user!.id)
        .in("status", ["open", "in_progress"])
        .lt("due_date", today)
        .order("due_date", { ascending: true })
        .limit(5);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Quality Control Center</h1>
          <p className="text-sm text-muted-foreground">
            Today · <span suppressHydrationWarning>{clock}</span> · Live QMS overview
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canCreateInspection && (
            <Button size="sm" variant="outline" onClick={() => setNewInsp(true)}>
              <Plus className="h-4 w-4 mr-1.5" />New Inspection
            </Button>
          )}
          {canRaiseNc && (
            <Button size="sm" variant="outline" onClick={() => setRaiseNc(true)}>
              <AlertOctagon className="h-4 w-4 mr-1.5" />Raise NC
            </Button>
          )}
          <span className="flex items-center gap-1.5 rounded-lg border border-success/40 bg-success/10 px-3 py-1.5 text-xs font-medium text-success">
            <span className="status-dot bg-success animate-pulse-glow" />Live
          </span>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi label="Pass Rate (30d)" value={summary.data?.passRate ?? 0} suffix="%" icon={Gauge} accent="primary" href="/inspections" />
        <Kpi label="Inspections Today" value={summary.data?.inspectionsToday ?? 0} delta={`${summary.data?.completionRate ?? 0}% completed`} icon={ClipboardCheck} accent="info" href={`/inspections?date=${today}`} />
        <Kpi label="Open NCs" value={summary.data?.openNCs ?? 0} icon={AlertOctagon} accent="destructive" href="/non-conformances?status=open" />
        <Kpi label="Overdue CAs" value={summary.data?.overdueCAs ?? 0} icon={Wrench} accent="warning" href="/corrective-actions?overdue=1" />
        <Kpi label="Quality Holds" value={summary.data?.openHolds ?? 0} icon={ShieldAlert} accent="accent" href="/holds" />
      </div>

      {/* Trend + Radial */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="glass-panel rounded-2xl p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">Pass Rate — Last 14 days</h3>
              <p className="text-xs text-muted-foreground">Measurements evaluated per day</p>
            </div>
            <div className="flex gap-3 text-[11px]">
              <Legend dot="bg-primary" label="Pass rate %" />
              <Legend dot="bg-accent" label="Volume" />
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer>
              <AreaChart data={trend.data ?? []}>
                <defs>
                  <linearGradient id="passArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.78 0.16 195)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="oklch(0.78 0.16 195)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.3 0.02 245 / 0.4)" />
                <XAxis dataKey="hour" stroke="oklch(0.68 0.02 245)" fontSize={11} />
                <YAxis yAxisId="left" stroke="oklch(0.68 0.02 245)" fontSize={11} domain={[0, 100]} />
                <YAxis yAxisId="right" orientation="right" stroke="oklch(0.68 0.02 245)" fontSize={11} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area yAxisId="left" type="monotone" dataKey="passRate" stroke="oklch(0.78 0.16 195)" fill="url(#passArea)" strokeWidth={2} connectNulls />
                <RLine yAxisId="right" type="monotone" dataKey="volume" stroke="oklch(0.82 0.17 80)" strokeWidth={1.5} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-5">
          <h3 className="text-sm font-semibold">Overall Pass Rate</h3>
          <p className="text-xs text-muted-foreground">Last 30 days</p>
          <div className="relative mt-2 h-64">
            <ResponsiveContainer>
              <RadialBarChart
                innerRadius="60%"
                outerRadius="95%"
                data={[{ name: "pass", value: summary.data?.passRate ?? 0, fill: "oklch(0.78 0.16 195)" }]}
                startAngle={210}
                endAngle={-30}
              >
                <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                <RadialBar dataKey="value" background={{ fill: "oklch(0.25 0.02 245)" }} cornerRadius={12} />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-mono text-5xl font-semibold text-glow">{summary.data?.passRate ?? 0}</span>
              <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Pass %</span>
              <div className="mt-3 flex gap-3 text-[10px] text-muted-foreground">
                <span>NC {summary.data?.openNCs ?? 0}</span>
                <span>CA {summary.data?.overdueCAs ?? 0}</span>
                <span>Holds {summary.data?.openHolds ?? 0}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Work orders + Andon (Urgent NCs) */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="glass-panel rounded-2xl p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">Work Orders · Latest</h3>
              <p className="text-xs text-muted-foreground">{summary.data?.runningWO ?? 0} in progress · showing recent activity</p>
            </div>
            <Link to="/work-orders" className="text-xs text-primary hover:underline">View all →</Link>
          </div>

          {runningWOs.data && runningWOs.data.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {runningWOs.data.map((w: any) => {
                const pct = w.quantity_planned > 0 ? Math.round((w.quantity_produced / w.quantity_planned) * 100) : 0;
                return (
                  <Link
                    key={w.id}
                    to="/work-orders/$id"
                    params={{ id: w.id }}
                    className="rounded-xl border border-border/60 bg-card/40 p-3 hover:border-primary/50 transition"
                  >
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[11px] text-muted-foreground">{w.number}</span>
                          <span className="truncate text-sm font-medium">{w.products?.name ?? "—"}</span>
                        </div>
                        <p className="truncate text-[11px] text-muted-foreground">{w.products?.sku ?? "—"}</p>
                      </div>
                      <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded ${w.status === "in_progress" ? "bg-success/15 text-success" : w.status === "completed" ? "bg-success/10 text-success/80" : w.status === "released" ? "bg-info/15 text-info" : "bg-muted text-muted-foreground"}`}>
                        {w.status.replace("_", " ")}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-mono font-medium">{pct}%</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(100, pct)}%`,
                          background: pct >= 80 ? "var(--color-success)" : pct >= 40 ? "var(--color-accent)" : "var(--color-primary)",
                        }}
                      />
                    </div>
                    <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
                      <span>{w.quantity_produced.toLocaleString()} / {w.quantity_planned.toLocaleString()}</span>
                      <Package className="h-3 w-3" />
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
              No active work orders
            </div>
          )}
        </div>

        <div className="glass-panel rounded-2xl p-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">NC Feed</h3>
              <p className="text-xs text-muted-foreground">{urgentNCs.data?.length ?? 0} recent open</p>
            </div>
            <Zap className="h-4 w-4 text-accent" />
          </div>
          <div className="space-y-2">
            {(urgentNCs.data ?? []).map((n: any) => {
              const color = n.severity === "critical"
                ? "border-destructive/40 bg-destructive/5"
                : n.severity === "major"
                ? "border-warning/40 bg-warning/5"
                : "border-border/60 bg-card/40";
              const Icon = n.severity === "critical" ? AlertTriangle : n.severity === "major" ? AlertTriangle : Activity;
              const iconColor = n.severity === "critical" ? "text-destructive" : n.severity === "major" ? "text-warning" : "text-info";
              return (
                <Link
                  key={n.id}
                  to="/non-conformances/$id"
                  params={{ id: n.id }}
                  className={`block rounded-lg border p-2.5 ${color} hover:border-primary/50 transition`}
                >
                  <div className="flex items-start gap-2">
                    <Icon className={`h-3.5 w-3.5 mt-0.5 ${iconColor}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs font-medium">{n.number}</span>
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {new Date(n.raised_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-muted-foreground line-clamp-2">{n.description}</p>
                    </div>
                  </div>
                </Link>
              );
            })}
            {urgentNCs.data && urgentNCs.data.length === 0 && (
              <div className="rounded-lg border border-dashed border-border/60 p-6 text-center text-xs text-muted-foreground">
                No open non-conformances
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Pareto + Volume line + Donut */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="glass-panel rounded-2xl p-5">
          <h3 className="text-sm font-semibold">NC Pareto — 90 days</h3>
          <p className="text-xs text-muted-foreground">Count by category</p>
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={ncMix.data?.category ?? []} layout="vertical" margin={{ left: 10 }}>
                <XAxis type="number" stroke="oklch(0.68 0.02 245)" fontSize={11} />
                <YAxis type="category" dataKey="name" stroke="oklch(0.68 0.02 245)" fontSize={10} width={110} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                  {(ncMix.data?.category ?? []).map((d, i) => <Cell key={i} fill={d.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-5">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-sm font-semibold">Measurement Volume</h3>
              <p className="text-xs text-muted-foreground">Records per day · last 14d</p>
            </div>
            <span className="font-mono text-xl font-semibold text-primary">
              {(trend.data ?? []).reduce((a, b) => a + b.volume, 0)}
            </span>
          </div>
          <div className="h-56">
            <ResponsiveContainer>
              <LineChart data={trend.data ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.3 0.02 245 / 0.4)" />
                <XAxis dataKey="hour" stroke="oklch(0.68 0.02 245)" fontSize={10} />
                <YAxis stroke="oklch(0.68 0.02 245)" fontSize={10} />
                <Tooltip contentStyle={tooltipStyle} />
                <RLine type="monotone" dataKey="volume" stroke="oklch(0.82 0.17 80)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-5">
          <h3 className="text-sm font-semibold">Severity Mix</h3>
          <p className="text-xs text-muted-foreground">Open + recent NCs (90d)</p>
          <div className="h-40">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={ncMix.data?.severity ?? []} dataKey="value" innerRadius={40} outerRadius={65} paddingAngle={2}>
                  {(ncMix.data?.severity ?? []).map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-1 text-[11px]">
            {(ncMix.data?.severity ?? []).map((d) => (
              <div key={d.name} className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-sm" style={{ background: d.color }} />
                  <span className="text-muted-foreground capitalize">{d.name}</span>
                </span>
                <span className="font-mono">{d.value}</span>
              </div>
            ))}
            {ncMix.data && ncMix.data.severity.length === 0 && (
              <div className="text-center text-muted-foreground py-2">No NCs in period</div>
            )}
          </div>
        </div>
      </div>

      {/* Overdue actions table */}
      {myOverdueActions.data && myOverdueActions.data.length > 0 && (
        <div className="glass-panel rounded-2xl p-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">My Overdue Corrective Actions</h3>
              <p className="text-xs text-muted-foreground">{myOverdueActions.data.length} needs attention</p>
            </div>
            <Link to="/corrective-actions" className="text-xs text-primary hover:underline">All →</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">NC</th>
                  <th className="py-2 pr-4 font-medium">Description</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 pr-4 font-medium text-right">Due</th>
                </tr>
              </thead>
              <tbody>
                {myOverdueActions.data.map((a: any) => (
                  <tr key={a.id} className="border-t border-border/40">
                    <td className="py-3 pr-4 font-mono text-xs">{a.non_conformances?.number}</td>
                    <td className="py-3 pr-4 max-w-md truncate">{a.description}</td>
                    <td className="py-3 pr-4 text-xs capitalize">{a.status.replace("_", " ")}</td>
                    <td className="py-3 pr-4 text-right font-mono text-xs text-destructive">{a.due_date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <NewInspectionDialog open={newInsp} onOpenChange={setNewInsp} />
      <AddNcDialog open={raiseNc} onOpenChange={setRaiseNc} />
    </div>
  );
}
