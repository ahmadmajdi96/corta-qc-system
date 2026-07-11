import { createFileRoute } from "@tanstack/react-router";
import { AuthGate } from "@/components/auth-gate";
import { AppShell } from "@/components/app-shell";
import { ProductDetailPage } from "@/pages/product-detail";

export const Route = createFileRoute("/products/$id")({
  ssr: false,
  head: () => ({ meta: [{ title: "Product — CORTA QC" }, { name: "robots", content: "noindex" }] }),
  component: () => {
    const { id } = Route.useParams();
    return <AuthGate><AppShell><ProductDetailPage id={id} /></AppShell></AuthGate>;
  },
});
