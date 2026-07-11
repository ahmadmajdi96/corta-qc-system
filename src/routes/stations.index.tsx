import { createFileRoute } from "@tanstack/react-router";
import { AuthGate } from "@/components/auth-gate";
import { AppShell } from "@/components/app-shell";
import { ComingSoonPage } from "@/components/coming-soon";
import { Cpu } from "lucide-react";

export const Route = createFileRoute("/stations/")({
  ssr: false,
  head: () => ({ meta: [{ title: "Stations — CORTA QC" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <AuthGate>
      <AppShell>
        <ComingSoonPage
          title="Stations"
          description="Workstations grouped by production line."
          icon={<Cpu className="h-5 w-5" />}
        />
      </AppShell>
    </AuthGate>
  ),
});
