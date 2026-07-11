import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { notifyError } from "@/lib/toast";
import { useSession } from "@/lib/auth";

export function RaiseNcDialog({ open, onOpenChange, inspectionId, measurement, onCreated }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  inspectionId: string; measurement?: any;
  onCreated: (ncId: string) => void;
}) {
  const { user } = useSession();
  const [severity, setSeverity] = useState<"critical" | "major" | "minor">("major");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState(
    measurement ? `Out-of-spec on "${measurement.spec_item?.name}": measured ${measurement.measured_value}` : ""
  );
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!description.trim()) { notifyError("Description required"); return; }
    setSaving(true);
    try {
      const { data, error } = await supabase.from("non_conformances").insert({
        inspection_id: inspectionId,
        measurement_id: measurement?.id ?? null,
        severity, category: category || null, description,
        raised_by: user!.id,
        number: "", // filled by trigger
      } as any).select("id").single();
      if (error) throw error;
      await supabase.from("audit_logs").insert({
        user_id: user!.id, action: "nc.raised", entity_type: "non_conformance", entity_id: data.id,
        details: { severity, inspection_id: inspectionId },
      });
      toast.success("Non-conformance raised");
      onCreated(data.id);
    } catch (e: any) { notifyError(e.message); } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Raise Non-Conformance</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Severity</Label>
            <Select value={severity} onValueChange={(v) => setSeverity(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="major">Major</SelectItem>
                <SelectItem value="minor">Minor</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Category (optional)</Label>
            <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="microbiological, physical, process..." />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving || !description.trim()}>{saving ? "Saving..." : "Raise NC"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
