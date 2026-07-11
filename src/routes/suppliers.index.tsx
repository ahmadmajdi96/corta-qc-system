import { createFileRoute } from "@tanstack/react-router";
import { AuthGate } from "@/components/auth-gate";
import { AppShell } from "@/components/app-shell";
import { ComingSoonPage } from "@/components/coming-soon";
import { Truck } from "lucide-react";

export const Route = createFileRoute("/suppliers/")({
  ssr: false,
  head: () => ({ meta: [{ title: "Suppliers — CORTA QC" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <AuthGate>
      <AppShell>
        <ComingSoonPage
          title="Suppliers"
          description="Supplier registry, ratings and incoming lot history."
          icon={<Truck className="h-5 w-5" />}
        />
      </AppShell>
    </AuthGate>
  ),
});
