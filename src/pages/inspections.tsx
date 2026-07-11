import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { CalendarDays, ListIcon, Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { NewInspectionDialog } from "@/components/new-inspection-dialog";
import { useMyRoles, hasAnyRole } from "@/lib/auth";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const PAGE_SIZE = 25;

export function InspectionsListPage() {
  const roles = useMyRoles();
  const canCreate = hasAnyRole(roles.data, "administrator", "quality_manager", "inspector");
  const [newOpen, setNewOpen] = useState(false);
  const [status, setStatus] = useState<string>("all");
  const [productId, setProductId] = useState<string>("all");
  const [lot, setLot] = useState("");
  const [debouncedLot, setDebouncedLot] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(0);

  useEffect(() => { const t = setTimeout(() => { setDebouncedLot(lot); setPage(0); }, 300); return () => clearTimeout(t); }, [lot]);

  const products = useQuery({
    queryKey: ["products-all"],
    queryFn: async () => (await supabase.from("products").select("id, name, sku").order("name")).data ?? [],
  });

  const list = useQuery({
    queryKey: ["inspections", status, productId, debouncedLot, dateFrom, dateTo, page],
    queryFn: async () => {
      let q = supabase.from("inspections")
        .select("*, products(name, sku), profiles!inspections_performed_by_fkey(full_name), inspection_measurements(is_pass)", { count: "exact" })
        .order("scheduled_date", { ascending: false });
      if (status !== "all") q = q.eq("status", status);
      if (productId !== "all") q = q.eq("product_id", productId);
      if (debouncedLot) q = q.ilike("lot_number", `%${debouncedLot}%`);
      if (dateFrom) q = q.gte("scheduled_date", dateFrom);
      if (dateTo) q = q.lte("scheduled_date", dateTo);
      q = q.range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: data ?? [], count: count ?? 0 };
    },
  });

  const totalPages = Math.max(1, Math.ceil((list.data?.count ?? 0) / PAGE_SIZE));

  return (
    <div className="max-w-7xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Inspections</h1>
          <p className="text-sm text-muted-foreground">All planned, in-progress and completed inspections</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline"><Link to="/inspections/calendar"><CalendarDays className="h-4 w-4 mr-2" />Calendar</Link></Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Select value={status} onValueChange={(v) => { setStatus(v); setPage(0); }}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="planned">Planned</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={productId} onValueChange={(v) => { setProductId(v); setPage(0); }}>
              <SelectTrigger><SelectValue placeholder="Product" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All products</SelectItem>
                {products.data?.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(0); }} placeholder="From" />
            <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(0); }} placeholder="To" />
            <Input value={lot} onChange={(e) => setLot(e.target.value)} placeholder="Lot number" />
          </div>
        </CardContent>
      </Card>

      <div className="rounded-lg border bg-card">
        {list.isLoading ? (
          <div className="p-6 space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
        ) : list.error ? (
          <div className="p-6 text-sm text-destructive">Failed to load.</div>
        ) : !list.data?.rows.length ? (
          <EmptyState title="No inspections match" action={canCreate ? <Button onClick={() => setNewOpen(true)}><Plus className="h-4 w-4 mr-2" />New Inspection</Button> : undefined} />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Lot</TableHead>
                  <TableHead>Performed by</TableHead>
                  <TableHead>Pass rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.data.rows.map((i: any) => {
                  const evaluated = (i.inspection_measurements ?? []).filter((m: any) => m.is_pass !== null);
                  const pr = evaluated.length ? Math.round((evaluated.filter((m: any) => m.is_pass).length / evaluated.length) * 100) : null;
                  return (
                    <TableRow key={i.id} className="cursor-pointer" onClick={() => (window.location.href = `/inspections/${i.id}`)}>
                      <TableCell>{i.scheduled_date}</TableCell>
                      <TableCell><span className="font-medium">{i.products?.name}</span> <span className="text-xs text-muted-foreground">{i.products?.sku}</span></TableCell>
                      <TableCell><StatusBadge status={i.status} kind="inspection" /></TableCell>
                      <TableCell>{i.lot_number || "—"}</TableCell>
                      <TableCell>{i.profiles?.full_name || "—"}</TableCell>
                      <TableCell>{pr !== null ? `${pr}%` : "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <div className="flex items-center justify-between px-4 py-3 border-t text-sm text-muted-foreground">
              <div>{list.data.count} inspections</div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Prev</Button>
                <div className="px-2 py-1">Page {page + 1} of {totalPages}</div>
                <Button variant="outline" size="sm" disabled={page + 1 >= totalPages} onClick={() => setPage(page + 1)}>Next</Button>
              </div>
            </div>
          </>
        )}
      </div>
      <NewInspectionDialog open={newOpen} onOpenChange={setNewOpen} />
    </div>
  );
}

export function InspectionCalendarPage() {
  const [view, setView] = useState<"month" | "week">("month");
  const [anchor, setAnchor] = useState(() => { const d = new Date(); d.setHours(0,0,0,0); return d; });

  const rangeStart = new Date(anchor);
  const rangeEnd = new Date(anchor);
  if (view === "month") {
    rangeStart.setDate(1);
    rangeEnd.setMonth(rangeEnd.getMonth() + 1); rangeEnd.setDate(1);
  } else {
    rangeStart.setDate(anchor.getDate() - anchor.getDay()); // Sunday
    rangeEnd.setTime(rangeStart.getTime()); rangeEnd.setDate(rangeStart.getDate() + 7);
  }

  const list = useQuery({
    queryKey: ["inspections-cal", view, rangeStart.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase.from("inspections")
        .select("id, status, scheduled_date, products(name)")
        .gte("scheduled_date", rangeStart.toISOString().slice(0,10))
        .lt("scheduled_date", rangeEnd.toISOString().slice(0,10))
        .order("scheduled_date");
      if (error) throw error;
      return data;
    },
  });

  const byDay: Record<string, any[]> = {};
  (list.data ?? []).forEach((i) => { (byDay[i.scheduled_date] ??= []).push(i); });

  const dayCount = Math.round((rangeEnd.getTime() - rangeStart.getTime()) / (24 * 3600 * 1000));
  const days: Date[] = [];
  for (let i = 0; i < dayCount; i++) { const d = new Date(rangeStart); d.setDate(d.getDate() + i); days.push(d); }
  const firstDow = view === "month" ? rangeStart.getDay() : 0;

  const title = view === "month"
    ? rangeStart.toLocaleString(undefined, { month: "long", year: "numeric" })
    : `Week of ${rangeStart.toLocaleDateString()}`;

  const shiftBy = (dir: -1 | 1) => {
    const d = new Date(anchor);
    if (view === "month") d.setMonth(d.getMonth() + dir);
    else d.setDate(d.getDate() + dir * 7);
    setAnchor(d);
  };

  const dotColor = (s: string) =>
    s === "completed" ? "bg-status-completed" :
    s === "in_progress" ? "bg-status-in-progress" :
    s === "cancelled" ? "bg-status-cancelled" :
    "bg-status-planned";

  const chipCls = (s: string) =>
    s === "completed" ? "bg-status-completed/20 text-status-completed" :
    s === "in_progress" ? "bg-status-in-progress/20 text-status-in-progress" :
    s === "cancelled" ? "bg-status-cancelled/20 text-status-cancelled" :
    "bg-status-planned/20 text-status-planned";

  const InspItem = ({ i, compact }: { i: any; compact?: boolean }) => (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`w-full text-left flex items-center gap-1 truncate rounded px-1 ${compact ? "text-[10px]" : "text-[11px] py-0.5"} ${chipCls(i.status)} hover:brightness-105`}
          aria-label={`${i.products?.name} — ${i.status}`}
        >
          <span className={`inline-block h-2 w-2 rounded-full ${dotColor(i.status)} flex-shrink-0`} aria-hidden />
          <span className="truncate">{i.products?.name}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64">
        <div className="space-y-2 text-sm">
          <div className="font-medium">{i.products?.name}</div>
          <div className="flex items-center gap-2">
            <span className={`inline-block h-2 w-2 rounded-full ${dotColor(i.status)}`} />
            <StatusBadge status={i.status} kind="inspection" />
          </div>
          <div className="text-xs text-muted-foreground">Scheduled {i.scheduled_date}</div>
          <Link to="/inspections/$id" params={{ id: i.id }} className="inline-flex text-xs text-primary hover:underline">Go to detail →</Link>
        </div>
      </PopoverContent>
    </Popover>
  );

  return (
    <div className="max-w-7xl space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Inspection Calendar</h1>
          <p className="text-sm text-muted-foreground">{title}</p>
        </div>
        <div className="flex gap-2 items-center">
          <div className="inline-flex rounded-md border overflow-hidden">
            <button
              className={`px-3 py-1 text-sm ${view === "month" ? "bg-primary text-primary-foreground" : "bg-background"}`}
              onClick={() => setView("month")}
            >Month</button>
            <button
              className={`px-3 py-1 text-sm border-l ${view === "week" ? "bg-primary text-primary-foreground" : "bg-background"}`}
              onClick={() => setView("week")}
            >Week</button>
          </div>
          <Button variant="outline" size="sm" onClick={() => shiftBy(-1)}>Prev</Button>
          <Button variant="outline" size="sm" onClick={() => { const d = new Date(); d.setHours(0,0,0,0); setAnchor(d); }}>Today</Button>
          <Button variant="outline" size="sm" onClick={() => shiftBy(1)}>Next</Button>
          <Button asChild variant="outline"><Link to="/inspections"><ListIcon className="h-4 w-4 mr-2" />List</Link></Button>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4">
        {list.isLoading ? <Skeleton className="h-96" /> : view === "month" ? (
          <div className="grid grid-cols-7 gap-1 text-xs">
            {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => <div key={d} className="font-medium text-muted-foreground p-1">{d}</div>)}
            {Array.from({ length: firstDow }).map((_, i) => <div key={`e${i}`} />)}
            {days.map((d) => {
              const key = d.toISOString().slice(0,10);
              const items = byDay[key] ?? [];
              return (
                <div key={key} className="border rounded min-h-20 p-1">
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-muted-foreground">{d.getDate()}</div>
                    <div className="flex gap-0.5">
                      {items.slice(0, 4).map((i) => (
                        <span key={i.id} className={`h-1.5 w-1.5 rounded-full ${dotColor(i.status)}`} aria-hidden />
                      ))}
                    </div>
                  </div>
                  <div className="space-y-0.5 mt-1">
                    {items.slice(0, 3).map((i) => <InspItem key={i.id} i={i} compact />)}
                    {items.length > 3 && <div className="text-[10px] text-muted-foreground">+{items.length - 3} more</div>}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-2 text-xs">
            {days.map((d) => {
              const key = d.toISOString().slice(0,10);
              const items = byDay[key] ?? [];
              const isToday = key === new Date().toISOString().slice(0,10);
              return (
                <div key={key} className={`border rounded min-h-64 p-2 ${isToday ? "ring-2 ring-primary" : ""}`}>
                  <div className="font-medium">{d.toLocaleDateString(undefined, { weekday: "short" })}</div>
                  <div className="text-muted-foreground mb-2">{d.getMonth()+1}/{d.getDate()}</div>
                  <div className="space-y-1">
                    {items.map((i) => <InspItem key={i.id} i={i} />)}
                    {!items.length && <div className="text-muted-foreground text-[11px]">—</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
