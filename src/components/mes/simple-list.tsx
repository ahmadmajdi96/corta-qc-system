import { useState, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Loader2, RefreshCw, AlertTriangle } from "lucide-react";
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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const list = useQuery({
    queryKey: [table, "list"],
    queryFn: async () => {
      const { data, error } = await supabase.from(table as any).select(select).order(orderBy, { ascending });
      if (error) throw error;
      return (data ?? []) as unknown as T[];
    },
  });

  function mapServerError(e: any): { field?: string; message: string } {
    const msg = (e?.message as string | undefined) ?? "Save failed";
    const code = e?.code as string | undefined;
    const details = (e?.details as string | undefined) ?? "";
    // Try to extract the offending column from PG messages
    const colMatch =
      /column "([^"]+)"/i.exec(msg) ||
      /column "([^"]+)"/i.exec(details) ||
      /"([a-z0-9_]+)"/i.exec(details);
    const field = colMatch?.[1];
    // Map common PG error codes to friendly, field-scoped messages
    if (code === "23502") return { field, message: `${field ?? "This field"} is required.` };
    if (code === "23505") return { field, message: `That value is already in use.` };
    if (code === "23514") return { field, message: `Value does not meet the required format.` };
    if (code === "23503") return { field, message: `Referenced record does not exist.` };
    if (code === "22P02") return { field, message: `Invalid value format.` };
    if (code === "42501" || /permission|row-level security|rls/i.test(msg)) {
      return { message: "You don't have permission to create this record." };
    }
    return { field, message: msg };
  }

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
      setFieldErrors({});
      setFormError(null);
      qc.invalidateQueries({ queryKey: [table, "list"] });
    },
    onError: (e: any) => {
      const mapped = mapServerError(e);
      if (mapped.field && fields.some((f) => f.name === mapped.field)) {
        setFieldErrors({ [mapped.field]: mapped.message });
        setFormError(null);
      } else {
        setFieldErrors({});
        setFormError(mapped.message);
      }
      notifyError(mapped.message);
    },
  });

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) { setFieldErrors({}); setFormError(null); }
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          {list.data?.length ?? 0} records
        </div>
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2"><Plus className="h-4 w-4" /> New {entityName}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New {entityName}</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              {fields.map((f) => {
                const err = fieldErrors[f.name];
                return (
                  <div key={f.name} className="grid gap-1.5">
                    <Label htmlFor={f.name}>{f.label}{f.required && <span className="text-destructive"> *</span>}</Label>
                    {f.type === "textarea" ? (
                      <textarea
                        id={f.name}
                        className={`min-h-[80px] rounded-md border ${err ? "border-destructive" : "border-input"} bg-background px-3 py-2 text-sm`}
                        value={form[f.name] ?? ""}
                        onChange={(e) => { setForm({ ...form, [f.name]: e.target.value }); if (err) setFieldErrors((p) => { const n = { ...p }; delete n[f.name]; return n; }); }}
                        placeholder={f.placeholder}
                        aria-invalid={!!err}
                      />
                    ) : f.type === "select" ? (
                      <AsyncSelectField field={f} value={form[f.name] ?? ""} invalid={!!err} onChange={(v) => { setForm({ ...form, [f.name]: v }); if (err) setFieldErrors((p) => { const n = { ...p }; delete n[f.name]; return n; }); }} />
                    ) : (
                      <Input
                        id={f.name}
                        type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                        value={form[f.name] ?? ""}
                        onChange={(e) => { setForm({ ...form, [f.name]: e.target.value }); if (err) setFieldErrors((p) => { const n = { ...p }; delete n[f.name]; return n; }); }}
                        placeholder={f.placeholder}
                        aria-invalid={!!err}
                        className={err ? "border-destructive" : ""}
                      />
                    )}
                    {err && <p className="text-xs text-destructive">{err}</p>}
                  </div>
                );
              })}
              {formError && (
                <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive flex items-start gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>Cancel</Button>
              <Button
                onClick={() => {
                  const errs: Record<string, string> = {};
                  for (const f of fields) {
                    if (f.required && !form[f.name]) errs[f.name] = `${f.label} is required`;
                  }
                  if (Object.keys(errs).length) { setFieldErrors(errs); setFormError(null); return; }
                  setFieldErrors({}); setFormError(null);
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

function AsyncSelectField({ field, value, onChange, invalid }: { field: FieldDef; value: string; onChange: (v: string) => void; invalid?: boolean }) {
  const opts = useQuery({
    queryKey: ["field-options", field.name],
    queryFn: async () => (field.loadOptions ? field.loadOptions() : (field.options ?? [])),
    staleTime: 60_000,
    retry: 1,
  });
  const list = opts.data ?? field.options ?? [];
  if (opts.isError) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
        <span className="flex-1">Failed to load options.</span>
        <Button type="button" variant="ghost" size="sm" className="h-6 gap-1 px-2 text-destructive hover:text-destructive"
          onClick={() => opts.refetch()} disabled={opts.isFetching}>
          <RefreshCw className={`h-3 w-3 ${opts.isFetching ? "animate-spin" : ""}`} /> Retry
        </Button>
      </div>
    );
  }
  return (
    <div className="relative">
      <select
        id={field.name}
        className={`h-9 w-full rounded-md border ${invalid ? "border-destructive" : "border-input"} bg-background px-3 pr-8 text-sm`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={opts.isLoading}
        aria-invalid={invalid || undefined}
      >
        <option value="">{opts.isLoading ? "Loading options..." : field.placeholder ?? "— Select —"}</option>
        {list.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {opts.isLoading && (
        <Loader2 className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
      )}
    </div>
  );
}

