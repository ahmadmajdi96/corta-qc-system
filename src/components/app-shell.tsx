import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Package, ClipboardCheck, AlertOctagon, Wrench, BarChart3, Settings, LogOut, Plus, User as UserIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMyProfile, useMyRoles, hasAnyRole } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useState, type ReactNode } from "react";
import { NewInspectionDialog } from "@/components/new-inspection-dialog";
import { useQueryClient } from "@tanstack/react-query";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, roles: null },
  { to: "/products", label: "Products", icon: Package, roles: null },
  { to: "/inspections", label: "Inspections", icon: ClipboardCheck, roles: null },
  { to: "/non-conformances", label: "Non-Conformances", icon: AlertOctagon, roles: null },
  { to: "/corrective-actions", label: "Corrective Actions", icon: Wrench, roles: null },
  { to: "/reports", label: "Reports", icon: BarChart3, roles: null },
  { to: "/admin", label: "Administration", icon: Settings, roles: ["administrator"] as const },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: profile } = useMyProfile();
  const { data: roles } = useMyRoles();
  const [showNew, setShowNew] = useState(false);
  const qc = useQueryClient();

  const initials = (profile?.full_name || profile?.email || "?").slice(0, 2).toUpperCase();

  const canCreateInspection = hasAnyRole(roles, "administrator", "quality_manager", "inspector");

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden md:flex w-60 flex-col border-r border-sidebar-border bg-sidebar">
        <div className="px-6 py-5 border-b border-sidebar-border">
          <div className="text-lg font-bold tracking-tight text-sidebar-primary">CORTA QC</div>
          <div className="text-xs text-muted-foreground mt-0.5">Quality Control</div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map((n) => {
            if (n.roles && !n.roles.some((r) => (roles ?? []).includes(r))) return null;
            const active = n.to === "/" ? pathname === "/" : pathname.startsWith(n.to);
            const Icon = n.icon;
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                }`}
              >
                <Icon className="h-4 w-4" />
                {n.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center justify-between h-14 px-6 border-b bg-card">
          <div className="text-sm text-muted-foreground">{profile?.full_name ? `Welcome, ${profile.full_name}` : ""}</div>
          <div className="flex items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  <Avatar className="h-7 w-7"><AvatarFallback>{initials}</AvatarFallback></Avatar>
                  <span className="text-sm">{profile?.full_name || profile?.email}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>{profile?.email}</DropdownMenuLabel>
                <DropdownMenuLabel className="font-normal text-xs text-muted-foreground pt-0">
                  {(roles ?? []).join(", ") || "no role"}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild><Link to="/profile"><UserIcon className="h-4 w-4 mr-2" />Profile</Link></DropdownMenuItem>
                <DropdownMenuItem
                  onClick={async () => {
                    await qc.cancelQueries();
                    qc.clear();
                    await supabase.auth.signOut();
                    window.location.href = "/auth";
                  }}
                >
                  <LogOut className="h-4 w-4 mr-2" />Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
      {canCreateInspection && (
        <Button
          onClick={() => setShowNew(true)}
          className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg"
          size="icon"
          aria-label="New inspection"
        >
          <Plus className="h-6 w-6" />
        </Button>
      )}
      <NewInspectionDialog open={showNew} onOpenChange={setShowNew} />
    </div>
  );
}
