import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { notifyError, parseServerFieldErrors } from "@/lib/toast";
import { useSession } from "@/lib/auth";
import { useNavigate } from "@tanstack/react-router";
import { z } from "zod";

const inspectionSchema = z.object({
  product_id: z.string().uuid({ message: "Select a product" }),
  scheduled_date: z.string().min(1, { message: "Scheduled date is required" }),
  lot_number: z.string().max(64).optional(),
  notes: z.string().max(1000).optional(),
  work_order_id: z.string().uuid().optional(),
  station_id: z.string().uuid().optional(),
  plan_id: z.string().uuid().optional(),
});

export function NewInspectionDialog({ open, onOpenChange, defaultProductId }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultProductId?: string;
}) {
  const { user } = useSession();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [productId, setProductId] = useState<string | undefined>(defaultProductId);
  const [scheduledDate, setScheduledDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [lot, setLot] = useState("");
  const [notes, setNotes] = useState("");
  const [workOrderId, setWorkOrderId] = useState<string | undefined>();
  const [stationId, setStationId] = useState<string | undefined>();
  const [planId, setPlanId] = useState<string | undefined>();
  const [errs, setErrs] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setProductId(defaultProductId);
      setWorkOrderId(undefined); setStationId(undefined); setPlanId(undefined);
      setErrs({});
    }
  }, [open, defaultProductId]);

  const { data: products } = useQuery({
    queryKey: ["products-active"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("id, sku, name").eq("is_active", true).order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: workOrders } = useQuery({
    queryKey: ["wos-open", productId],
    enabled: open,
    queryFn: async () => {
      let q = supabase.from("work_orders").select("id, number, status, product_id, lot_number")
        .in("status", ["planned", "released", "in_progress"] as any)
        .order("planned_start", { ascending: false, nullsFirst: false }).limit(50);
      if (productId) q = q.eq("product_id", productId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: stations } = useQuery({
    queryKey: ["stations-active"],
    enabled: open,
    queryFn: async () => (await supabase.from("stations").select("id, code, name").eq("is_active", true).order("sequence")).data ?? [],
  });

  const { data: plans } = useQuery({
    queryKey: ["inspection-plans-active", productId],
    enabled: open,
    queryFn: async () => {
      let q = supabase.from("inspection_plans").select("id, name, plan_type, product_id").eq("is_active", true).order("name");
      if (productId) q = q.eq("product_id", productId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  // Auto-fill lot from the chosen WO if user hasn't typed one
  useEffect(() => {
    if (!workOrderId) return;
    const wo = workOrders?.find((w) => w.id === workOrderId);
    if (wo?.lot_number && !lot) setLot(wo.lot_number);
    if (wo?.product_id && !productId) setProductId(wo.product_id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workOrderId]);

  const create = useMutation({
    mutationFn: async () => {
      const parsed = inspectionSchema.safeParse({
        product_id: productId, scheduled_date: scheduledDate,
        lot_number: lot || undefined, notes: notes || undefined,
        work_order_id: workOrderId, station_id: stationId, plan_id: planId,
      });
      if (!parsed.success) {
        const fe: Record<string, string> = {};
        parsed.error.issues.forEach(i => { fe[String(i.path[0])] = i.message; });
        setErrs(fe);
        throw new Error("Please fix the errors");
      }
      setErrs({});
      const { data: spec, error: specErr } = await supabase
        .from("quality_specifications").select("id")
        .eq("product_id", productId!).eq("is_active", true).maybeSingle();
      if (specErr) throw specErr;
      if (!spec) throw new Error("This product has no active specification. Create one first.");
      const chosenPlan = plans?.find((p) => p.id === planId);
      const { data, error } = await supabase.from("inspections").insert({
        product_id: productId!, spec_id: spec.id, scheduled_date: scheduledDate,
        lot_number: lot || null, notes: notes || null, status: "planned",
        performed_by: user?.id ?? null,
        work_order_id: workOrderId ?? null,
        station_id: stationId ?? null,
        plan_id: planId ?? null,
        plan_type: chosenPlan?.plan_type ?? null,
      } as any).select("id").single();
      if (error) {
        const serverFe = parseServerFieldErrors(error);
        if (Object.keys(serverFe).length) setErrs(serverFe);
        throw error;
      }
      await supabase.from("audit_logs").insert({
        user_id: user?.id, action: "inspection.create", entity_type: "inspection", entity_id: data.id,
        details: { source: "ad_hoc", work_order_id: workOrderId ?? null, station_id: stationId ?? null, plan_id: planId ?? null },
      });
      return data.id as string;
    },
    onSuccess: (id) => {
      toast.success("Inspection created");
      qc.invalidateQueries({ queryKey: ["inspections"] });
      onOpenChange(false);
      navigate({ to: "/inspections/$id/execute", params: { id } });
    },
    onError: (e: Error) => notifyError(e.message, { retry: () => create.mutate() }),
  });


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>New Inspection</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Product *</Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
              <SelectContent>
                {products?.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.sku} — {p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errs.product_id && <p className="text-xs text-destructive">{errs.product_id}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Scheduled date *</Label>
            <Input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} />
            {errs.scheduled_date && <p className="text-xs text-destructive">{errs.scheduled_date}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Lot number</Label>
            <Input value={lot} onChange={(e) => setLot(e.target.value)} placeholder="Optional" />
            {errs.lot_number && <p className="text-xs text-destructive">{errs.lot_number}</p>}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Work order</Label>
              <Select value={workOrderId ?? "__none"} onValueChange={(v) => setWorkOrderId(v === "__none" ? undefined : v)}>
                <SelectTrigger><SelectValue placeholder="Ad-hoc (no WO)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Ad-hoc (no WO)</SelectItem>
                  {workOrders?.map((w: any) => (
                    <SelectItem key={w.id} value={w.id}>{w.number} · {w.status}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Station</Label>
              <Select value={stationId ?? "__none"} onValueChange={(v) => setStationId(v === "__none" ? undefined : v)}>
                <SelectTrigger><SelectValue placeholder="Any station" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Any station</SelectItem>
                  {stations?.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>{s.code} — {s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Inspection plan</Label>
            <Select value={planId ?? "__none"} onValueChange={(v) => setPlanId(v === "__none" ? undefined : v)}>
              <SelectTrigger><SelectValue placeholder="No plan" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">No plan</SelectItem>
                {plans?.map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>{p.name} ({p.plan_type})</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">Choose a product first to filter WOs & plans.</p>
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Optional" />
            {errs.notes && <p className="text-xs text-destructive">{errs.notes}</p>}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => create.mutate()} disabled={create.isPending}>
            {create.isPending ? "Creating..." : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

