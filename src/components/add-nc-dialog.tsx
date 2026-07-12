import { useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { notifyError, parseServerFieldErrors } from "@/lib/toast";
import { z } from "zod";

const schema = z.object({
  description: z.string().min(3, "Describe the issue"),
  severity: z.enum(["critical","major","minor"]),
  product_id: z.string().uuid().optional(),
  category: z.string().optional(),
  disposition: z.enum(["scrap","rework","repair","return_to_vendor","use_as_is"]).optional(),
  root_cause_category: z.enum(["human","equipment","material","process"]).optional(),
});

/** Standalone NC dialog for the board's manual "+ Add NC". */
export function AddNcDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<"critical"|"major"|"minor">("minor");
  const [productId, setProductId] = useState<string>("");
  const [category, setCategory] = useState("");
  const [disposition, setDisposition] = useState<string>("");
  const [rootCause, setRootCause] = useState<string>("");
  const [errs, setErrs] = useState<Record<string,string>>({});

  const products = useQuery({ queryKey: ["nc-products"], queryFn: async () =>
    (await supabase.from("products").select("id, name, sku").eq("is_active", true).order("name")).data ?? []
  });

  const mut = useMutation({
    mutationFn: async () => {
      const parsed = schema.safeParse({
        description, severity,
        product_id: productId || undefined,
        category: category || undefined,
        disposition: (disposition || undefined) as any,
        root_cause_category: (rootCause || undefined) as any,
      });
      if (!parsed.success) {
        const fe: Record<string,string> = {};
        parsed.error.issues.forEach(i => { fe[String(i.path[0])] = i.message; });
        setErrs(fe); throw new Error("Please fix the errors");
      }
      setErrs({});
      const { data: user } = await supabase.auth.getUser();
      const { error } = await supabase.from("non_conformances").insert({
        description, severity, category: category || null,
        disposition: disposition || null,
        root_cause_category: rootCause || null,
        raised_by: user.user!.id, status: "open",
      } as any);
      if (error) {
        const serverFe = parseServerFieldErrors(error);
        if (Object.keys(serverFe).length) setErrs(serverFe);
        throw error;
      }
    },
    onSuccess: () => {
      toast.success("Non-conformance created");
      qc.invalidateQueries({ queryKey: ["nc-board"] });
      qc.invalidateQueries({ queryKey: ["ncs"] });
      setDescription(""); setSeverity("minor"); setProductId(""); setCategory("");
      setDisposition(""); setRootCause("");
      onOpenChange(false);
    },
    onError: (e: Error) => notifyError(e.message, { retry: () => mut.mutate() }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add Non-Conformance</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Description *</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} />
            {errs.description && <p className="text-xs text-destructive mt-1">{errs.description}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Severity *</Label>
              <Select value={severity} onValueChange={v => setSeverity(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="major">Major</SelectItem>
                  <SelectItem value="minor">Minor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Category</Label>
              <Input value={category} onChange={e => setCategory(e.target.value)} placeholder="e.g. Contamination" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Root cause category</Label>
              <Select value={rootCause || "__none"} onValueChange={v => setRootCause(v === "__none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">—</SelectItem>
                  <SelectItem value="human">Human error</SelectItem>
                  <SelectItem value="equipment">Equipment malfunction</SelectItem>
                  <SelectItem value="material">Material defect</SelectItem>
                  <SelectItem value="process">Process variation</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Disposition</Label>
              <Select value={disposition || "__none"} onValueChange={v => setDisposition(v === "__none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">—</SelectItem>
                  <SelectItem value="scrap">Scrap</SelectItem>
                  <SelectItem value="rework">Rework</SelectItem>
                  <SelectItem value="repair">Repair</SelectItem>
                  <SelectItem value="return_to_vendor">Return to vendor</SelectItem>
                  <SelectItem value="use_as_is">Use as-is</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Product (optional)</Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger><SelectValue placeholder="Choose product" /></SelectTrigger>
              <SelectContent>
                {(products.data ?? []).map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>{p.sku} — {p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>{mut.isPending ? "Creating..." : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
