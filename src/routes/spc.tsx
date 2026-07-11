import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AuthGate } from "@/components/auth-gate";
import { AppShell } from "@/components/app-shell";
import { MesPage } from "@/components/mes/mes-page";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { Activity } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, Legend } from "recharts";

function SpcChart() {
  const { data, isLoading } = useQuery({
    queryKey: ["spc_samples", "recent"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("spc_samples")
        .select("*")
        .order("sample_time", { ascending: true })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  if (isLoading) return <Skeleton className="h-72 w-full" />;
  if (!data?.length) {
    return (
      <EmptyState
        icon={<Activity className="h-6 w-6" />}
        title="No SPC samples yet"
        description="Samples recorded through inspections will chart X̄ with UCL/LCL bands here."
      />
    );
  }

  const chartData = data.map((s: any, i) => ({
    idx: i + 1,
    mean: s.x_bar != null ? Number(s.x_bar) : null,
  }));

  const first = data[0] as any;
  const ucl = first.ucl != null ? Number(first.ucl) : undefined;
  const lcl = first.lcl != null ? Number(first.lcl) : undefined;
  const cp = first.cp != null ? Number(first.cp).toFixed(2) : "—";
  const cpk = first.cpk != null ? Number(first.cpk).toFixed(2) : "—";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="glass-panel rounded-xl p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">UCL</div>
          <div className="font-mono text-lg">{ucl ?? "—"}</div>
        </div>
        <div className="glass-panel rounded-xl p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">LCL</div>
          <div className="font-mono text-lg">{lcl ?? "—"}</div>
        </div>
        <div className="glass-panel rounded-xl p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Cp</div>
          <div className="font-mono text-lg text-info">{cp}</div>
        </div>
        <div className="glass-panel rounded-xl p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Cpk</div>
          <div className="font-mono text-lg text-success">{cpk}</div>
        </div>
      </div>
      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="idx" stroke="hsl(var(--muted-foreground))" fontSize={12} />
            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
            <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
            <Legend />
            {ucl !== undefined && <ReferenceLine y={ucl} stroke="hsl(var(--destructive))" strokeDasharray="4 4" label="UCL" />}
            {lcl !== undefined && <ReferenceLine y={lcl} stroke="hsl(var(--destructive))" strokeDasharray="4 4" label="LCL" />}
            <Line type="monotone" dataKey="mean" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} name="X̄" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/spc")({
  ssr: false,
  head: () => ({ meta: [{ title: "SPC — CORTA QC" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <AuthGate>
      <AppShell>
        <MesPage
          icon={<Activity className="h-5 w-5" />}
          title="Statistical Process Control"
          description="X̄ / R charts with control limits and Cp/Cpk derived from inspection samples."
        >
          <SpcChart />
        </MesPage>
      </AppShell>
    </AuthGate>
  ),
});
