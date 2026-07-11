import { useEffect, useState } from "react";
import { useMyProfile, useMyRoles, useSession } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { notifyError } from "@/lib/toast";
import { Skeleton } from "@/components/ui/skeleton";

export function ProfilePage() {
  const { user } = useSession();
  const { data: profile, refetch } = useMyProfile();
  const { data: roles } = useMyRoles();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [emailSaving, setEmailSaving] = useState(false);
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwSaving, setPwSaving] = useState(false);

  useEffect(() => {
    if (profile?.full_name) setFullName(profile.full_name);
    if (profile?.email) setEmail(profile.email);
  }, [profile?.full_name, profile?.email]);

  async function saveName() {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("profiles").update({ full_name: fullName }).eq("id", user.id);
      if (error) throw error;
      toast.success("Profile saved");
      refetch();
    } catch (e: any) { notifyError(e.message); } finally { setSaving(false); }
  }

  async function saveEmail() {
    if (!user) return;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { notifyError("Invalid email"); return; }
    if (email === profile?.email) return;
    setEmailSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ email });
      if (error) throw error;
      toast.success("Confirmation sent to new email address");
    } catch (e: any) { notifyError(e.message); } finally { setEmailSaving(false); }
  }

  async function changePassword() {
    if (pwNew.length < 8) { notifyError("New password must be at least 8 characters"); return; }
    if (pwNew !== pwConfirm) { notifyError("Passwords do not match"); return; }
    setPwSaving(true);
    try {
      const { error: reAuthErr } = await supabase.auth.signInWithPassword({ email: user!.email!, password: pwCurrent });
      if (reAuthErr) throw new Error("Current password is incorrect");
      const { error } = await supabase.auth.updateUser({ password: pwNew });
      if (error) throw error;
      toast.success("Password updated");
      setPwCurrent(""); setPwNew(""); setPwConfirm("");
    } catch (e: any) { notifyError(e.message); } finally { setPwSaving(false); }
  }

  if (!profile) return <Skeleton className="h-64 max-w-2xl" />;
  const rolesArr = roles ?? [];
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">My Profile</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {rolesArr.length ? rolesArr.map((r) => (
            <span key={r} className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium capitalize">{r.replace(/_/g, " ")}</span>
          )) : <span className="text-xs text-muted-foreground">No role assigned</span>}
        </div>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Account</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <AvatarUpload profile={profile} refetch={refetch} />
          <div>
            <Label>User ID</Label>
            <Input value={user?.id ?? ""} disabled className="font-mono text-xs" />
          </div>
          <div>
            <Label>Full name</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
            <Button className="mt-2" onClick={saveName} disabled={saving || fullName === (profile.full_name ?? "")}>
              {saving ? "Saving..." : "Save name"}
            </Button>
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <p className="mt-1 text-xs text-muted-foreground">Changing your email sends a confirmation link to the new address.</p>
            <Button className="mt-2" onClick={saveEmail} disabled={emailSaving || email === (profile.email ?? "")}>
              {emailSaving ? "Sending..." : "Update email"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Change Password</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div><Label>Current password</Label><Input type="password" value={pwCurrent} onChange={(e) => setPwCurrent(e.target.value)} /></div>
          <div><Label>New password</Label><Input type="password" value={pwNew} onChange={(e) => setPwNew(e.target.value)} /></div>
          <div><Label>Confirm new password</Label><Input type="password" value={pwConfirm} onChange={(e) => setPwConfirm(e.target.value)} /></div>
          <Button onClick={changePassword} disabled={pwSaving || !pwCurrent || !pwNew}>{pwSaving ? "Updating..." : "Update password"}</Button>
        </CardContent>
      </Card>
    </div>
  );
}

function AvatarUpload({ profile, refetch }: { profile: any; refetch: () => void }) {
  const { user } = useSession();
  const [uploading, setUploading] = useState(false);
  async function upload(file: File) {
    if (!user) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = await supabase.storage.from("avatars").createSignedUrl(path, 60 * 60 * 24 * 365);
      const url = data?.signedUrl ?? "";
      const { error: e2 } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", user.id);
      if (e2) throw e2;
      toast.success("Avatar updated"); refetch();
    } catch (e: any) { notifyError(e.message ?? "Upload failed"); }
    finally { setUploading(false); }
  }
  return (
    <div className="flex items-center gap-4">
      <div className="h-16 w-16 rounded-full bg-muted overflow-hidden flex items-center justify-center text-lg font-semibold text-muted-foreground">
        {profile.avatar_url ? <img src={profile.avatar_url} alt="avatar" className="h-full w-full object-cover" /> : (profile.full_name?.[0] ?? "?").toUpperCase()}
      </div>
      <label className="inline-flex items-center gap-2 cursor-pointer text-sm">
        <span className="rounded border px-3 py-1.5 hover:bg-accent">{uploading ? "Uploading..." : "Change photo"}</span>
        <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} />
      </label>
    </div>
  );
}
