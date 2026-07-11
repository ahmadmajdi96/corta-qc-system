import { createFileRoute } from "@tanstack/react-router";
import { AuthGate } from "@/components/auth-gate";
import { AppShell } from "@/components/app-shell";
import { ComingSoonPage } from "@/components/coming-soon";
import { Radio } from "lucide-react";

export const Route = createFileRoute("/live")({
  ssr: false,
  head: () => ({ meta: [{ title: "Live Floor — CORTA QC" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <AuthGate>
      <AppShell>
        <ComingSoonPage
          title="Live Shop Floor"
          description="Real-time view of active work orders, inspection queue and open quality holds."
          icon={<Radio className="h-5 w-5" />}
        />
      </AppShell>
    </AuthGate>
  ),
});
