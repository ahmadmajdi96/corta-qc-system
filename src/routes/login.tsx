import { createFileRoute } from "@tanstack/react-router";
import { AuthCard } from "@/components/auth-card";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — CORTA QC" },
      { name: "description", content: "Sign in to CORTA QC quality control platform." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthCard,
});
