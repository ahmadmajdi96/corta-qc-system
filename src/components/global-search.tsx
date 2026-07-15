import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Search,
  Package,
  ScrollText,
  AlertOctagon,
  Wrench,
  ClipboardCheck,
  Gauge,
  Truck,
  Inbox,
  ShieldCheck,
  MessageSquareWarning,
  AlertTriangle,
} from "lucide-react";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const enabled = open;

  const workOrders = useQuery({
    enabled,
    queryKey: ["gsearch", "work_orders"],
    queryFn: async () => {
      const { data } = await supabase
        .from("work_orders")
        .select("id, number, status, products(name, sku)")
        .order("updated_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  const ncs = useQuery({
    enabled,
    queryKey: ["gsearch", "ncs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("non_conformances")
        .select("id, number, description, severity, status")
        .order("raised_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  const capas = useQuery({
    enabled,
    queryKey: ["gsearch", "capas"],
    queryFn: async () => {
      const { data } = await supabase
        .from("capa_records")
        .select("id, capa_number, d2_problem, status")
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });


  const products = useQuery({
    enabled,
    queryKey: ["gsearch", "products"],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("id, sku, name")
        .order("name")
        .limit(100);
      return data ?? [];
    },
  });

  const inspections = useQuery({
    enabled,
    queryKey: ["gsearch", "inspections"],
    queryFn: async () => {
      const { data } = await supabase
        .from("inspections")
        .select("id, lot_number, status, scheduled_date")
        .order("scheduled_date", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });


  const gages = useQuery({
    enabled,
    queryKey: ["gsearch", "gages"],
    queryFn: async () => {
      const { data } = await supabase
        .from("gages")
        .select("id, code, name, status")
        .order("code")
        .limit(50);
      return data ?? [];
    },
  });

  const suppliers = useQuery({
    enabled,
    queryKey: ["gsearch", "suppliers"],
    queryFn: async () => {
      const { data } = await supabase
        .from("suppliers")
        .select("id, code, name")
        .order("name")
        .limit(50);
      return data ?? [];
    },
  });

  const requests = useQuery({
    enabled,
    queryKey: ["gsearch", "requests"],
    queryFn: async () => {
      const { data } = await supabase
        .from("requests")
        .select("id, number, title, status")
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  const holds = useQuery({
    enabled,
    queryKey: ["gsearch", "holds"],
    queryFn: async () => {
      const { data } = await supabase
        .from("quality_holds")
        .select("id, hold_number, reason, status")
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });


  const scars = useQuery({
    enabled,
    queryKey: ["gsearch", "scars"],
    queryFn: async () => {
      const { data } = await supabase
        .from("supplier_scars")
        .select("id, number, issue_description, status")
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  const complaints = useQuery({
    enabled,
    queryKey: ["gsearch", "complaints"],
    queryFn: async () => {
      const { data } = await supabase
        .from("customer_complaints")
        .select("id, number, description, status")
        .order("received_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });


  const go = (to: string, params?: Record<string, string>) => {
    setOpen(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    navigate(params ? ({ to, params } as any) : ({ to } as any));
  };

  const loading = useMemo(
    () =>
      workOrders.isLoading ||
      ncs.isLoading ||
      products.isLoading ||
      inspections.isLoading,
    [workOrders.isLoading, ncs.isLoading, products.isLoading, inspections.isLoading],
  );

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="relative hidden h-9 w-72 items-center gap-2 rounded-lg border border-border/60 bg-card/60 px-3 text-left text-sm text-muted-foreground/70 hover:text-foreground md:flex"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="flex-1 truncate">Search everywhere…</span>
        <kbd className="rounded border border-border/60 bg-muted/50 px-1.5 py-0.5 font-mono text-[10px]">⌘K</kbd>
      </button>
      <button
        onClick={() => setOpen(true)}
        className="grid h-9 w-9 place-items-center rounded-lg border border-border/60 bg-card/60 text-muted-foreground md:hidden"
        aria-label="Search"
      >
        <Search className="h-4 w-4" />
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search WOs, NCs, CAPA, inspections, products, gages…" />
        <CommandList>
          <CommandEmpty>{loading ? "Searching…" : "No results found."}</CommandEmpty>

          <CommandGroup heading="Work Orders">
            {(workOrders.data ?? []).map((w) => (
              <CommandItem
                key={w.id}
                value={`${w.number} ${w.products?.name ?? ""} ${w.products?.sku ?? ""} ${w.status}`}
                onSelect={() => go("/work-orders/$id", { id: w.id })}
              >
                <ScrollText className="h-3.5 w-3.5 text-primary" />
                <span className="font-mono text-xs">{w.number}</span>
                <span className="text-xs text-muted-foreground">· {w.products?.name ?? "—"}</span>
                <span className="ml-auto text-[10px] uppercase tracking-wider text-muted-foreground">{w.status}</span>
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandGroup heading="Non-Conformances">
            {(ncs.data ?? []).map((n) => (
              <CommandItem
                key={n.id}
                value={`${n.number} ${n.description ?? ""} ${n.severity ?? ""}`}
                onSelect={() => go("/non-conformances/$id", { id: n.id })}
              >
                <AlertOctagon className="h-3.5 w-3.5 text-destructive" />
                <span className="font-mono text-xs">{n.number}</span>
                <span className="truncate text-xs text-muted-foreground">· {n.description ?? "—"}</span>
                <span className="ml-auto text-[10px] uppercase tracking-wider text-muted-foreground">{n.status}</span>
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandGroup heading="CAPA (8D)">
            {(capas.data ?? []).map((c) => (
              <CommandItem
                key={c.id}
                value={`${c.number ?? ""} ${c.title ?? ""}`}
                onSelect={() => go("/capa/$id", { id: c.id })}
              >
                <Wrench className="h-3.5 w-3.5 text-info" />
                <span className="font-mono text-xs">{c.number}</span>
                <span className="truncate text-xs">· {c.title ?? "—"}</span>
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandGroup heading="Inspections">
            {(inspections.data ?? []).map((i) => (
              <CommandItem
                key={i.id}
                value={`${i.number ?? ""} ${i.status ?? ""}`}
                onSelect={() => go("/inspections/$id", { id: i.id })}
              >
                <ClipboardCheck className="h-3.5 w-3.5 text-success" />
                <span className="font-mono text-xs">{i.number}</span>
                <span className="ml-auto text-[10px] uppercase text-muted-foreground">{i.status}</span>
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandGroup heading="Products">
            {(products.data ?? []).map((p) => (
              <CommandItem
                key={p.id}
                value={`${p.sku ?? ""} ${p.name ?? ""}`}
                onSelect={() => go("/products/$id", { id: p.id })}
              >
                <Package className="h-3.5 w-3.5 text-accent" />
                <span className="font-mono text-xs">{p.sku}</span>
                <span className="truncate text-xs">· {p.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandGroup heading="Quality Holds">
            {(holds.data ?? []).map((h) => (
              <CommandItem
                key={h.id}
                value={`${h.number ?? ""} ${h.reason ?? ""}`}
                onSelect={() => go("/holds")}
              >
                <ShieldCheck className="h-3.5 w-3.5 text-warning" />
                <span className="font-mono text-xs">{h.number}</span>
                <span className="truncate text-xs text-muted-foreground">· {h.reason ?? "—"}</span>
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandGroup heading="Gages">
            {(gages.data ?? []).map((g) => (
              <CommandItem
                key={g.id}
                value={`${g.code ?? ""} ${g.name ?? ""}`}
                onSelect={() => go("/calibration")}
              >
                <Gauge className="h-3.5 w-3.5 text-info" />
                <span className="font-mono text-xs">{g.code}</span>
                <span className="truncate text-xs">· {g.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandGroup heading="Suppliers">
            {(suppliers.data ?? []).map((s) => (
              <CommandItem
                key={s.id}
                value={`${s.code ?? ""} ${s.name ?? ""}`}
                onSelect={() => go("/suppliers")}
              >
                <Truck className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-mono text-xs">{s.code}</span>
                <span className="truncate text-xs">· {s.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandGroup heading="Supplier SCARs">
            {(scars.data ?? []).map((s) => (
              <CommandItem
                key={s.id}
                value={`${s.number ?? ""} ${s.title ?? ""}`}
                onSelect={() => go("/supplier-scars")}
              >
                <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                <span className="font-mono text-xs">{s.number}</span>
                <span className="truncate text-xs">· {s.title ?? "—"}</span>
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandGroup heading="Customer Complaints">
            {(complaints.data ?? []).map((c) => (
              <CommandItem
                key={c.id}
                value={`${c.number ?? ""} ${c.subject ?? ""}`}
                onSelect={() => go("/complaints")}
              >
                <MessageSquareWarning className="h-3.5 w-3.5 text-destructive" />
                <span className="font-mono text-xs">{c.number}</span>
                <span className="truncate text-xs">· {c.subject ?? "—"}</span>
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandGroup heading="Requests">
            {(requests.data ?? []).map((r) => (
              <CommandItem
                key={r.id}
                value={`${r.number ?? ""} ${r.title ?? ""}`}
                onSelect={() => go("/requests")}
              >
                <Inbox className="h-3.5 w-3.5 text-info" />
                <span className="font-mono text-xs">{r.number}</span>
                <span className="truncate text-xs">· {r.title ?? "—"}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
