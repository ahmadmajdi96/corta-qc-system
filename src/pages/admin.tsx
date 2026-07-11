import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, Plus, Pencil } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useMyRoles, hasAnyRole } from "@/lib/auth";
import { EmptyState as _E } from "@/components/empty-state";

export function AdminPage() {
  const { data: roles } = useMyRoles();
  if (!hasAnyRole(roles, "administrator")) {
    return <div className="text-sm text-muted-foreground">You do not have permission to access this page.</div>;
  }
  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Administration</h1>
        <p className="text-sm text-muted-foreground">Manage users, roles and system settings</p>
      </div>
      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="roles">Roles & Permissions</TabsTrigger>
          <TabsTrigger value="settings">System Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="users" className="mt-4"><UsersTab /></TabsContent>
        <TabsContent value="roles" className="mt-4"><RolesTab /></TabsContent>
        <TabsContent value="settings" className="mt-4"><SettingsTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function UsersTab() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const users = useQuery({
    queryKey: ["admin-users", search],
    queryFn: async () => {
      let q = supabase.from("profiles").select("*, user_roles(role_id, roles(name))").order("created_at", { ascending: false });
      if (search) q = q.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data as any[];
    },
  });

  const roles = useQuery({ queryKey: ["roles"], queryFn: async () => (await supabase.from("roles").select("*").order("name")).data ?? [] });

  const setActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("profiles").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Updated"); qc.invalidateQueries({ queryKey: ["admin-users"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Input placeholder="Search name/email" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-md" />
        <Button variant="outline" onClick={() => { setEditing(null); setDialogOpen(true); }}><Plus className="h-4 w-4 mr-2" />Invite user</Button>
      </div>
      <div className="rounded-lg border bg-card">
        {users.isLoading ? <Skeleton className="h-32" /> :
         !users.data?.length ? <EmptyState title="No users" /> :
         <Table>
           <TableHeader><TableRow>
             <TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Roles</TableHead>
             <TableHead>Active</TableHead><TableHead>Last login</TableHead><TableHead>Actions</TableHead>
           </TableRow></TableHeader>
           <TableBody>
             {users.data.map((u) => (
               <TableRow key={u.id}>
                 <TableCell>{u.full_name}</TableCell>
                 <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                 <TableCell><div className="flex flex-wrap gap-1">
                   {(u.user_roles ?? []).map((r: any) => <span key={r.role_id} className="text-xs bg-muted px-2 py-0.5 rounded">{r.roles?.name}</span>)}
                 </div></TableCell>
                 <TableCell><Switch checked={u.is_active} onCheckedChange={(v) => setActive.mutate({ id: u.id, is_active: v })} /></TableCell>
                 <TableCell className="text-xs">{u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : "—"}</TableCell>
                 <TableCell><Button size="sm" variant="ghost" onClick={() => { setEditing(u); setDialogOpen(true); }}><Pencil className="h-4 w-4" /></Button></TableCell>
               </TableRow>
             ))}
           </TableBody>
         </Table>}
      </div>
      <UserDialog open={dialogOpen} onOpenChange={setDialogOpen} initial={editing} roles={(roles.data ?? []) as any[]} onSaved={() => qc.invalidateQueries({ queryKey: ["admin-users"] })} />
    </div>
  );
}

function UserDialog({ open, onOpenChange, initial, roles, onSaved }: {
  open: boolean; onOpenChange: (v: boolean) => void; initial: any;
  roles: { id: string; name: string }[]; onSaved: () => void;
}) {
  const [fullName, setFullName] = useState(initial?.full_name ?? "");
  const [selected, setSelected] = useState<string[]>(initial?.user_roles?.map((r: any) => r.role_id) ?? []);
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!initial) { toast.error("User creation from admin UI is not enabled. Users self-sign-up on /auth."); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from("profiles").update({ full_name: fullName }).eq("id", initial.id);
      if (error) throw error;
      // Replace roles
      await supabase.from("user_roles").delete().eq("user_id", initial.id);
      if (selected.length) {
        await supabase.from("user_roles").insert(selected.map((role_id) => ({ user_id: initial.id, role_id })));
      }
      toast.success("User updated"); onSaved(); onOpenChange(false);
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{initial ? "Edit User" : "Invite User"}</DialogTitle></DialogHeader>
        {!initial ? (
          <div className="text-sm text-muted-foreground">
            New users sign up themselves on the auth page. After signup, edit them here to assign roles.
          </div>
        ) : (
          <div className="space-y-3">
            <div><Label>Full name</Label><Input value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
            <div><Label>Email</Label><Input disabled value={initial.email} /></div>
            <div>
              <Label>Roles</Label>
              <div className="space-y-1 mt-1">
                {roles.map((r) => (
                  <label key={r.id} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={selected.includes(r.id)} onCheckedChange={(v) => setSelected(v ? [...selected, r.id] : selected.filter((x) => x !== r.id))} />
                    {r.name}
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          {initial && <Button onClick={submit} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RolesTab() {
  const qc = useQueryClient();
  const roles = useQuery({ queryKey: ["roles-with-perms"], queryFn: async () => {
    const { data, error } = await supabase.from("roles")
      .select("*, role_permissions(permission_id, permissions(id, resource, action)), user_roles(user_id)");
    if (error) throw error; return data as any[];
  }});
  const perms = useQuery({ queryKey: ["all-perms"], queryFn: async () => (await supabase.from("permissions").select("*").order("resource")).data ?? [] });
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const role = roles.data?.find((r) => r.id === selectedRole);

  const savePerms = useMutation({
    mutationFn: async ({ roleId, permIds }: { roleId: string; permIds: string[] }) => {
      await supabase.from("role_permissions").delete().eq("role_id", roleId);
      if (permIds.length) await supabase.from("role_permissions").insert(permIds.map((permission_id) => ({ role_id: roleId, permission_id })));
    },
    onSuccess: () => { toast.success("Permissions saved"); qc.invalidateQueries({ queryKey: ["roles-with-perms"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const [selectedPerms, setSelectedPerms] = useState<string[]>([]);
  function selectRole(id: string) {
    setSelectedRole(id);
    const r = roles.data?.find((x) => x.id === id);
    setSelectedPerms((r?.role_permissions ?? []).map((p: any) => p.permission_id));
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="space-y-2">
        {roles.isLoading ? <Skeleton className="h-32" /> :
         (roles.data ?? []).map((r) => (
          <button key={r.id} onClick={() => selectRole(r.id)}
            className={`w-full text-left rounded border p-3 ${selectedRole === r.id ? "bg-accent border-primary" : "hover:bg-accent/40"}`}>
            <div className="text-sm font-medium">{r.name}</div>
            <div className="text-xs text-muted-foreground">{r.description ?? "—"}</div>
            <div className="text-xs mt-1">{r.user_roles?.length ?? 0} users · {r.role_permissions?.length ?? 0} permissions</div>
          </button>
         ))}
      </div>
      <div className="md:col-span-2">
        {!role ? <div className="text-sm text-muted-foreground">Select a role to edit its permissions</div> :
         <Card>
           <CardHeader><CardTitle className="text-base">Permissions for {role.name}</CardTitle></CardHeader>
           <CardContent className="space-y-3">
             <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-96 overflow-y-auto">
               {(perms.data ?? []).map((p: any) => (
                 <label key={p.id} className="flex items-center gap-2 text-xs">
                   <Checkbox checked={selectedPerms.includes(p.id)} onCheckedChange={(v) => setSelectedPerms(v ? [...selectedPerms, p.id] : selectedPerms.filter((x) => x !== p.id))} />
                   {p.resource}.{p.action}
                 </label>
               ))}
             </div>
             <Button onClick={() => savePerms.mutate({ roleId: role.id, permIds: selectedPerms })} disabled={savePerms.isPending}>Save</Button>
           </CardContent>
         </Card>}
      </div>
    </div>
  );
}

function SettingsTab() {
  const qc = useQueryClient();
  const units = useQuery({ queryKey: ["units"], queryFn: async () => (await supabase.from("measurement_units").select("*").order("code")).data ?? [] });
  const severities = useQuery({ queryKey: ["severities"], queryFn: async () => (await supabase.from("severities").select("*").order("sort_order")).data ?? [] });
  const [newUnit, setNewUnit] = useState({ code: "", label: "" });
  const [confirmDel, setConfirmDel] = useState<{ table: "measurement_units" | "severities"; id: string } | null>(null);

  async function addUnit() {
    if (!newUnit.code.trim() || !newUnit.label.trim()) return;
    const { error } = await supabase.from("measurement_units").insert(newUnit);
    if (error) toast.error(error.message);
    else { toast.success("Added"); setNewUnit({ code: "", label: "" }); qc.invalidateQueries({ queryKey: ["units"] }); }
  }
  async function del() {
    if (!confirmDel) return;
    const { error } = await supabase.from(confirmDel.table).delete().eq("id", confirmDel.id);
    if (error) toast.error(error.message);
    else { toast.success("Deleted"); qc.invalidateQueries({ queryKey: [confirmDel.table.includes("unit") ? "units" : "severities"] }); }
    setConfirmDel(null);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-base">Measurement Units</CardTitle></CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-3">
            <Input placeholder="Code" value={newUnit.code} onChange={(e) => setNewUnit({ ...newUnit, code: e.target.value })} className="w-24" />
            <Input placeholder="Label" value={newUnit.label} onChange={(e) => setNewUnit({ ...newUnit, label: e.target.value })} />
            <Button onClick={addUnit}><Plus className="h-4 w-4 mr-2" />Add</Button>
          </div>
          {units.isLoading ? <Skeleton className="h-24" /> :
           <table className="w-full text-sm">
             <thead><tr className="text-left border-b"><th className="py-1">Code</th><th>Label</th><th /></tr></thead>
             <tbody>
               {(units.data as any[]).map((u) => (
                 <tr key={u.id} className="border-b">
                   <td className="py-1 font-mono">{u.code}</td><td>{u.label}</td>
                   <td className="text-right"><Button size="icon" variant="ghost" onClick={() => setConfirmDel({ table: "measurement_units", id: u.id })}><Trash2 className="h-4 w-4" /></Button></td>
                 </tr>
               ))}
             </tbody>
           </table>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Severities</CardTitle></CardHeader>
        <CardContent>
          {severities.isLoading ? <Skeleton className="h-24" /> :
           <table className="w-full text-sm">
             <thead><tr className="text-left border-b"><th className="py-1">Code</th><th>Label</th><th>Color</th><th>Order</th></tr></thead>
             <tbody>
               {(severities.data as any[]).map((s) => (
                 <tr key={s.id} className="border-b">
                   <td className="py-1">{s.code}</td><td>{s.label}</td>
                   <td><span className="inline-block h-4 w-4 rounded mr-2" style={{ background: s.color }} />{s.color}</td>
                   <td>{s.sort_order}</td>
                 </tr>
               ))}
             </tbody>
           </table>}
        </CardContent>
      </Card>

      <AlertDialog open={!!confirmDel} onOpenChange={(o) => !o && setConfirmDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this entry?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={del}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
