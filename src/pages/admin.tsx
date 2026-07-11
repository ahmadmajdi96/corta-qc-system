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
import { notifyError } from "@/lib/toast";
import { EmptyState } from "@/components/empty-state";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, Plus, Pencil, MoreHorizontal, UserX, UserCheck } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useMyRoles, hasAnyRole } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

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

const USERS_PAGE_SIZE = 20;

function UsersTab() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  // debounce search
  useState(() => { const t = setTimeout(() => setDebounced(search), 300); return () => clearTimeout(t); });
  // simpler: effect-free debounce via useEffect below not needed if we just apply on submit
  // But we want smoothness — inline:
  if (search !== debounced && !(typeof window === "undefined")) {
    // schedule
    setTimeout(() => { setDebounced(search); setPage(0); }, 300);
  }

  const users = useQuery({
    queryKey: ["admin-users", debounced, page],
    queryFn: async () => {
      let q = supabase.from("profiles").select("*, user_roles(role_id, roles(name))", { count: "exact" }).order("created_at", { ascending: false });
      if (debounced) q = q.or(`full_name.ilike.%${debounced}%,email.ilike.%${debounced}%`);
      q = q.range(page * USERS_PAGE_SIZE, page * USERS_PAGE_SIZE + USERS_PAGE_SIZE - 1);
      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: (data ?? []) as any[], count: count ?? 0 };
    },
  });
  const totalPages = Math.max(1, Math.ceil((users.data?.count ?? 0) / USERS_PAGE_SIZE));

  const roles = useQuery({ queryKey: ["roles"], queryFn: async () => (await supabase.from("roles").select("*").order("name")).data ?? [] });

  const setActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("profiles").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Updated"); qc.invalidateQueries({ queryKey: ["admin-users"] }); },
    onError: (e: Error) => notifyError(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Input placeholder="Search name/email" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-md" />
        <Button variant="outline" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-2" />New user</Button>
      </div>
      <div className="rounded-lg border bg-card">
        {users.isLoading ? <Skeleton className="h-32" /> :
         !users.data?.rows.length ? <EmptyState title="No users" /> :
         <>
         <Table>
           <TableHeader><TableRow>
             <TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Roles</TableHead>
             <TableHead>Active</TableHead><TableHead>Last login</TableHead><TableHead>Actions</TableHead>
           </TableRow></TableHeader>
           <TableBody>
             {users.data.rows.map((u) => (
               <TableRow key={u.id}>
                 <TableCell>{u.full_name}</TableCell>
                 <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                 <TableCell>
                   <div className="flex flex-wrap gap-1">
                     {(u.user_roles ?? []).length === 0 && <span className="text-xs text-muted-foreground">— none —</span>}
                     {(u.user_roles ?? []).map((r: any) => (
                       <Badge key={r.role_id} variant="secondary" className="text-xs">{r.roles?.name}</Badge>
                     ))}
                   </div>
                 </TableCell>
                 <TableCell><Switch checked={u.is_active} onCheckedChange={(v) => setActive.mutate({ id: u.id, is_active: v })} /></TableCell>
                 <TableCell className="text-xs">{u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : "—"}</TableCell>
                 <TableCell>
                   <DropdownMenu>
                     <DropdownMenuTrigger asChild>
                       <Button size="icon" variant="ghost" aria-label="Actions"><MoreHorizontal className="h-4 w-4" /></Button>
                     </DropdownMenuTrigger>
                     <DropdownMenuContent align="end">
                       <DropdownMenuItem onClick={() => { setEditing(u); setDialogOpen(true); }}>
                         <Pencil className="h-4 w-4 mr-2" />Edit user & roles
                       </DropdownMenuItem>
                       <DropdownMenuSeparator />
                       {u.is_active ? (
                         <DropdownMenuItem onClick={() => setActive.mutate({ id: u.id, is_active: false })}>
                           <UserX className="h-4 w-4 mr-2" />Deactivate
                         </DropdownMenuItem>
                       ) : (
                         <DropdownMenuItem onClick={() => setActive.mutate({ id: u.id, is_active: true })}>
                           <UserCheck className="h-4 w-4 mr-2" />Reactivate
                         </DropdownMenuItem>
                       )}
                     </DropdownMenuContent>
                   </DropdownMenu>
                 </TableCell>
               </TableRow>
             ))}
           </TableBody>
         </Table>
         <div className="flex items-center justify-between px-4 py-3 border-t text-sm text-muted-foreground">
           <div>{users.data.count} users</div>
           <div className="flex gap-2">
             <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Prev</Button>
             <div className="px-2 py-1">Page {page + 1} of {totalPages}</div>
             <Button variant="outline" size="sm" disabled={page + 1 >= totalPages} onClick={() => setPage(page + 1)}>Next</Button>
           </div>
         </div>
         </>}
      </div>
      <UserDialog open={dialogOpen} onOpenChange={setDialogOpen} initial={editing} roles={(roles.data ?? []) as any[]} onSaved={() => qc.invalidateQueries({ queryKey: ["admin-users"] })} />
      <CreateUserDialog open={createOpen} onOpenChange={setCreateOpen} roles={(roles.data ?? []) as any[]} onCreated={() => qc.invalidateQueries({ queryKey: ["admin-users"] })} />
    </div>
  );
}

function CreateUserDialog({ open, onOpenChange, roles, onCreated }: {
  open: boolean; onOpenChange: (v: boolean) => void; roles: { id: string; name: string }[]; onCreated: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    try {
      const { adminCreateUser } = await import("@/lib/admin.functions");
      await adminCreateUser({ data: { email, password, full_name: fullName, roles: selected } });
      toast.success("User created");
      onCreated(); onOpenChange(false);
      setEmail(""); setPassword(""); setFullName(""); setSelected([]);
    } catch (e: any) { notifyError(e.message ?? "Failed"); } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Create new user</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Full name</Label><Input value={fullName} onChange={e => setFullName(e.target.value)} /></div>
          <div><Label>Email</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} /></div>
          <div><Label>Temporary password (min 8)</Label><Input type="text" value={password} onChange={e => setPassword(e.target.value)} /></div>
          <div>
            <Label>Assign roles</Label>
            <div className="space-y-1 mt-1">
              {roles.map((r) => (
                <label key={r.id} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={selected.includes(r.name)} onCheckedChange={(v) => setSelected(v ? [...selected, r.name] : selected.filter(x => x !== r.name))} />
                  {r.name}
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving || !email || password.length < 8 || !fullName}>{saving ? "Creating..." : "Create user"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
    if (!initial) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("profiles").update({ full_name: fullName }).eq("id", initial.id);
      if (error) throw error;
      await supabase.from("user_roles").delete().eq("user_id", initial.id);
      if (selected.length) {
        await supabase.from("user_roles").insert(selected.map((role_id) => ({ user_id: initial.id, role_id })));
      }
      toast.success("User updated"); onSaved(); onOpenChange(false);
    } catch (e: any) { notifyError(e.message); } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit user</DialogTitle></DialogHeader>
        {initial && (
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
    onError: (e: Error) => notifyError(e.message),
  });

  const [selectedPerms, setSelectedPerms] = useState<string[]>([]);
  function selectRole(id: string) {
    setSelectedRole(id);
    const r = roles.data?.find((x) => x.id === id);
    setSelectedPerms((r?.role_permissions ?? []).map((p: any) => p.permission_id));
  }

  const [addRoleOpen, setAddRoleOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDesc, setNewRoleDesc] = useState("");
  async function addRole() {
    if (!newRoleName.trim()) return;
    const { error } = await supabase.from("roles").insert({ name: newRoleName.trim(), description: newRoleDesc || null });
    if (error) { notifyError(error.message); return; }
    toast.success("Role added"); setAddRoleOpen(false); setNewRoleName(""); setNewRoleDesc("");
    qc.invalidateQueries({ queryKey: ["roles-with-perms"] });
    qc.invalidateQueries({ queryKey: ["roles"] });
  }

  // Ensure `list` and `assign` permission actions exist in the catalogue
  useState(() => {
    (async () => {
      const missing = ["users.assign","corrective_actions.assign","products.list","inspections.list","non_conformances.list","corrective_actions.list","roles.list"];
      for (const key of missing) {
        const [resource, action] = key.split(".");
        await supabase.from("permissions").upsert({ resource, action }, { onConflict: "resource,action" });
      }
    })();
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="space-y-2">
        <Button size="sm" variant="outline" onClick={() => setAddRoleOpen(true)}><Plus className="h-4 w-4 mr-2" />Add role</Button>
        {roles.isLoading ? <Skeleton className="h-32" /> :
         (roles.data ?? []).map((r) => (
          <button key={r.id} onClick={() => selectRole(r.id)}
            className={`w-full text-left rounded border p-3 ${selectedRole === r.id ? "bg-accent border-primary" : "hover:bg-accent/40"}`}>
            <div className="text-sm font-medium">{r.name}</div>
            <div className="text-xs text-muted-foreground">{r.description ?? "—"}</div>
            <div className="text-xs mt-1">{r.user_roles?.length ?? 0} users · {r.role_permissions?.length ?? 0} permissions</div>
          </button>
         ))}
        <Dialog open={addRoleOpen} onOpenChange={setAddRoleOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Add role</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={newRoleName} onChange={e=>setNewRoleName(e.target.value)} placeholder="e.g. senior_inspector" /></div>
              <div><Label>Description</Label><Input value={newRoleDesc} onChange={e=>setNewRoleDesc(e.target.value)} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={()=>setAddRoleOpen(false)}>Cancel</Button>
              <Button onClick={addRole}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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
    if (error) notifyError(error.message);
    else { toast.success("Added"); setNewUnit({ code: "", label: "" }); qc.invalidateQueries({ queryKey: ["units"] }); }
  }
  async function del() {
    if (!confirmDel) return;
    const { error } = await supabase.from(confirmDel.table).delete().eq("id", confirmDel.id);
    if (error) notifyError(error.message);
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
           !(units.data as any[])?.length ? (
             <EmptyState title="No measurement units yet"
               description="Add units like °C, mm, kg so quality specifications can reference them."
               action={<Button size="sm" onClick={() => { setNewUnit({ code: "°C", label: "Celsius" }); }}><Plus className="h-4 w-4 mr-2" />Prefill Celsius</Button>} />
           ) :
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
           !(severities.data as any[])?.length ? (
             <EmptyState title="No severities configured"
               description="Severities (critical, major, minor…) drive NC prioritisation." />
           ) :
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
