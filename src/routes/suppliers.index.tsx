import { createFileRoute } from "@tanstack/react-router";
import { AuthGate } from "@/components/auth-gate";
import { AppShell } from "@/components/app-shell";
import { MesPage, StatusPill } from "@/components/mes/mes-page";
import { SimpleList } from "@/components/mes/simple-list";
import { Truck } from "lucide-react";

export const Route = createFileRoute("/suppliers/")({
  ssr: false,
  head: () => ({ meta: [{ title: "Suppliers — CORTA QC" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <AuthGate>
      <AppShell>
        <MesPage
          icon={<Truck className="h-5 w-5" />}
          title="Suppliers"
          description="Approved vendor list with quality ratings and contacts."
        >
          <SimpleList
            table="suppliers"
            entityName="Supplier"
            emptyIcon={<Truck className="h-6 w-6" />}
            columns={[
              { key: "code", label: "Code", render: (r: any) => <span className="font-mono text-xs">{r.code}</span> },
              { key: "name", label: "Name" },
              { key: "contact_email", label: "Contact" },
              { key: "rating", label: "Rating", render: (r: any) => r.rating != null ? <span className="font-mono">{Number(r.rating).toFixed(2)}</span> : "—" },
              { key: "is_approved", label: "Status", render: (r: any) => <StatusPill tone={r.is_approved ? "success" : "warning"}>{r.is_approved ? "Approved" : "Pending"}</StatusPill> },
            ]}
            fields={[
              { name: "code", label: "Code", required: true, placeholder: "SUP-001" },
              { name: "name", label: "Name", required: true },
              { name: "contact_email", label: "Contact email" },
              { name: "contact_phone", label: "Contact phone" },
              { name: "rating", label: "Rating (0-5)", type: "number" },
              { name: "notes", label: "Notes", type: "textarea" },
            ]}
          />
        </MesPage>
      </AppShell>
    </AuthGate>
  ),
});
