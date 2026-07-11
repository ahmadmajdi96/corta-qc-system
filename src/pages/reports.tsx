import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { toast } from "sonner";

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0,0,0,0); return x; }

export function ReportsPage() {
  const [from, setFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0,10); });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0,10));

  const inspections = useQuery({
    queryKey: ["report-inspections", from, to],
    queryFn: async () => {
      const { data, error } = await supabase.from("inspections")
        .select("id, scheduled_date, status, inspection_measurements(is_pass)")
        .gte("scheduled_date", from).lte("scheduled_date", to);
      if (error) throw error;
      return data ?? [];
    },
  });

  const ncs = useQuery({
    queryKey: ["report-ncs", from, to],
    queryFn: async () => {
      const { data, error } = await supabase.from("non_conformances")
        .select("severity, status, raised_at, closed_at, inspections(products(name))")
        .gte("raised_at", from).lte("raised_at", to + "T23:59:59");
      if (error) throw error;
      return data ?? [];
    },
  });

  const cas = useQuery({
    queryKey: ["report-cas", from, to],
    queryFn: async () => {
      const { data, error } = await supabase.from("corrective_actions")
        .select("status, due_date, completed_at, verified_at, created_at")
        .gte("created_at", from).lte("created_at", to + "T23:59:59");
      if (error) throw error;
      return data ?? [];
    },
  });

  // aggregations
  const byDate: Record<string, { total: number; passed: number; failed: number }> = {};
  (inspections.data ?? []).forEach((i: any) => {
    const d = i.scheduled_date;
    byDate[d] ??= { total: 0, passed: 0, failed: 0 };
    byDate[d].total += 1;
    const evaluated = (i.inspection_measurements ?? []).filter((m: any) => m.is_pass !== null);
    if (evaluated.length) {
      const allPass = evaluated.every((m: any) => m.is_pass);
      if (allPass) byDate[d].passed += 1; else byDate[d].failed += 1;
    }
  });
  const rows = Object.entries(byDate).sort(([a],[b]) => a < b ? -1 : 1);

  const ncBySeverity: Record<string, number> = { critical: 0, major: 0, minor: 0 };
  (ncs.data ?? []).forEach((n: any) => { ncBySeverity[n.severity] = (ncBySeverity[n.severity] ?? 0) + 1; });
  const ncOpen = (ncs.data ?? []).filter((n: any) => n.status !== "closed" && n.status !== "rejected").length;
  const closed = (ncs.data ?? []).filter((n: any) => n.closed_at);
  const mttrHours = closed.length ? Math.round(closed.reduce((sum: number, n: any) => sum + (new Date(n.closed_at).getTime() - new Date(n.raised_at).getTime()) / (3600 * 1000), 0) / closed.length) : 0;

  const caTotal = (cas.data ?? []).length;
  const caCompleted = (cas.data ?? []).filter((c: any) => c.completed_at).length;
  const caOnTime = (cas.data ?? []).filter((c: any) => c.completed_at && (!c.due_date || new Date(c.completed_at) <= new Date(c.due_date))).length;
  const caVerified = (cas.data ?? []).filter((c: any) => c.verified_at).length;

  const [expOpen, setExpOpen] = useState(false);

  function exportCsv(type: "inspections" | "ncs" | "cas") {
    let rows: string[][] = [];
    if (type === "inspections") {
      rows = [["Date","Total","Passed","Failed"], ...Object.entries(byDate).map(([d, v]) => [d, String(v.total), String(v.passed), String(v.failed)])];
    } else if (type === "ncs") {
      rows = [["Raised","Severity","Status","Product"], ...((ncs.data ?? []) as any[]).map((n) => [n.raised_at, n.severity, n.status, n.inspections?.products?.name ?? ""])];
    } else {
      rows = [["Created","Due","Completed","Verified","Status"], ...((cas.data ?? []) as any[]).map((c) => [c.created_at, c.due_date ?? "", c.completed_at ?? "", c.verified_at ?? "", c.status])];
    }
    const csv = rows.map((r) => r.map((v) => `"${(v ?? "").replaceAll(`"`,`""`)}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = `${type}-${from}-${to}.csv`; a.click(); URL.revokeObjectURL(url);
    toast.success("Exported");
  }

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
        <p className="text-sm text-muted-foreground">Analytics and data export</p>
      </div>

      <Card><CardContent className="pt-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div><Label>From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div><Label>To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        </div>
      </CardContent></Card>

      <Tabs defaultValue="inspections">
        <TabsList>
          <TabsTrigger value="inspections">Inspection Trends</TabsTrigger>
          <TabsTrigger value="ncs">NC Analysis</TabsTrigger>
          <TabsTrigger value="capa">CAPA Effectiveness</TabsTrigger>
          <TabsTrigger value="export">Export</TabsTrigger>
        </TabsList>

        <TabsContent value="inspections" className="mt-4">
          {inspections.isLoading ? <Skeleton className="h-64" /> :
           !rows.length ? <EmptyState title="No data for selected period" /> :
           <Card>
             <CardHeader><CardTitle className="text-base">Daily breakdown</CardTitle></CardHeader>
             <CardContent>
               <table className="w-full text-sm">
                 <thead><tr className="text-left border-b"><th className="py-2">Date</th><th>Total</th><th>Passed</th><th>Failed</th><th>Pass rate</th></tr></thead>
                 <tbody>
                   {rows.map(([d, v]) => {
                     const evaluated = v.passed + v.failed;
                     const pr = evaluated ? Math.round((v.passed / evaluated) * 100) : null;
                     return <tr key={d} className="border-b"><td className="py-2">{d}</td><td>{v.total}</td><td className="text-status-completed">{v.passed}</td><td className="text-destructive">{v.failed}</td><td>{pr !== null ? `${pr}%` : "—"}</td></tr>;
                   })}
                 </tbody>
               </table>
             </CardContent>
           </Card>}
        </TabsContent>

        <TabsContent value="ncs" className="mt-4 space-y-4">
          {ncs.isLoading ? <Skeleton className="h-64" /> :
           !(ncs.data ?? []).length ? <EmptyState title="No NCs for selected period" /> :
           <>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
               <StatCard title="Total NCs" value={(ncs.data ?? []).length} />
               <StatCard title="Currently open" value={ncOpen} />
               <StatCard title="Mean time to resolve" value={`${mttrHours}h`} />
             </div>
             <Card>
               <CardHeader><CardTitle className="text-base">By severity</CardTitle></CardHeader>
               <CardContent>
                 <div className="space-y-2 text-sm">
                   {Object.entries(ncBySeverity).map(([sev, count]) => (
                     <div key={sev} className="flex items-center gap-3">
                       <div className="w-20 capitalize">{sev}</div>
                       <div className="flex-1 bg-muted rounded overflow-hidden h-4">
                         <div className={`h-full ${sev === "critical" ? "bg-severity-critical" : sev === "major" ? "bg-severity-major" : "bg-severity-minor"}`}
                              style={{ width: `${(count / Math.max(1, (ncs.data ?? []).length)) * 100}%` }} />
                       </div>
                       <div className="w-10 text-right">{count}</div>
                     </div>
                   ))}
                 </div>
               </CardContent>
             </Card>
           </>}
        </TabsContent>

        <TabsContent value="capa" className="mt-4">
          {cas.isLoading ? <Skeleton className="h-64" /> :
           !caTotal ? <EmptyState title="No corrective actions in period" /> :
           <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
             <StatCard title="Total actions" value={caTotal} />
             <StatCard title="Completed" value={`${caCompleted} (${Math.round(caCompleted/caTotal*100)}%)`} />
             <StatCard title="On-time completion" value={`${caTotal ? Math.round(caOnTime/caTotal*100) : 0}%`} />
             <StatCard title="Verified" value={`${caVerified} (${Math.round(caVerified/caTotal*100)}%)`} />
           </div>}
        </TabsContent>

        <TabsContent value="export" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Export Center</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <Button onClick={() => exportCsv("inspections")}>Export inspections CSV</Button>
              <Button onClick={() => exportCsv("ncs")}>Export NCs CSV</Button>
              <Button onClick={() => exportCsv("cas")}>Export Corrective Actions CSV</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: string | number }) {
  return <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground font-medium">{title}</CardTitle></CardHeader>
    <CardContent><div className="text-2xl font-semibold">{value}</div></CardContent></Card>;
}
