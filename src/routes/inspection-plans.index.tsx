import { createFileRoute } from "@tanstack/react-router";
import { AuthGate } from "@/components/auth-gate";
import { AppShell } from "@/components/app-shell";
import { ComingSoonPage } from "@/components/coming-soon";
import { ListChecks } from "lucide-react";

export const Route = createFileRoute("/inspection-plans/")({
  ssr: false,
  head: () => ({ meta: [{ title: "Inspection Plans — CORTA QC" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <AuthGate>
      <AppShell>
        <ComingSoonPage
          title="Inspection Plans"
          description="Incoming, in-process and final inspection plans with AQL sampling."
          icon={<ListChecks className="h-5 w-5" />}
        />
      </AppShell>
    </AuthGate>
  ),
});
