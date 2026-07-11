import { createFileRoute } from "@tanstack/react-router";
import { AuthGate } from "@/components/auth-gate";
import { AppShell } from "@/components/app-shell";
import { ComingSoonPage } from "@/components/coming-soon";
import { Truck } from "lucide-react";

export const Route = createFileRoute("/incoming/")({
  ssr: false,
  head: () => ({ meta: [{ title: "Incoming Lots — CORTA QC" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <AuthGate>
      <AppShell>
        <ComingSoonPage
          title="Incoming Lots"
          description="Receiving inspection queue with supplier + PO context."
          icon={<Truck className="h-5 w-5" />}
        />
      </AppShell>
    </AuthGate>
  ),
});
