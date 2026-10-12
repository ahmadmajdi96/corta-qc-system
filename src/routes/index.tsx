import { createFileRoute } from "@tanstack/react-router";
import { AuthGate } from "@/components/auth-gate";
import { AppShell } from "@/components/app-shell";
import { DashboardPage } from "@/pages/dashboard";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({ meta: [
    { title: "Control Center — CORTA QC" },
    { name: "description", content: "CORTA QC Control Center for inspection performance, work orders, quality holds and non-conformances." },
    { property: "og:title", content: "Control Center — CORTA QC" },
    { property: "og:description", content: "Manufacturing quality performance, active work and quality alerts in the CORTA QC Control Center." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: () => (
    <AuthGate><AppShell><DashboardPage /></AppShell></AuthGate>
  ),
});
