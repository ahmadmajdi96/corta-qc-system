import { createFileRoute } from "@tanstack/react-router";
import { AuthGate } from "@/components/auth-gate";
import { AppShell } from "@/components/app-shell";
import { InspectionsListPage } from "@/pages/inspections";

export const Route = createFileRoute("/inspections/")({
  ssr: false,
  head: () => ({ meta: [{ title: "Inspections — CORTA QC" }, { name: "robots", content: "noindex" }] }),
  component: () => (<AuthGate><AppShell><InspectionsListPage /></AppShell></AuthGate>),
});
