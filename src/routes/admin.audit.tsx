import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AuthGate } from "@/components/auth-gate";
import { AppShell } from "@/components/app-shell";
import { MesPage, StatusPill } from "@/components/mes/mes-page";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { History, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { useMyRoles, hasAnyRole } from "@/lib/auth";
import { useMemo, useState } from "react";
import { downloadCSV } from "@/lib/csv";

const PAGE_SIZES = [25, 50, 100, 200];

function AuditLogPage() {
  const { data: roles } = useMyRoles();
  if (!hasAnyRole(roles, "administrator", "auditor")) {
    return <div className="text-sm text-muted-foreground">You don't have permission to view audit logs.</div>;
  }

  const [search, setSearch] = useState("");
  const [entityType, setEntityType] = useState("");
  const [action, setAction] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(0);

  const list = useQuery({
    queryKey: ["audit-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("id, user_id, action, entity_type, entity_id, details, created_at")
        .order("created_at", { ascending: false })
        .limit(5000);
      if (error) throw error;
      return data ?? [];
    },
  });

  const entityOptions = useMemo(
    () => Array.from(new Set((list.data ?? []).map((r: any) => r.entity_type).filter(Boolean))),
    [list.data],
  );
  const actionOptions = useMemo(
    () => Array.from(new Set((list.data ?? []).map((r: any) => r.action).filter(Boolean))),
    [list.data],
  );

  const filtered = useMemo(() => {
    const rows = list.data ?? [];
    const s = search.trim().toLowerCase();
    const from = dateFrom ? new Date(dateFrom).getTime() : null;
    const to = dateTo ? new Date(dateTo).getTime() + 24 * 3600 * 1000 : null;
    return rows.filter((r: any) => {
      if (entityType && r.entity_type !== entityType) return false;
      if (action && r.action !== action) return false;
      if (from || to) {
        const t = new Date(r.created_at).getTime();
        if (from && t < from) return false;
        if (to && t > to) return false;
      }
      if (s) {
        const hay = `${r.action ?? ""} ${r.entity_type ?? ""} ${r.entity_id ?? ""} ${JSON.stringify(r.details ?? {})}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [list.data, search, entityType, action, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const clamped = Math.min(page, totalPages - 1);
  const paged = filtered.slice(clamped * pageSize, clamped * pageSize + pageSize);

  function handleExport() {
    downloadCSV(`audit_logs_${new Date().toISOString().slice(0, 10)}`, filtered.map((r: any) => ({
      "When": r.created_at,
      "Action": r.action,
      "Entity type": r.entity_type,
      "Entity id": r.entity_id,
      "User": r.user_id,
      "Details": JSON.stringify(r.details ?? {}),
    })));
  }

  return (
    <MesPage icon={<History className="h-5 w-5" />} title="Audit Log" description="Immutable trail of user and system actions.">
      <div className="mb-3 flex flex-wrap items-end gap-2 rounded-lg border bg-card/40 p-3">
        <div className="grid gap-1">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Search</Label>
          <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} placeholder="Action, entity, details..." className="h-9 w-64" />
        </div>
        <div className="grid gap-1">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Entity type</Label>
          <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={entityType} onChange={(e) => { setEntityType(e.target.value); setPage(0); }}>
            <option value="">All</option>
            {entityOptions.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div className="grid gap-1">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Action</Label>
          <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={action} onChange={(e) => { setAction(e.target.value); setPage(0); }}>
            <option value="">All</option>
            {actionOptions.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div className="grid gap-1">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Date from</Label>
          <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(0); }} className="h-9 w-40" placeholder="YYYY-MM-DD" />
        </div>
        <div className="grid gap-1">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Date to</Label>
          <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(0); }} className="h-9 w-40" placeholder="YYYY-MM-DD" />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} className="gap-2"><Download className="h-4 w-4" /> Export CSV</Button>
        </div>
      </div>

      {list.isLoading ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
      ) : !paged.length ? (
        <EmptyState title="No audit records" description="No log entries match the current filters." />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Entity ID</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</TableCell>
                    <TableCell><StatusPill tone="info">{r.action}</StatusPill></TableCell>
                    <TableCell className="text-sm">{r.entity_type}</TableCell>
                    <TableCell className="font-mono text-xs">{r.entity_id}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[420px] truncate" title={JSON.stringify(r.details ?? {})}>{JSON.stringify(r.details ?? {})}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Rows per page</span>
              <select className="h-8 rounded-md border border-input bg-background px-2 text-sm" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }}>
                {PAGE_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">{clamped * pageSize + 1}–{Math.min((clamped + 1) * pageSize, filtered.length)} of {filtered.length}</span>
              <Button variant="outline" size="icon" className="h-7 w-7" disabled={clamped === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}><ChevronLeft className="h-4 w-4" /></Button>
              <span className="tabular-nums">Page {clamped + 1} / {totalPages}</span>
              <Button variant="outline" size="icon" className="h-7 w-7" disabled={clamped >= totalPages - 1} onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
        </>
      )}
    </MesPage>
  );
}

export const Route = createFileRoute("/admin/audit")({
  ssr: false,
  head: () => ({ meta: [{ title: "Audit Log — CORTA QC" }, { name: "robots", content: "noindex" }] }),
  component: () => (<AuthGate><AppShell><AuditLogPage /></AppShell></AuthGate>),
});
