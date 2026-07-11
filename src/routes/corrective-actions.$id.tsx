import { createFileRoute } from "@tanstack/react-router";
import { AuthGate } from "@/components/auth-gate";
import { AppShell } from "@/components/app-shell";
import { CaDetailPage } from "@/pages/corrective-actions";

export const Route = createFileRoute("/corrective-actions/$id")({
  ssr: false,
  head: () => ({ meta: [{ title: "Corrective Action — CORTA QC" }, { name: "robots", content: "noindex" }] }),
  component: () => {
    const { id } = Route.useParams();
    return <AuthGate><AppShell><CaDetailPage id={id} /></AppShell></AuthGate>;
  },
});
