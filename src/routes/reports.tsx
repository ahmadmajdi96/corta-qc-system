import { createFileRoute } from "@tanstack/react-router";
import { AuthGate } from "@/components/auth-gate";
import { AppShell } from "@/components/app-shell";
import { ReportsPage } from "@/pages/reports";

export const Route = createFileRoute("/reports")({
  ssr: false,
  head: () => ({ meta: [{ title: "Reports — CORTA QC" }, { name: "robots", content: "noindex" }] }),
  component: () => (<AuthGate><AppShell><ReportsPage /></AppShell></AuthGate>),
});
