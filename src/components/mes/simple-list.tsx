import { useState, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { toast } from "sonner";
import { notifyError } from "@/lib/toast";

export type SelectOption = { value: string; label: string };

export type FieldDef = {
  name: string;
  label: string;
  type?: "text" | "number" | "date" | "textarea" | "select";
  required?: boolean;
  placeholder?: string;
  options?: SelectOption[];
  loadOptions?: () => Promise<SelectOption[]>;
};


export type ColumnDef<T> = {
  key: string;
  label: string;
  render?: (row: T) => ReactNode;
};

export function SimpleList<T extends { id: string }>({
  table,
  columns,
  fields,
  select = "*",
  orderBy = "created_at",
  ascending = false,
  entityName,
  emptyIcon,
  transformCreate,
  extraActions,
}: {
  table: string;
  columns: ColumnDef<T>[];
  fields: FieldDef[];
  select?: string;
  orderBy?: string;
  ascending?: boolean;
  entityName: string;
  emptyIcon?: ReactNode;
  transformCreate?: (v: Record<string, any>) => Record<string, any>;
  extraActions?: (row: T) => ReactNode;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  const list = useQuery({
    queryKey: [table, "list"],
    queryFn: async () => {
      const { data, error } = await supabase.from(table as any).select(select).order(orderBy, { ascending });
      if (error) throw error;
      return (data ?? []) as unknown as T[];
    },
  });

  const create = useMutation({
    mutationFn: async (v: Record<string, string>) => {
      const payload: Record<string, any> = {};
      for (const f of fields) {
        const val = v[f.name];
        if (val === undefined || val === "") continue;
        payload[f.name] = f.type === "number" ? Number(val) : val;
      }
      const finalPayload = transformCreate ? transformCreate(payload) : payload;
      const { error } = await supabase.from(table as any).insert(finalPayload as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`${entityName} created`);
      setOpen(false);
      setForm({});
      qc.invalidateQueries({ queryKey: [table, "list"] });
    },
    onError: (e) => notifyError(e),
  });

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          {list.data?.length ?? 0} records
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2"><Plus className="h-4 w-4" /> New {entityName}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New {entityName}</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              {fields.map((f) => (
                <div key={f.name} className="grid gap-1.5">
                  <Label htmlFor={f.name}>{f.label}{f.required && <span className="text-destructive"> *</span>}</Label>
                  {f.type === "textarea" ? (
                    <textarea
                      id={f.name}
                      className="min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={form[f.name] ?? ""}
                      onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                      placeholder={f.placeholder}
                    />
                  ) : f.type === "select" ? (
                    <AsyncSelectField field={f} value={form[f.name] ?? ""} onChange={(v) => setForm({ ...form, [f.name]: v })} />
                  ) : (
                    <Input
                      id={f.name}
                      type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                      value={form[f.name] ?? ""}
                      onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                      placeholder={f.placeholder}
                    />
                  )}
                </div>
              ))}

            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button
                onClick={() => {
                  for (const f of fields) {
                    if (f.required && !form[f.name]) {
                      toast.error(`${f.label} is required`);
                      return;
                    }
                  }
                  create.mutate(form);
                }}
                disabled={create.isPending}
              >{create.isPending ? "Saving..." : "Create"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {list.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
        </div>
      ) : !list.data?.length ? (
        <EmptyState
          icon={emptyIcon}
          title={`No ${entityName.toLowerCase()}s yet`}
          description={`Create the first ${entityName.toLowerCase()} to get started.`}
          action={<Button size="sm" onClick={() => setOpen(true)} className="gap-2"><Plus className="h-4 w-4" /> New {entityName}</Button>}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((c) => <TableHead key={c.key}>{c.label}</TableHead>)}
                {extraActions && <TableHead className="w-[1%]" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.data.map((row) => (
                <TableRow key={row.id}>
                  {columns.map((c) => (
                    <TableCell key={c.key}>
                      {c.render ? c.render(row) : String((row as any)[c.key] ?? "—")}
                    </TableCell>
                  ))}
                  {extraActions && <TableCell className="text-right">{extraActions(row)}</TableCell>}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
