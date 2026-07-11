import { createFileRoute, redirect } from "@tanstack/react-router";

// Dedicated /login route — redirects to the existing /auth sign-in page.
export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign in — CORTA QC" }, { name: "robots", content: "noindex" }] }),
  beforeLoad: () => { throw redirect({ to: "/auth" }); },
});
