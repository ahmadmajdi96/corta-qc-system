import { createFileRoute } from "@tanstack/react-router";
import { AuthGate } from "@/components/auth-gate";
import { AppShell } from "@/components/app-shell";
import { ComingSoonPage } from "@/components/coming-soon";
import { Gauge } from "lucide-react";

export const Route = createFileRoute("/calibration/")({
  ssr: false,
  head: () => ({ meta: [{ title: "Calibration — CORTA QC" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <AuthGate>
      <AppShell>
        <ComingSoonPage
          title="Gage Calibration"
          description="Instrument registry, calibration schedule and MSA / Gage R&R studies."
          icon={<Gauge className="h-5 w-5" />}
        />
      </AppShell>
    </AuthGate>
  ),
});
