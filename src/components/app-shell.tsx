import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Package,
  ClipboardCheck,
  AlertOctagon,
  Wrench,
  BarChart3,
  Settings,
  LogOut,
  Plus,
  User as UserIcon,
  Factory,
  Radio,
  Cpu,
  ShieldCheck,
  ListChecks,
  History,
  Gauge,
  Truck,
  ScrollText,
  Activity,
  Bell,
  Search,
  ChevronRight,
  FileSearch,
  Inbox,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMyProfile, useMyRoles, hasAnyRole } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { useState, type ReactNode } from "react";
import { NewInspectionDialog } from "@/components/new-inspection-dialog";
import { useQueryClient } from "@tanstack/react-query";

type Role = "administrator" | "quality_manager" | "qc_engineer" | "inspector" | "auditor" | "viewer";
type NavItem = { title: string; url: string; icon: typeof LayoutDashboard; roles?: readonly Role[] };

const operations: NavItem[] = [
  { title: "Control Center", url: "/", icon: LayoutDashboard },
  { title: "Live Floor", url: "/live", icon: Radio },
  { title: "Work Orders", url: "/work-orders", icon: ScrollText },
  { title: "Requests", url: "/requests", icon: Inbox },
];

const quality: NavItem[] = [
  { title: "Inspections", url: "/inspections", icon: ClipboardCheck },
  { title: "Inspection Plans", url: "/inspection-plans", icon: ListChecks },
  { title: "Non-Conformances", url: "/non-conformances", icon: AlertOctagon },
  { title: "Corrective Actions", url: "/corrective-actions", icon: Wrench },
  { title: "CAPA (8D)", url: "/capa", icon: FileSearch, roles: ["administrator", "quality_manager", "qc_engineer"] as const },
  { title: "Quality Holds", url: "/holds", icon: ShieldCheck },
  { title: "SPC / Control Charts", url: "/spc", icon: Activity },
  { title: "Calibration", url: "/calibration", icon: Gauge },
];

const masterData: NavItem[] = [
  { title: "Products", url: "/products", icon: Package },
  { title: "Production Lines", url: "/lines", icon: Factory },
  { title: "Stations", url: "/stations", icon: Cpu },
  { title: "Suppliers", url: "/suppliers", icon: Truck },
  { title: "Incoming Lots", url: "/incoming", icon: Truck },
];

const admin: NavItem[] = [
  { title: "Reports", url: "/reports", icon: BarChart3 },
  { title: "Administration", url: "/admin", icon: Settings, roles: ["administrator"] as const },
  { title: "Audit Log", url: "/admin", icon: History, roles: ["administrator", "auditor"] as const },
];

function AppSidebar({ roles }: { roles: readonly string[] }) {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const isActive = (url: string) => (url === "/" ? path === "/" : path.startsWith(url));

  const allowed = (item: NavItem) =>
    !item.roles || item.roles.some((r) => roles.includes(r));

  const renderGroup = (label: string, items: NavItem[]) => {
    const visible = items.filter(allowed);
    if (!visible.length) return null;
    return (
      <SidebarGroup>
        <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">
          {label}
        </SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {visible.map((item) => {
              const active = isActive(item.url);
              return (
                <SidebarMenuItem key={`${label}-${item.title}`}>
                  <SidebarMenuButton
                    asChild
                    isActive={active}
                    className="data-[active=true]:bg-primary/10 data-[active=true]:text-primary data-[active=true]:border data-[active=true]:border-primary/30 rounded-lg h-10"
                  >
                    <Link to={item.url} className="flex items-center gap-3">
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="p-4">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary to-info text-primary-foreground shadow-[var(--shadow-glow)]">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="flex min-w-0 flex-col leading-tight group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-semibold tracking-tight">CORTA QC</span>
            <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              MES · Quality Suite
            </span>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent className="px-2">
        {renderGroup("Operations", operations)}
        {renderGroup("Quality", quality)}
        {renderGroup("Master Data", masterData)}
        {renderGroup("Admin", admin)}
      </SidebarContent>
      <SidebarFooter className="p-3">
        <div className="rounded-xl border border-border/60 bg-card/60 p-3 group-data-[collapsible=icon]:hidden">
          <div className="flex items-center gap-2 text-xs">
            <span className="status-dot animate-pulse-glow text-success" />
            <span className="font-medium">System online</span>
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">
            All quality gates active
          </p>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

function TopBar({
  profile,
  roles,
  onSignOut,
}: {
  profile: { full_name?: string | null; email?: string | null } | undefined;
  roles: string[];
  onSignOut: () => void | Promise<void>;
}) {
  const initials = (profile?.full_name || profile?.email || "?").slice(0, 2).toUpperCase();
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border/60 bg-background/70 px-4 backdrop-blur-xl">
      <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
      <div className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
        <span>Quality</span>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground">Plant · Live</span>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <div className="relative hidden md:block">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            placeholder="Search WO, lot, NC, gage…"
            className="h-9 w-64 rounded-lg border border-border/60 bg-card/60 pl-8 pr-3 text-sm placeholder:text-muted-foreground/60 focus:border-primary/50 focus:outline-none"
          />
        </div>
        <NotificationsBell />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2 h-9 rounded-lg border border-border/60 bg-card/60 px-2">
              <div className="grid h-6 w-6 place-items-center rounded-md bg-gradient-to-br from-primary to-info text-[10px] font-bold text-primary-foreground">
                {initials}
              </div>
              <div className="hidden text-xs leading-tight sm:block text-left">
                <div className="font-medium">{profile?.full_name || profile?.email}</div>
                <div className="text-[10px] text-muted-foreground truncate max-w-[140px]">
                  {roles.join(", ") || "no role"}
                </div>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{profile?.email}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/profile">
                <UserIcon className="h-4 w-4 mr-2" />Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => void onSignOut()}>
              <LogOut className="h-4 w-4 mr-2" />Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { data: profile } = useMyProfile();
  const { data: roles } = useMyRoles();
  const [showNew, setShowNew] = useState(false);
  const qc = useQueryClient();

  const rolesArr = (roles ?? []) as string[];
  const canCreateInspection = hasAnyRole(roles, "administrator", "quality_manager", "inspector");

  const onSignOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    window.location.href = "/auth";
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar roles={rolesArr} />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar profile={profile ?? undefined} roles={rolesArr} onSignOut={onSignOut} />
          <main className="flex-1 p-4 sm:p-6">{children}</main>
        </div>
      </div>
      {canCreateInspection && (
        <Button
          onClick={() => setShowNew(true)}
          className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-[var(--shadow-glow)] bg-gradient-to-br from-primary to-info"
          size="icon"
          aria-label="New inspection"
        >
          <Plus className="h-6 w-6" />
        </Button>
      )}
      <NewInspectionDialog open={showNew} onOpenChange={setShowNew} />
    </SidebarProvider>
  );
}
