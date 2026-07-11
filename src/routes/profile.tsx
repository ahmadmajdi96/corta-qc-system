import { createFileRoute } from "@tanstack/react-router";
import { AuthGate } from "@/components/auth-gate";
import { AppShell } from "@/components/app-shell";
import { ProfilePage } from "@/pages/profile";

export const Route = createFileRoute("/profile")({
  ssr: false,
  head: () => ({ meta: [{ title: "Profile — CORTA QC" }, { name: "robots", content: "noindex" }] }),
  component: () => (<AuthGate><AppShell><ProfilePage /></AppShell></AuthGate>),
});
