import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import { useMyRoles } from "@/lib/auth";

export function ElectronicSignatureDialog({
  open,
  onOpenChange,
  entityType,
  entityId,
  meaning,
  requiredRoles,
  onSigned,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  entityType: string;
  entityId: string;
  meaning: string;
  requiredRoles?: readonly string[];
  onSigned: () => void | Promise<void>;
}) {
  const { data: roles = [] } = useMyRoles();
  const [password, setPassword] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const allowed = !requiredRoles?.length || requiredRoles.some((r) => (roles as string[]).includes(r));

  const submit = async () => {
    if (!allowed) return toast.error("Your role cannot sign this record");
    if (!password) return toast.error("Password required");
    if (!reason) return toast.error("Reason required");
    setBusy(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const email = userData.user?.email;
      if (!email) throw new Error("Not signed in");
      // Verify identity by re-authenticating
      const { error: authErr } = await supabase.auth.signInWithPassword({ email, password });
      if (authErr) throw new Error("Password incorrect");
      const signerRole = (roles as string[])[0] ?? null;
      const { error } = await supabase.from("electronic_signatures").insert({
        entity_type: entityType,
        entity_id: entityId,
        meaning,
        signer_id: userData.user!.id,
        signer_role: signerRole,
        reason,
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 200) : null,
      } as any);
      if (error) throw error;
      toast.success("Electronic signature recorded");
      onOpenChange(false);
      setPassword(""); setReason("");
      await onSigned();
    } catch (e: any) {
      toast.error(e.message ?? "Signature failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" /> Electronic Signature</DialogTitle>
          <DialogDescription>{meaning}</DialogDescription>
        </DialogHeader>
        {!allowed && (
          <div className="rounded-md bg-destructive/10 border border-destructive/40 p-3 text-xs text-destructive">
            Your role ({(roles as string[]).join(", ") || "none"}) is not authorized to sign this action.
            Required: {(requiredRoles ?? []).join(", ")}
          </div>
        )}
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="esig-reason">Reason / meaning</Label>
            <Input id="esig-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Approve disposition per procedure QMS-05" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="esig-pw">Confirm your password</Label>
            <Input id="esig-pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={busy || !allowed}>{busy ? "Signing..." : "Sign"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
