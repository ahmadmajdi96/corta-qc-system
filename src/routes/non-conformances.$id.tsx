import { createFileRoute } from "@tanstack/react-router";
import { AuthGate } from "@/components/auth-gate";
import { AppShell } from "@/components/app-shell";
import { NcDetailPage } from "@/pages/nc-detail";

export const Route = createFileRoute("/non-conformances/$id")({
  ssr: false,
  head: () => ({ meta: [{ title: "NC — CORTA QC" }, { name: "robots", content: "noindex" }] }),
  component: () => {
    const { id } = Route.useParams();
    return <AuthGate><AppShell><NcDetailPage id={id} /></AppShell></AuthGate>;
  },
});
