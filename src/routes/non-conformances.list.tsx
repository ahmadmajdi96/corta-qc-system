import { createFileRoute } from "@tanstack/react-router";
import { AuthGate } from "@/components/auth-gate";
import { AppShell } from "@/components/app-shell";
import { NcListPage } from "@/pages/ncs";

export const Route = createFileRoute("/non-conformances/list")({
  ssr: false,
  head: () => ({ meta: [{ title: "NC List — CORTA QC" }, { name: "robots", content: "noindex" }] }),
  component: () => (<AuthGate><AppShell><NcListPage /></AppShell></AuthGate>),
});
