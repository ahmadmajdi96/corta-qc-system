import { createFileRoute } from "@tanstack/react-router";
import { AuthGate } from "@/components/auth-gate";
import { AppShell } from "@/components/app-shell";
import { InspectionDetailPage } from "@/pages/inspection-detail";

export const Route = createFileRoute("/inspections/$id/")({
  ssr: false,
  head: () => ({ meta: [{ title: "Inspection — CORTA QC" }, { name: "robots", content: "noindex" }] }),
  component: () => {
    const { id } = Route.useParams();
    return <AuthGate><AppShell><InspectionDetailPage id={id} /></AppShell></AuthGate>;
  },
});
