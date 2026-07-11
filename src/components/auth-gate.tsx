import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Redirects to /auth if no session; renders children once ready.
 * Uses a shared react-query cache so navigating between protected routes
 * does NOT re-check auth (no "Loading..." flash / no perceived refresh).
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["auth-user"],
    queryFn: async () => (await supabase.auth.getUser()).data.user ?? null,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  useEffect(() => {
    if (!isLoading && !data) navigate({ to: "/auth", replace: true });
  }, [isLoading, data, navigate]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse text-sm text-muted-foreground">Loading...</div>
      </div>
    );
  }
  if (!data) return null;
  return <>{children}</>;
}
