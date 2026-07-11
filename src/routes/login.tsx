import { createFileRoute } from "@tanstack/react-router";

// Alias for /auth, per spec: dedicated /login route.
export { Route as default } from "./auth";
export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign in — CORTA QC" }, { name: "robots", content: "noindex" }] }),
  component: () => {
    if (typeof window !== "undefined") window.location.replace("/auth");
    return null;
  },
});
