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
import { useSession } from "@/lib/auth";
import { useNavigate } from "@tanstack/react-router";

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

  useEffect(() => { if (open) setProductId(defaultProductId); }, [open, defaultProductId]);

  const { data: products } = useQuery({
    queryKey: ["products-active"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("id, sku, name").eq("is_active", true).order("name");
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!productId) throw new Error("Select a product");
      const { data: spec, error: specErr } = await supabase
        .from("quality_specifications")
        .select("id")
        .eq("product_id", productId)
        .eq("is_active", true)
        .maybeSingle();
      if (specErr) throw specErr;
      if (!spec) throw new Error("This product has no active specification. Create one first.");
      const { data, error } = await supabase
        .from("inspections")
        .insert({
          product_id: productId,
          spec_id: spec.id,
          scheduled_date: scheduledDate,
          lot_number: lot || null,
          notes: notes || null,
          status: "planned",
          performed_by: user?.id ?? null,
        })
        .select("id")
        .single();
      if (error) throw error;
      await supabase.from("audit_logs").insert({
        user_id: user?.id, action: "inspection.create", entity_type: "inspection", entity_id: data.id,
        details: { source: "ad_hoc" },
      });
      return data.id as string;
    },
    onSuccess: (id) => {
      toast.success("Inspection created");
      qc.invalidateQueries({ queryKey: ["inspections"] });
      onOpenChange(false);
      navigate({ to: "/inspections/$id/execute", params: { id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>New Inspection</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Product</Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
              <SelectContent>
                {products?.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.sku} — {p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Scheduled date</Label>
            <Input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Lot number</Label>
            <Input value={lot} onChange={(e) => setLot(e.target.value)} placeholder="Optional" />
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Optional" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => create.mutate()} disabled={create.isPending || !productId}>
            {create.isPending ? "Creating..." : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
