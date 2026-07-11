import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { toast } from "sonner";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from "recharts";
import { jsPDF } from "jspdf";
import { useSession } from "@/lib/auth";

const SEV_COLORS: Record<string,string> = { critical: "hsl(0 84% 60%)", major: "hsl(24 95% 55%)", minor: "hsl(45 93% 47%)" };

export function ReportsPage() {
  const qc = useQueryClient();
  const { user } = useSession();
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
    queryFn: async () => (await supabase.from("non_conformances")
      .select("severity, status, raised_at, closed_at, inspections(products(name))")
      .gte("raised_at", from).lte("raised_at", to + "T23:59:59")).data ?? [],
  });
  const cas = useQuery({
    queryKey: ["report-cas", from, to],
    queryFn: async () => (await supabase.from("corrective_actions")
      .select("status, due_date, completed_at, verified_at, created_at")
      .gte("created_at", from).lte("created_at", to + "T23:59:59")).data ?? [],
  });
  const exportsList = useQuery({
    queryKey: ["export-jobs"],
    queryFn: async () => (await supabase.from("export_jobs" as any).select("*").order("created_at",{ascending:false}).limit(50)).data ?? [],
  });

  // aggregations
  const byDate: Record<string, { day: string; total: number; passed: number; failed: number }> = {};
  (inspections.data ?? []).forEach((i: any) => {
    const d = i.scheduled_date;
    byDate[d] ??= { day: d, total: 0, passed: 0, failed: 0 };
    byDate[d].total += 1;
    const evaluated = (i.inspection_measurements ?? []).filter((m: any) => m.is_pass !== null);
    if (evaluated.length) {
      const allPass = evaluated.every((m: any) => m.is_pass);
      if (allPass) byDate[d].passed += 1; else byDate[d].failed += 1;
    }
  });
  const trendData = Object.values(byDate).sort((a,b) => a.day < b.day ? -1 : 1);

  const ncBySev = ["critical","major","minor"].map(s => ({
    name: s, value: (ncs.data ?? []).filter((n: any) => n.severity === s).length,
  }));
  const totalNc = (ncs.data ?? []).length;
  const ncOpen = (ncs.data ?? []).filter((n: any) => n.status !== "closed" && n.status !== "rejected").length;
  const closed = (ncs.data ?? []).filter((n: any) => n.closed_at);
  const mttrHours = closed.length ? Math.round(closed.reduce((sum: number, n: any) => sum + (new Date(n.closed_at).getTime() - new Date(n.raised_at).getTime()) / (3600 * 1000), 0) / closed.length) : 0;

  const caTotal = (cas.data ?? []).length;
  const caCompleted = (cas.data ?? []).filter((c: any) => c.completed_at).length;
  const caOnTime = (cas.data ?? []).filter((c: any) => c.completed_at && (!c.due_date || new Date(c.completed_at) <= new Date(c.due_date))).length;
  const caVerified = (cas.data ?? []).filter((c: any) => c.verified_at).length;
  const caStatusData = ["planned","in_progress","completed","verified"].map(s => ({ name: s, count: (cas.data ?? []).filter((c: any) => c.status === s).length }));

  async function logExport(export_type: string, format: string, row_count: number) {
    if (!user) return;
    await supabase.from("export_jobs" as any).insert({ user_id: user.id, export_type, format, row_count, filters: { from, to } });
    qc.invalidateQueries({ queryKey: ["export-jobs"] });
  }

  function exportCsv(type: "inspections" | "ncs" | "cas") {
    let rows: string[][] = [];
    if (type === "inspections") rows = [["Date","Total","Passed","Failed"], ...trendData.map(v => [v.day, String(v.total), String(v.passed), String(v.failed)])];
    else if (type === "ncs") rows = [["Raised","Severity","Status","Product"], ...((ncs.data ?? []) as any[]).map((n) => [n.raised_at, n.severity, n.status, n.inspections?.products?.name ?? ""])];
    else rows = [["Created","Due","Completed","Verified","Status"], ...((cas.data ?? []) as any[]).map((c) => [c.created_at, c.due_date ?? "", c.completed_at ?? "", c.verified_at ?? "", c.status])];
    const csv = rows.map((r) => r.map((v) => `"${(v ?? "").replaceAll(`"`,`""`)}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = `${type}-${from}-${to}.csv`; a.click(); URL.revokeObjectURL(url);
    logExport(type, "csv", rows.length - 1);
    toast.success("CSV exported");
  }

  function exportPdf(type: "inspections" | "ncs" | "cas") {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`CORTA QC — ${type.toUpperCase()} report`, 14, 18);
    doc.setFontSize(10);
    doc.text(`Period: ${from} to ${to}`, 14, 26);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 32);
    let y = 44;
    const lineHeight = 6;
    let count = 0;
    if (type === "inspections") {
      doc.text("Date        Total  Passed  Failed", 14, y); y += lineHeight;
      trendData.forEach(v => { doc.text(`${v.day}   ${v.total}       ${v.passed}       ${v.failed}`, 14, y); y += lineHeight; count++; if (y > 280) { doc.addPage(); y = 20; } });
    } else if (type === "ncs") {
      (ncs.data ?? []).forEach((n: any) => { doc.text(`${new Date(n.raised_at).toISOString().slice(0,10)}  ${n.severity}  ${n.status}`, 14, y); y += lineHeight; count++; if (y > 280) { doc.addPage(); y = 20; } });
    } else {
      (cas.data ?? []).forEach((c: any) => { doc.text(`${c.status}  due ${c.due_date ?? "—"}  done ${c.completed_at ? new Date(c.completed_at).toISOString().slice(0,10) : "—"}`, 14, y); y += lineHeight; count++; if (y > 280) { doc.addPage(); y = 20; } });
    }
    doc.save(`${type}-${from}-${to}.pdf`);
    logExport(type, "pdf", count);
    toast.success("PDF exported");
  }

  const anyError = inspections.error || ncs.error || cas.error;

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

      {anyError && <ErrorState onRetry={() => { inspections.refetch(); ncs.refetch(); cas.refetch(); }} />}

      <Tabs defaultValue="inspections">
        <TabsList>
          <TabsTrigger value="inspections">Inspection Trends</TabsTrigger>
          <TabsTrigger value="ncs">NC Analysis</TabsTrigger>
          <TabsTrigger value="capa">CAPA Effectiveness</TabsTrigger>
          <TabsTrigger value="export">Export</TabsTrigger>
        </TabsList>

        <TabsContent value="inspections" className="mt-4">
          {inspections.isLoading ? <Skeleton className="h-64" /> :
           !trendData.length ? <EmptyState title="No inspections in period" /> :
           <Card>
             <CardHeader><CardTitle className="text-base">Inspections per day</CardTitle></CardHeader>
             <CardContent className="h-72">
               <ResponsiveContainer>
                 <LineChart data={trendData}>
                   <CartesianGrid strokeDasharray="3 3" />
                   <XAxis dataKey="day" fontSize={11} />
                   <YAxis fontSize={11} />
                   <Tooltip />
                   <Legend />
                   <Line type="monotone" dataKey="total" stroke="hsl(var(--primary))" strokeWidth={2} />
                   <Line type="monotone" dataKey="passed" stroke="hsl(142 76% 36%)" strokeWidth={2} />
                   <Line type="monotone" dataKey="failed" stroke="hsl(0 84% 60%)" strokeWidth={2} />
                 </LineChart>
               </ResponsiveContainer>
             </CardContent>
           </Card>}
        </TabsContent>

        <TabsContent value="ncs" className="mt-4 space-y-4">
          {ncs.isLoading ? <Skeleton className="h-64" /> :
           !totalNc ? <EmptyState title="No NCs for selected period" /> :
           <>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
               <StatCard title="Total NCs" value={totalNc} />
               <StatCard title="Currently open" value={ncOpen} />
               <StatCard title="Mean time to resolve" value={`${mttrHours}h`} />
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <Card>
                 <CardHeader><CardTitle className="text-base">By severity</CardTitle></CardHeader>
                 <CardContent className="h-72">
                   <ResponsiveContainer>
                     <PieChart>
                       <Pie data={ncBySev} dataKey="value" nameKey="name" outerRadius={90} label>
                         {ncBySev.map((s) => <Cell key={s.name} fill={SEV_COLORS[s.name]} />)}
                       </Pie>
                       <Tooltip />
                       <Legend />
                     </PieChart>
                   </ResponsiveContainer>
                 </CardContent>
               </Card>
               <Card>
                 <CardHeader><CardTitle className="text-base">By status</CardTitle></CardHeader>
                 <CardContent className="h-72">
                   <ResponsiveContainer>
                     <BarChart data={["open","under_investigation","corrective_action_defined","closed","rejected"].map(s => ({ name: s, count: (ncs.data ?? []).filter((n:any)=>n.status===s).length }))}>
                       <CartesianGrid strokeDasharray="3 3" />
                       <XAxis dataKey="name" fontSize={10} />
                       <YAxis fontSize={11} />
                       <Tooltip />
                       <Bar dataKey="count" fill="hsl(var(--primary))" />
                     </BarChart>
                   </ResponsiveContainer>
                 </CardContent>
               </Card>
             </div>
           </>}
        </TabsContent>

        <TabsContent value="capa" className="mt-4 space-y-4">
          {cas.isLoading ? <Skeleton className="h-64" /> :
           !caTotal ? <EmptyState title="No corrective actions in period" /> :
           <>
             <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
               <StatCard title="Total actions" value={caTotal} />
               <StatCard title="Completed" value={`${caCompleted} (${Math.round(caCompleted/caTotal*100)}%)`} />
               <StatCard title="On-time" value={`${Math.round(caOnTime/caTotal*100)}%`} />
               <StatCard title="Verified" value={`${caVerified} (${Math.round(caVerified/caTotal*100)}%)`} />
             </div>
             <Card>
               <CardHeader><CardTitle className="text-base">By status</CardTitle></CardHeader>
               <CardContent className="h-72">
                 <ResponsiveContainer>
                   <BarChart data={caStatusData}>
                     <CartesianGrid strokeDasharray="3 3" />
                     <XAxis dataKey="name" fontSize={11} />
                     <YAxis fontSize={11} />
                     <Tooltip />
                     <Bar dataKey="count" fill="hsl(var(--primary))" />
                   </BarChart>
                 </ResponsiveContainer>
               </CardContent>
             </Card>
           </>}
        </TabsContent>

        <TabsContent value="export" className="mt-4 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Export Center</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <ExportRow label="Inspections" onCsv={() => exportCsv("inspections")} onPdf={() => exportPdf("inspections")} />
              <ExportRow label="Non-Conformances" onCsv={() => exportCsv("ncs")} onPdf={() => exportPdf("ncs")} />
              <ExportRow label="Corrective Actions" onCsv={() => exportCsv("cas")} onPdf={() => exportPdf("cas")} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Previous exports</CardTitle></CardHeader>
            <CardContent>
              {exportsList.isLoading ? <Skeleton className="h-24" /> :
               !((exportsList.data ?? []) as any[]).length ? <div className="text-sm text-muted-foreground">No exports yet.</div> :
               <table className="w-full text-sm">
                 <thead><tr className="text-left border-b"><th className="py-2">When</th><th>Type</th><th>Format</th><th>Rows</th><th>Status</th></tr></thead>
                 <tbody>
                   {((exportsList.data ?? []) as any[]).map((j) => (
                     <tr key={j.id} className="border-b">
                       <td className="py-2">{new Date(j.created_at).toLocaleString()}</td>
                       <td>{j.export_type}</td>
                       <td className="uppercase">{j.format}</td>
                       <td>{j.row_count ?? "—"}</td>
                       <td>{j.status}</td>
                     </tr>
                   ))}
                 </tbody>
               </table>}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ExportRow({ label, onCsv, onPdf }: { label: string; onCsv: () => void; onPdf: () => void }) {
  return (
    <div className="flex items-center justify-between rounded border p-3">
      <div className="text-sm font-medium">{label}</div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={onCsv}>CSV</Button>
        <Button size="sm" onClick={onPdf}>PDF</Button>
      </div>
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: string | number }) {
  return <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground font-medium">{title}</CardTitle></CardHeader>
    <CardContent><div className="text-2xl font-semibold">{value}</div></CardContent></Card>;
}
