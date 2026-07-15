import { useComplianceProfile } from "@/lib/compliance-profile";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ShieldCheck, ChevronDown } from "lucide-react";

export function ComplianceProfileSwitcher() {
  const { profile, profiles, setProfileId } = useComplianceProfile();
  if (!profiles.length) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 h-9">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" />
          <span className="hidden lg:inline text-xs">{profile?.name ?? "Compliance"}</span>
          <span className="lg:hidden text-xs">{profile?.code ?? "—"}</span>
          <ChevronDown className="h-3 w-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Active compliance profile</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {profiles.map((p) => (
          <DropdownMenuItem key={p.id} onClick={() => setProfileId(p.id)} className="flex items-start gap-2">
            <div className="flex-1">
              <div className="text-sm font-medium">{p.name}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {p.code} · retention {p.retention_years}y {p.require_esig ? "· e-sig" : ""} {p.require_second_person_verification ? "· 2nd person" : ""}
              </div>
            </div>
            {profile?.id === p.id && <ShieldCheck className="h-4 w-4 text-primary mt-0.5" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
