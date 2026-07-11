import { createFileRoute } from "@tanstack/react-router";
import { AuthGate } from "@/components/auth-gate";
import { AppShell } from "@/components/app-shell";
import { ComingSoonPage } from "@/components/coming-soon";
import { Activity } from "lucide-react";

export const Route = createFileRoute("/spc")({
  ssr: false,
  head: () => ({ meta: [{ title: "SPC — CORTA QC" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <AuthGate>
      <AppShell>
        <ComingSoonPage
          title="SPC / Control Charts"
          description="X-bar / R charts, Cp / Cpk and Western Electric rule detection."
          icon={<Activity className="h-5 w-5" />}
        />
      </AppShell>
    </AuthGate>
  ),
});
