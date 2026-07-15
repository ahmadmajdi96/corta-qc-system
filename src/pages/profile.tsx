import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMyProfile, useMyRoles, useSession, hasAnyRole } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { notifyError } from "@/lib/toast";
import { Skeleton } from "@/components/ui/skeleton";
import { z } from "zod";
import { Loader2, Lock } from "lucide-react";
import { updateMyEmail, updateMyPassword } from "@/lib/account.functions";

const nameSchema = z.string().trim()
  .min(2, "Full name must be at least 2 characters")
  .max(100, "Full name must be less than 100 characters");
const emailSchema = z.string().trim().email("Invalid email address").max(255);
const passwordSchema = z.string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password must be less than 72 characters");

export function ProfilePage() {
  const { user } = useSession();
  const { data: profile, refetch } = useMyProfile();
  const { data: roles } = useMyRoles();
  const updateEmailFn = useServerFn(updateMyEmail);
  const updatePasswordFn = useServerFn(updateMyPassword);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");

  const [saving, setSaving] = useState(false);
  const [emailSaving, setEmailSaving] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);

  const [nameErr, setNameErr] = useState<string | null>(null);
  const [emailErr, setEmailErr] = useState<string | null>(null);
  const [pwErr, setPwErr] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.full_name) setFullName(profile.full_name);
    if (profile?.email) setEmail(profile.email);
  }, [profile?.full_name, profile?.email]);

  const isAdmin = hasAnyRole(roles, "administrator");
  const canEditEmail = isAdmin; // Only admins may edit their own or others' email here
  const canEditName = true; // All authenticated users can update their own name

  function mapDbError(e: any, field: "name" | "email" | "password"): string {
    const code = e?.code as string | undefined;
    const msg = (e?.message as string | undefined) ?? "";
    if (code === "42501" || /permission denied|row-level security|rls/i.test(msg)) {
      return "You don't have permission to change this. Contact an administrator.";
    }
    if (code === "23514" || /violates check constraint/i.test(msg)) return "Value doesn't meet the required format.";
    if (code === "23505" || /duplicate|already registered|already in use/i.test(msg)) {
      return field === "email" ? "That email is already registered to another account." : "That value is already in use.";
    }
    if (/rate limit/i.test(msg)) return "Too many attempts — please wait a moment and try again.";
    if (field === "email" && /invalid|not.*valid/i.test(msg)) return "That email address is not valid.";
    if (field === "email" && /confirm|verify|verification/i.test(msg)) return "Email verification required — check your inbox.";
    if (field === "password" && /weak|too short|characters/i.test(msg)) return "Password too weak — use at least 8 characters.";
    return msg || "Something went wrong. Please try again.";
  }

  async function saveName() {
    if (!user) return;
    const parsed = nameSchema.safeParse(fullName);
    if (!parsed.success) { setNameErr(parsed.error.issues[0].message); return; }
    setNameErr(null); setSaving(true);
    try {
      const { data, error } = await supabase.from("profiles").update({ full_name: parsed.data }).eq("id", user.id).select("id");
      if (error) throw error;
      if (!data || data.length === 0) throw { code: "42501", message: "No profile row was updated — RLS may be blocking this change." };
      toast.success("Profile saved");
      refetch();
    } catch (e: any) {
      const m = mapDbError(e, "name");
      setNameErr(m);
      notifyError(m);
    } finally { setSaving(false); }
  }

  async function saveEmail() {
    if (!user) return;
    if (!canEditEmail) { setEmailErr("Only administrators can change email."); return; }
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) { setEmailErr(parsed.error.issues[0].message); return; }
    if (parsed.data === profile?.email) { setEmailErr("New email is the same as current."); return; }
    setEmailErr(null); setEmailSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: parsed.data });
      if (error) throw error;
      toast.success("Confirmation link sent — check the new inbox to verify.");
    } catch (e: any) {
      const m = mapDbError(e, "email");
      setEmailErr(m);
      notifyError(m);
    } finally { setEmailSaving(false); }
  }

  async function resendVerification() {
    if (!user?.email) return;
    setResending(true);
    try {
      const { error } = await supabase.auth.resend({ type: "signup", email: user.email });
      if (error) throw error;
      toast.success(`Verification email sent to ${user.email}`);
    } catch (e: any) {
      const msg = /rate limit/i.test(e?.message ?? "")
        ? "Too many attempts — please wait a moment and try again."
        : e?.message ?? "Failed to send verification email.";
      toast.error(msg);
    } finally { setResending(false); }
  }

  async function changePassword() {
    setPwErr(null);
    const parsed = passwordSchema.safeParse(pwNew);
    if (!parsed.success) { setPwErr(parsed.error.issues[0].message); return; }
    if (pwNew !== pwConfirm) { setPwErr("Passwords do not match"); return; }
    if (!pwCurrent) { setPwErr("Enter your current password"); return; }
    setPwSaving(true);
    try {
      const { error: reAuthErr } = await supabase.auth.signInWithPassword({ email: user!.email!, password: pwCurrent });
      if (reAuthErr) throw new Error("Current password is incorrect");
      const { error } = await supabase.auth.updateUser({ password: parsed.data });
      if (error) throw error;
      toast.success("Password updated");
      setPwCurrent(""); setPwNew(""); setPwConfirm("");
    } catch (e: any) {
      setPwErr(mapDbError(e, "password"));
    } finally { setPwSaving(false); }
  }


  if (!profile) return <Skeleton className="h-64 max-w-2xl" />;
  const rolesArr = roles ?? [];

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">My Profile</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {rolesArr.length ? rolesArr.map((r) => (
            <span key={r} className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium capitalize">
              {r.replace(/_/g, " ")}
            </span>
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
            <Input
              value={fullName}
              onChange={(e) => { setFullName(e.target.value); if (nameErr) setNameErr(null); }}
              maxLength={100}
              aria-invalid={!!nameErr}
              disabled={!canEditName || saving}
            />
            {nameErr && <p className="mt-1 text-xs text-destructive">{nameErr}</p>}
            <Button
              className="mt-2 gap-2"
              onClick={saveName}
              disabled={saving || fullName.trim() === (profile.full_name ?? "").trim()}
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {saving ? "Saving..." : "Save name"}
            </Button>
          </div>

          <div>
            <Label className="flex items-center gap-1.5">
              Email
              {!canEditEmail && <Lock className="h-3 w-3 text-muted-foreground" />}
              {emailVerified ? (
                <span className="ml-1 inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success">
                  <MailCheck className="h-3 w-3" /> Verified
                </span>
              ) : user?.email ? (
                <span className="ml-1 inline-flex items-center gap-1 rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-[10px] font-medium text-warning">
                  <MailWarning className="h-3 w-3" /> Unverified
                </span>
              ) : null}
            </Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); if (emailErr) setEmailErr(null); }}
              maxLength={255}
              aria-invalid={!!emailErr}
              disabled={!canEditEmail || emailSaving}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {canEditEmail
                ? "Changing your email sends a confirmation link to the new address."
                : "Email changes require an administrator. Contact your admin to update."}
            </p>
            {emailErr && <p className="mt-1 text-xs text-destructive">{emailErr}</p>}
            <div className="mt-2 flex flex-wrap gap-2">
              {canEditEmail && (
                <Button
                  className="gap-2"
                  onClick={saveEmail}
                  disabled={emailSaving || email.trim() === (profile.email ?? "").trim()}
                >
                  {emailSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {emailSaving ? "Sending..." : "Update email"}
                </Button>
              )}
              {!emailVerified && user?.email && (
                <Button variant="outline" className="gap-2" onClick={resendVerification} disabled={resending}>
                  {resending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MailCheck className="h-3.5 w-3.5" />}
                  {resending ? "Sending..." : "Resend verification email"}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Change Password</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Current password</Label>
            <Input type="password" value={pwCurrent} onChange={(e) => setPwCurrent(e.target.value)} disabled={pwSaving} />
          </div>
          <div>
            <Label>New password</Label>
            <Input type="password" value={pwNew} onChange={(e) => setPwNew(e.target.value)} disabled={pwSaving} minLength={8} maxLength={72} />
          </div>
          <div>
            <Label>Confirm new password</Label>
            <Input type="password" value={pwConfirm} onChange={(e) => setPwConfirm(e.target.value)} disabled={pwSaving} />
          </div>
          {pwErr && <p className="text-xs text-destructive">{pwErr}</p>}
          <Button onClick={changePassword} disabled={pwSaving || !pwCurrent || !pwNew || !pwConfirm} className="gap-2">
            {pwSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {pwSaving ? "Updating..." : "Update password"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function AvatarUpload({ profile, refetch }: { profile: any; refetch: () => void }) {
  const { user } = useSession();
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function upload(file: File) {
    if (!user) return;
    if (!/^image\//.test(file.type)) { setErr("File must be an image"); return; }
    if (file.size > 5 * 1024 * 1024) { setErr("Image must be under 5 MB"); return; }
    setErr(null); setUploading(true);
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
    } catch (e: any) {
      setErr(e.message ?? "Upload failed");
      notifyError(e.message ?? "Upload failed");
    } finally { setUploading(false); }
  }
  return (
    <div>
      <div className="flex items-center gap-4">
        <div className="h-16 w-16 rounded-full bg-muted overflow-hidden flex items-center justify-center text-lg font-semibold text-muted-foreground">
          {profile.avatar_url
            ? <img src={profile.avatar_url} alt="avatar" className="h-full w-full object-cover" />
            : (profile.full_name?.[0] ?? "?").toUpperCase()}
        </div>
        <label className="inline-flex items-center gap-2 cursor-pointer text-sm">
          <span className="rounded border px-3 py-1.5 hover:bg-accent inline-flex items-center gap-2">
            {uploading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {uploading ? "Uploading..." : "Change photo"}
          </span>
          <input type="file" accept="image/*" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} disabled={uploading} />
        </label>
      </div>
      {err && <p className="mt-2 text-xs text-destructive">{err}</p>}
    </div>
  );
}
