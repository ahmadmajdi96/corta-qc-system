import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ComplianceProfile = {
  id: string;
  code: string;
  name: string;
  require_esig: boolean;
  require_second_person_verification: boolean;
  retention_years: number;
};

type Ctx = {
  profile: ComplianceProfile | null;
  profiles: ComplianceProfile[];
  setProfileId: (id: string) => void;
  isLoading: boolean;
};

const STORAGE_KEY = "corta.compliance_profile_id";
const ComplianceContext = createContext<Ctx | undefined>(undefined);

export function ComplianceProfileProvider({ children }: { children: ReactNode }) {
  const [profileId, setProfileIdState] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(STORAGE_KEY);
  });

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ["compliance_profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("compliance_profiles")
        .select("id, code, name, require_esig, require_second_person_verification, retention_years")
        .order("name");
      if (error) throw error;
      return (data ?? []) as ComplianceProfile[];
    },
  });

  useEffect(() => {
    if (!profileId && profiles.length) setProfileIdState(profiles[0].id);
  }, [profiles, profileId]);

  const setProfileId = (id: string) => {
    setProfileIdState(id);
    try { window.localStorage.setItem(STORAGE_KEY, id); } catch {}
  };

  const value = useMemo<Ctx>(() => ({
    profile: profiles.find((p) => p.id === profileId) ?? null,
    profiles,
    setProfileId,
    isLoading,
  }), [profileId, profiles, isLoading]);

  return <ComplianceContext.Provider value={value}>{children}</ComplianceContext.Provider>;
}

export function useComplianceProfile(): Ctx {
  const ctx = useContext(ComplianceContext);
  if (!ctx) return { profile: null, profiles: [], setProfileId: () => {}, isLoading: false };
  return ctx;
}
