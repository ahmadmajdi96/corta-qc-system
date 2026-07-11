import { createFileRoute } from "@tanstack/react-router";
import { AuthGate } from "@/components/auth-gate";
import { AppShell } from "@/components/app-shell";
import { NcBoardPage } from "@/pages/ncs";

export const Route = createFileRoute("/non-conformances/")({
  ssr: false,
  head: () => ({ meta: [{ title: "Non-Conformances — CORTA QC" }, { name: "robots", content: "noindex" }] }),
  component: () => (<AuthGate><AppShell><NcBoardPage /></AppShell></AuthGate>),
});
