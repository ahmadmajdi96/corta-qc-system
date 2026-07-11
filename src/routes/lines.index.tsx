import { createFileRoute } from "@tanstack/react-router";
import { AuthGate } from "@/components/auth-gate";
import { AppShell } from "@/components/app-shell";
import { ComingSoonPage } from "@/components/coming-soon";
import { Factory } from "lucide-react";

export const Route = createFileRoute("/lines/")({
  ssr: false,
  head: () => ({ meta: [{ title: "Production Lines — CORTA QC" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <AuthGate>
      <AppShell>
        <ComingSoonPage
          title="Production Lines"
          description="Master data for production lines and areas."
          icon={<Factory className="h-5 w-5" />}
        />
      </AppShell>
    </AuthGate>
  ),
});
