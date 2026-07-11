import { createFileRoute } from "@tanstack/react-router";
import { AuthGate } from "@/components/auth-gate";
import { AppShell } from "@/components/app-shell";
import { CaListPage } from "@/pages/corrective-actions";

export const Route = createFileRoute("/corrective-actions/")({
  ssr: false,
  head: () => ({ meta: [{ title: "Corrective Actions — CORTA QC" }, { name: "robots", content: "noindex" }] }),
  component: () => (<AuthGate><AppShell><CaListPage /></AppShell></AuthGate>),
});
