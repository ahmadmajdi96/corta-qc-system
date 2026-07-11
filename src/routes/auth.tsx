import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { notifyError } from "@/lib/toast";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — CORTA QC" },
      { name: "description", content: "Sign in to CORTA QC quality control platform." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

const schema = z.object({
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      const f: typeof fieldErrors = {};
      for (const iss of parsed.error.issues) {
        const k = iss.path[0] as "email" | "password";
        if (!f[k]) f[k] = iss.message;
      }
      setFieldErrors(f);
      return;
    }
    setLoading(true);
    try {
      if (mode === "signin") {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) {
          if (err.message.toLowerCase().includes("invalid")) {
            setError("Invalid email or password. Please try again.");
          } else {
            setError(err.message);
          }
          return;
        }
        // Update last_login_at
        const { data: u } = await supabase.auth.getUser();
        if (u.user) await supabase.from("profiles").update({ last_login_at: new Date().toISOString() }).eq("id", u.user.id);
        navigate({ to: "/" });
      } else {
        const emailRedirectTo = typeof window !== "undefined" ? window.location.origin : undefined;
        const { error: err } = await supabase.auth.signUp({
          email, password,
          options: { data: { full_name: fullName || email.split("@")[0] }, emailRedirectTo },
        });
        if (err) { setError(err.message); return; }
        toast.success("Account created. You can now sign in.");
        setMode("signin");
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Network error";
      notifyError(msg, { retry: () => submit(e as unknown as React.FormEvent) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-background to-accent/30">
      <div className="w-full max-w-md bg-card rounded-xl shadow-lg border p-8">
        <div className="text-center mb-6">
          <div className="text-2xl font-bold tracking-tight text-primary">CORTA QC</div>
          <div className="text-sm text-muted-foreground mt-1">Quality Control Platform</div>
        </div>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <form onSubmit={submit} className="space-y-4" noValidate>
          {mode === "signup" && (
            <div className="space-y-1.5">
              <Label htmlFor="fn">Full name</Label>
              <Input id="fn" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Doe" />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="you@company.com" autoComplete="email"
              value={email} onChange={(e) => setEmail(e.target.value)}
              aria-invalid={!!fieldErrors.email} />
            {fieldErrors.email && <p className="text-xs text-destructive">{fieldErrors.email}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input id="password" type={showPass ? "text" : "password"} placeholder="Enter password"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                value={password} onChange={(e) => setPassword(e.target.value)}
                aria-invalid={!!fieldErrors.password} />
              <button type="button" onClick={() => setShowPass((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showPass ? "Hide password" : "Show password"}>
                {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {fieldErrors.password && <p className="text-xs text-destructive">{fieldErrors.password}</p>}
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {mode === "signin" ? "Sign In" : "Create account"}
          </Button>
          {mode === "signin" && (
            <button type="button" disabled className="block mx-auto text-xs text-muted-foreground cursor-not-allowed">
              Forgot password?
            </button>
          )}
          <div className="text-center text-sm text-muted-foreground">
            {mode === "signin" ? (
              <>No account?{" "}
                <button type="button" className="text-primary hover:underline" onClick={() => setMode("signup")}>
                  Create one
                </button>
              </>
            ) : (
              <>Already have an account?{" "}
                <button type="button" className="text-primary hover:underline" onClick={() => setMode("signin")}>
                  Sign in
                </button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
