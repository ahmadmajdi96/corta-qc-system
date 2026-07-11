import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { StatusBadge } from "@/components/status-badge";
import { useSession, useMyRoles, hasAnyRole } from "@/lib/auth";
import { AlertOctagon, ClipboardCheck, Wrench, TrendingUp, Plus } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { NewInspectionDialog } from "@/components/new-inspection-dialog";
import { RaiseNcDialog } from "@/components/raise-nc-dialog";

export function DashboardPage() {
  const today = new Date().toISOString().slice(0, 10);
  const { user } = useSession();
  const roles = useMyRoles();
  const canCreateInspection = hasAnyRole(roles.data, "administrator", "quality_manager", "inspector");
  const canRaiseNc = hasAnyRole(roles.data, "administrator", "quality_manager", "inspector");
  const [newInsp, setNewInsp] = useState(false);
  const [raiseNc, setRaiseNc] = useState(false);

  const summary = useQuery({
    queryKey: ["dashboard-summary", today],
    queryFn: async () => {
      const sevenAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

      const [insToday, openNC, overdueCA, recentMeas] = await Promise.all([
        supabase.from("inspections").select("id, status", { count: "exact" }).eq("scheduled_date", today),
        supabase.from("non_conformances").select("id", { count: "exact", head: true }).eq("status", "open"),
        supabase.from("corrective_actions").select("id", { count: "exact", head: true }).in("status", ["open", "in_progress"]).lt("due_date", today),
        supabase.from("inspection_measurements").select("is_pass").gte("recorded_at", sevenAgo),
      ]);
      if (insToday.error) throw insToday.error;
      if (openNC.error) throw openNC.error;
      if (overdueCA.error) throw overdueCA.error;
      if (recentMeas.error) throw recentMeas.error;

      const total = insToday.count ?? 0;
      const completed = (insToday.data ?? []).filter((r) => r.status === "completed").length;
      const passRateData = recentMeas.data ?? [];
      const evaluated = passRateData.filter((m) => m.is_pass !== null);
      const passRate = evaluated.length ? Math.round((evaluated.filter((m) => m.is_pass).length / evaluated.length) * 100) : null;

      return {
        inspectionsToday: total,
        completionRate: total ? Math.round((completed / total) * 100) : 0,
        openNCs: openNC.count ?? 0,
        overdueCAs: overdueCA.count ?? 0,
        passRate,
      };
    },
  });

  const todaysInspections = useQuery({
    queryKey: ["inspections-today", today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inspections")
        .select("id, status, scheduled_date, lot_number, products(name, sku)")
        .in("status", ["planned", "in_progress"])
        .eq("scheduled_date", today)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
  });

  const urgentNCs = useQuery({
    queryKey: ["urgent-ncs"],
    queryFn: async () => {
      const cutoff = new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString();
      const { data, error } = await supabase
        .from("non_conformances")
        .select("id, number, severity, raised_at, description, inspections(products(name))")
        .eq("status", "open")
        .in("severity", ["critical", "major"])
        .lte("raised_at", cutoff)
        .order("raised_at", { ascending: true })
        .limit(5);
      if (error) throw error;
      return data;
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
        .order("due_date");
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Today's overview and open items</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Inspections Today" icon={<ClipboardCheck className="h-4 w-4" />}
          value={summary.data?.inspectionsToday} loading={summary.isLoading} error={summary.error}
          suffix={summary.data ? `${summary.data.completionRate}% completed` : undefined}
          onRetry={() => summary.refetch()} href="/inspections" />
        <KpiCard title="Open NCs" icon={<AlertOctagon className="h-4 w-4" />}
          value={summary.data?.openNCs} loading={summary.isLoading} error={summary.error}
          onRetry={() => summary.refetch()} href="/non-conformances?status=open" />
        <KpiCard title="Overdue Corrective Actions" icon={<Wrench className="h-4 w-4" />}
          value={summary.data?.overdueCAs} loading={summary.isLoading} error={summary.error}
          onRetry={() => summary.refetch()} href="/corrective-actions" />
        <KpiCard title="Pass Rate (7 days)" icon={<TrendingUp className="h-4 w-4" />}
          value={summary.data?.passRate != null ? `${summary.data.passRate}%` : "—"}
          loading={summary.isLoading} error={summary.error}
          onRetry={() => summary.refetch()} href="/reports" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Today's Inspections</CardTitle></CardHeader>
          <CardContent>
            {todaysInspections.isLoading ? (
              <Skeleton className="h-32" />
            ) : todaysInspections.error ? (
              <div className="text-sm text-destructive">Failed to load. <button className="underline" onClick={() => todaysInspections.refetch()}>Retry</button></div>
            ) : !todaysInspections.data?.length ? (
              <EmptyState title="No inspections today" action={canCreateInspection ? <Button onClick={() => setNewInsp(true)}><Plus className="h-4 w-4 mr-2" />New Inspection</Button> : undefined} />
            ) : (
              <ul className="divide-y">
                {todaysInspections.data.map((i: any) => (
                  <li key={i.id}>
                    <Link to="/inspections/$id" params={{ id: i.id }} className="flex items-center justify-between py-3 hover:bg-accent/40 -mx-2 px-2 rounded">
                      <div>
                        <div className="text-sm font-medium">{i.products?.name ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">{i.products?.sku} {i.lot_number ? `· Lot ${i.lot_number}` : ""}</div>
                      </div>
                      <StatusBadge status={i.status} kind="inspection" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Urgent NCs</CardTitle></CardHeader>
          <CardContent>
            {urgentNCs.isLoading ? (
              <Skeleton className="h-32" />
            ) : urgentNCs.error ? (
              <div className="text-sm text-destructive">Failed to load.</div>
            ) : !urgentNCs.data?.length ? (
              <EmptyState title="No urgent NCs" action={canRaiseNc ? <Button variant="outline" onClick={() => setRaiseNc(true)}><Plus className="h-4 w-4 mr-2" />Raise NC</Button> : undefined} />
            ) : (
              <ul className="space-y-3">
                {urgentNCs.data.map((n: any) => (
                  <li key={n.id}>
                    <Link to="/non-conformances/$id" params={{ id: n.id }} className="block rounded-md border p-3 hover:bg-accent/40">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium">{n.number}</div>
                        <StatusBadge status={n.severity} kind="severity" />
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">{n.inspections?.products?.name}</div>
                      <div className="text-xs mt-1 line-clamp-2">{n.description}</div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {myOverdueActions.data && myOverdueActions.data.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">My Overdue Actions</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {myOverdueActions.data.map((a: any) => (
                <li key={a.id}>
                  <Link to="/corrective-actions/$id" params={{ id: a.id }} className="block rounded-md border p-3 hover:bg-accent/40">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium">{a.non_conformances?.number}</div>
                      <div className="text-xs text-destructive">Due {a.due_date}</div>
                    </div>
                    <div className="text-xs mt-1 line-clamp-2">{a.description}</div>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <NewInspectionDialog open={newInsp} onOpenChange={setNewInsp} />
      <RaiseNcDialog open={raiseNc} onOpenChange={setRaiseNc} />
    </div>
  );
}

function KpiCard({ title, icon, value, loading, error, suffix, onRetry, href }: {
  title: string; icon: ReactNode; value?: string | number; loading?: boolean;
  error?: unknown; suffix?: string; onRetry?: () => void; href?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className="text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-16" />
        ) : error ? (
          <div className="text-xs text-destructive">Failed. <button className="underline" onClick={onRetry}>Retry</button></div>
        ) : (
          <>
            {href ? (
              <Link to={href as any} className="text-2xl font-semibold tracking-tight hover:underline">{value ?? "0"}</Link>
            ) : (
              <div className="text-2xl font-semibold tracking-tight">{value ?? "0"}</div>
            )}
            {suffix && <div className="text-xs text-muted-foreground mt-1">{suffix}</div>}
          </>
        )}
      </CardContent>
    </Card>
  );
}
