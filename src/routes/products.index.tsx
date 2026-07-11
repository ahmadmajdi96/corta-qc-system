import { createFileRoute } from "@tanstack/react-router";
import { AuthGate } from "@/components/auth-gate";
import { AppShell } from "@/components/app-shell";
import { ProductsListPage } from "@/pages/products-list";

export const Route = createFileRoute("/products/")({
  ssr: false,
  head: () => ({ meta: [{ title: "Products — CORTA QC" }, { name: "robots", content: "noindex" }] }),
  component: () => (<AuthGate><AppShell><ProductsListPage /></AppShell></AuthGate>),
});
