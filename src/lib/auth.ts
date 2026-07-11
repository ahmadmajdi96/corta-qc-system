import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";

export type RoleName = "administrator" | "quality_manager" | "inspector" | "auditor" | "viewer";

export function useSession() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);
  return { user, loading };
}

export function useMyRoles() {
  const { user } = useSession();
  return useQuery({
    queryKey: ["my-roles", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<RoleName[]> => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role_id, roles(name)")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? []).map((r: any) => r.roles?.name).filter(Boolean) as RoleName[];
    },
  });
}

export function hasAnyRole(roles: RoleName[] | undefined, ...check: RoleName[]) {
  if (!roles) return false;
  return roles.some((r) => check.includes(r));
}

export function useMyProfile() {
  const { user } = useSession();
  return useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}
