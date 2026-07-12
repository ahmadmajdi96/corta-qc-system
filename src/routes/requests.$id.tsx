import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AuthGate } from "@/components/auth-gate";
import { AppShell } from "@/components/app-shell";
import { MesPage, StatusPill } from "@/components/mes/mes-page";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Inbox, CheckCircle2, XCircle, PlayCircle, Loader2, Package, Factory, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMyRoles, useSession, hasAnyRole } from "@/lib/auth";
import { useState } from "react";
import { notifyError, notifySuccess } from "@/lib/toast";

function statusTone(s: string): "success" | "warning" | "danger" | "info" | "muted" {
  if (s === "approved" || s === "completed") return "success";
  if (s === "rejected" || s === "cancelled") return "danger";
  if (s === "in_review") return "info";
  return "warning";
}

function RequestDetail({ id }: { id: string }) {
  const { user } = useSession();
  const { data: roles } = useMyRoles();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const isQC = hasAnyRole(roles, "administrator", "quality_manager", "qc_engineer");

  const req = useQuery({
    queryKey: ["request", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("requests")
        .select(
          "*, requester:profiles!requests_requester_id_fkey(full_name,email), assignee:profiles!requests_assignee_id_fkey(full_name,email), result_product:products(id, sku, name)"
        )
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const stations = useQuery({
    queryKey: ["stations-map"],
    queryFn: async () => {
      const { data, error } = await supabase.from("stations").select("id, code, name, station_type, production_lines(name)");
      if (error) throw error;
      const m = new Map<string, any>();
      for (const s of data ?? []) m.set(s.id, s);
      return m;
    },
  });

  const events = useQuery({
    queryKey: ["request-events", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("request_events")
        .select("*, actor:profiles!request_events_actor_id_fkey(full_name,email)")
        .eq("request_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  if (req.isLoading) {
    return <div className="flex items-center gap-2 py-10 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>;
  }
  if (!req.data) {
    return <div className="rounded-xl border p-10 text-center text-sm text-muted-foreground">Request not found.</div>;
  }

  const r: any = req.data;
  const payload = r.payload ?? {};
  const steps: Array<{ sequence: number; station_id: string; notes: string | null }> = payload.steps ?? [];
  const product = payload.product ?? {};
  const isRequester = r.requester_id === user?.id;
  const isAssignee = r.assignee_id === user?.id;
  const canReview = (isAssignee || isQC) && r.status !== "approved" && r.status !== "rejected" && r.status !== "cancelled" && r.status !== "completed";
  const canCancel = isRequester && r.status === "pending";

  const logEvent = async (event_type: string, from_status: string | null, to_status: string | null) => {
    if (!user) return;
    await supabase.from("request_events").insert({
      request_id: id, actor_id: user.id, event_type,
      from_status: from_status as any, to_status: to_status as any,
      notes: notes.trim() || null,
    });
  };

  const setStatus = async (to: string, event_type: string) => {
    setBusy(event_type);
    try {
      const { error } = await supabase
        .from("requests")
        .update({
          status: to,
          decision_notes: notes.trim() || r.decision_notes,
          decided_by: (to === "approved" || to === "rejected") ? user!.id : r.decided_by,
          decided_at: (to === "approved" || to === "rejected") ? new Date().toISOString() : r.decided_at,
          assignee_id: r.assignee_id ?? user!.id,
        })
        .eq("id", id);
      if (error) throw error;
      await logEvent(event_type, r.status, to);
      setNotes("");
      notifySuccess(`Request ${to.replace("_", " ")}`);
      qc.invalidateQueries({ queryKey: ["request", id] });
      qc.invalidateQueries({ queryKey: ["request-events", id] });
      qc.invalidateQueries({ queryKey: ["requests"] });
    } catch (e) {
      notifyError(e, { fallback: "Failed to update request" });
    } finally {
      setBusy(null);
    }
  };

  const approveAndProvision = async () => {
    if (r.kind !== "new_product") return setStatus("approved", "approved");
    if (!product?.sku || !product?.name) return notifyError("Request payload is missing product details");
    setBusy("provision");
    try {
      // Idempotent: reuse product if SKU already exists
      const { data: existing } = await supabase.from("products").select("id").eq("sku", product.sku).maybeSingle();
      let productId = existing?.id as string | undefined;
      if (!productId) {
        const { data: created, error: e1 } = await supabase
          .from("products")
          .insert({ sku: product.sku, name: product.name, description: product.description ?? null, category_id: product.category_id ?? null, is_active: true })
          .select("id").single();
        if (e1) throw e1;
        productId = created.id;
      }
      // Insert routings (skip existing sequences)
      if (steps.length) {
        const { data: existingRows } = await supabase.from("product_routings").select("sequence").eq("product_id", productId);
        const have = new Set((existingRows ?? []).map((r: any) => r.sequence));
        const toInsert = steps.filter((s) => !have.has(s.sequence)).map((s) => ({
          product_id: productId, station_id: s.station_id, sequence: s.sequence, notes: s.notes ?? null,
        }));
        if (toInsert.length) {
          const { error: e2 } = await supabase.from("product_routings").insert(toInsert);
          if (e2) throw e2;
        }
      }
      const { error: e3 } = await supabase
        .from("requests")
        .update({
          status: "completed",
          decision_notes: notes.trim() || r.decision_notes,
          decided_by: user!.id,
          decided_at: new Date().toISOString(),
          result_product_id: productId,
          assignee_id: r.assignee_id ?? user!.id,
        })
        .eq("id", id);
      if (e3) throw e3;
      await logEvent("provisioned", r.status, "completed");
      setNotes("");
      notifySuccess("Product created and request completed");
      qc.invalidateQueries({ queryKey: ["request", id] });
      qc.invalidateQueries({ queryKey: ["request-events", id] });
      qc.invalidateQueries({ queryKey: ["requests"] });
    } catch (e) {
      notifyError(e, { fallback: "Failed to provision product" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link to="/requests" className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3 w-3" /> Back to requests</Link>
          <h2 className="text-lg font-semibold">{r.title}</h2>
          <p className="font-mono text-xs text-muted-foreground">{r.number} · {r.kind.replace("_", " ")}</p>
        </div>
        <StatusPill tone={statusTone(r.status)}>{r.status.replace("_", " ")}</StatusPill>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <section className="rounded-xl border p-4">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-medium"><Package className="h-4 w-4" /> Product</h3>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div><dt className="text-xs uppercase text-muted-foreground">SKU</dt><dd className="font-mono">{product.sku ?? "—"}</dd></div>
              <div><dt className="text-xs uppercase text-muted-foreground">Name</dt><dd>{product.name ?? "—"}</dd></div>
              <div className="col-span-2"><dt className="text-xs uppercase text-muted-foreground">Description</dt><dd>{product.description ?? r.description ?? "—"}</dd></div>
            </dl>
            {r.result_product && (
              <div className="mt-3 rounded-lg bg-success/10 p-2 text-xs text-success">
                Provisioned as{" "}
                <Link to="/products/$id" params={{ id: r.result_product.id }} className="font-mono underline">
                  {r.result_product.sku}
                </Link>
              </div>
            )}
          </section>

          <section className="rounded-xl border p-4">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-medium"><Factory className="h-4 w-4" /> Production steps ({steps.length})</h3>
            {steps.length === 0 ? (
              <p className="text-sm text-muted-foreground">No steps defined.</p>
            ) : (
              <ol className="space-y-2">
                {steps.map((s) => {
                  const st = stations.data?.get(s.station_id);
                  return (
                    <li key={s.sequence} className="flex items-start gap-3 rounded-lg bg-muted/30 p-2">
                      <span className="grid h-7 w-7 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{s.sequence}</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium">
                          {st ? `${st.code ? st.code + " · " : ""}${st.name}` : <span className="italic text-muted-foreground">Station missing (id {s.station_id.slice(0, 8)})</span>}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {st?.station_type ?? ""}{st?.production_lines?.name ? ` · ${st.production_lines.name}` : ""}
                        </div>
                        {s.notes && <p className="mt-1 text-sm">{s.notes}</p>}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>

          <section className="rounded-xl border p-4">
            <h3 className="mb-2 text-sm font-medium">Activity</h3>
            {(events.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No events yet.</p>
            ) : (
              <ul className="space-y-2">
                {(events.data ?? []).map((e: any) => (
                  <li key={e.id} className="text-sm">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-medium">{e.actor?.full_name ?? e.actor?.email ?? "System"}</span>
                      <span className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString()}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {e.event_type}{e.from_status ? ` · ${e.from_status} → ${e.to_status ?? ""}` : ""}
                    </div>
                    {e.notes && <p className="text-sm">{e.notes}</p>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          <section className="rounded-xl border p-4 text-sm">
            <div className="mb-2 font-medium">People</div>
            <div className="space-y-1">
              <div><span className="text-xs text-muted-foreground">Requester: </span>{r.requester?.full_name ?? r.requester?.email ?? "—"}</div>
              <div><span className="text-xs text-muted-foreground">Assignee: </span>{r.assignee?.full_name ?? r.assignee?.email ?? "— unassigned —"}</div>
              <div><span className="text-xs text-muted-foreground">Created: </span>{new Date(r.created_at).toLocaleString()}</div>
              {r.decided_at && <div><span className="text-xs text-muted-foreground">Decided: </span>{new Date(r.decided_at).toLocaleString()}</div>}
            </div>
          </section>

          {(canReview || canCancel) && (
            <section className="rounded-xl border p-4">
              <div className="mb-2 text-sm font-medium">Actions</div>
              <Label className="text-xs">Notes</Label>
              <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Decision notes…" />
              <div className="mt-3 flex flex-col gap-2">
                {canReview && r.status === "pending" && (
                  <Button variant="outline" size="sm" onClick={() => setStatus("in_review", "started_review")} disabled={busy !== null} className="gap-2">
                    <PlayCircle className="h-4 w-4" /> Start review
                  </Button>
                )}
                {canReview && (
                  <>
                    <Button size="sm" onClick={approveAndProvision} disabled={busy !== null} className="gap-2">
                      {busy === "provision" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      {r.kind === "new_product" ? "Approve & create product" : "Approve"}
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => setStatus("rejected", "rejected")} disabled={busy !== null} className="gap-2">
                      <XCircle className="h-4 w-4" /> Reject
                    </Button>
                  </>
                )}
                {canCancel && (
                  <Button size="sm" variant="ghost" onClick={() => setStatus("cancelled", "cancelled")} disabled={busy !== null}>
                    Cancel request
                  </Button>
                )}
              </div>
              {!isQC && !isAssignee && !isRequester && (
                <p className="mt-2 text-xs text-muted-foreground">Only the requester, assignee, or QC staff can act on this request.</p>
              )}
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/requests/$id")({
  ssr: false,
  head: () => ({ meta: [{ title: "Request — CORTA QC" }, { name: "robots", content: "noindex" }] }),
  component: () => {
    const { id } = Route.useParams();
    return (
      <AuthGate>
        <AppShell>
          <MesPage icon={<Inbox className="h-5 w-5" />} title="Request" description="Review and act on a cross-department request.">
            <RequestDetail id={id} />
          </MesPage>
        </AppShell>
      </AuthGate>
    );
  },
});
