import { createFileRoute } from "@tanstack/react-router";
import { AuthGate } from "@/components/auth-gate";
import { AppShell } from "@/components/app-shell";
import { DashboardPage } from "@/pages/dashboard";

export const Route = createFileRoute("/")({
  ssr: false,
  component: () => (
    <AuthGate><AppShell><DashboardPage /></AppShell></AuthGate>
  ),
});
