import { createFileRoute } from "@tanstack/react-router";
import { AuthGate } from "@/components/auth-gate";
import { AppShell } from "@/components/app-shell";
import { ComingSoonPage } from "@/components/coming-soon";
import { ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/holds/")({
  ssr: false,
  head: () => ({ meta: [{ title: "Quality Holds — CORTA QC" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <AuthGate>
      <AppShell>
        <ComingSoonPage
          title="Quality Holds"
          description="Quarantine lots and work orders with a formal disposition workflow."
          icon={<ShieldCheck className="h-5 w-5" />}
        />
      </AppShell>
    </AuthGate>
  ),
});
