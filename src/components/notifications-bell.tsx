import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Bell, CheckCheck } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { Link } from "@tanstack/react-router";
import { useEffect } from "react";

type Notif = {
  id: string;
  category: string | null;
  severity: string | null;
  title: string;
  body: string | null;
  action_url: string | null;
  read_at: string | null;
  created_at: string;
};

export function NotificationsBell() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications" as any)
        .select("id, category, severity, title, body, action_url, read_at, created_at")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as unknown as Notif[];
    },
    refetchInterval: 60_000,
  });

  useEffect(() => {
    const ch = supabase
      .channel("notifications-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, () => {
        qc.invalidateQueries({ queryKey: ["notifications"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const markAll = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("notifications" as any)
        .update({ read_at: new Date().toISOString() } as any)
        .is("read_at", null);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const items = q.data ?? [];
  const unread = items.filter((n) => !n.read_at).length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="relative grid h-9 w-9 place-items-center rounded-lg border border-border/60 bg-card/60 text-muted-foreground transition hover:text-foreground" aria-label="Notifications">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute right-1 top-1 min-w-[16px] h-4 rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground grid place-items-center px-1">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96 max-h-[70vh] overflow-y-auto p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b sticky top-0 bg-popover">
          <div className="text-sm font-semibold">Notifications</div>
          {unread > 0 && (
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => markAll.mutate()}>
              <CheckCheck className="h-3.5 w-3.5 mr-1" /> Mark all read
            </Button>
          )}
        </div>
        {items.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">No notifications yet.</div>
        ) : (
          <ul>
            {items.map((n) => {
              const inner = (
                <div className={`px-3 py-2 border-b hover:bg-muted/50 ${n.read_at ? "" : "bg-primary/5"}`}>
                  <div className="flex items-start gap-2">
                    <span className={`mt-1.5 inline-block h-1.5 w-1.5 rounded-full ${n.severity === "high" ? "bg-destructive" : n.severity === "warning" ? "bg-amber-500" : "bg-primary"}`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{n.title}</div>
                      {n.body && <div className="text-xs text-muted-foreground line-clamp-2">{n.body}</div>}
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })} · {n.category ?? "info"}
                      </div>
                    </div>
                  </div>
                </div>
              );
              return (
                <li key={n.id}>
                  {n.action_url ? <Link to={n.action_url as any}>{inner}</Link> : inner}
                </li>
              );
            })}
          </ul>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
