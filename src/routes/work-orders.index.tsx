import { createFileRoute } from "@tanstack/react-router";
import { AuthGate } from "@/components/auth-gate";
import { AppShell } from "@/components/app-shell";
import { ComingSoonPage } from "@/components/coming-soon";
import { ScrollText } from "lucide-react";

export const Route = createFileRoute("/work-orders/")({
  ssr: false,
  head: () => ({ meta: [{ title: "Work Orders — CORTA QC" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <AuthGate>
      <AppShell>
        <ComingSoonPage
          title="Work Orders"
          description="Plan, release and track production work orders with linked QC gates."
          icon={<ScrollText className="h-5 w-5" />}
        />
      </AppShell>
    </AuthGate>
  ),
});
