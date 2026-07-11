import { createFileRoute } from "@tanstack/react-router";
import { AuthGate } from "@/components/auth-gate";
import { AppShell } from "@/components/app-shell";
import { InspectionCalendarPage } from "@/pages/inspections";

export const Route = createFileRoute("/inspections/calendar")({
  ssr: false,
  head: () => ({ meta: [{ title: "Inspection Calendar — CORTA QC" }, { name: "robots", content: "noindex" }] }),
  component: () => (<AuthGate><AppShell><InspectionCalendarPage /></AppShell></AuthGate>),
});
