import type { Metadata } from "next";
import AdminProspectingPageClient from "@/components/AdminProspectingPageClient";

export const metadata: Metadata = {
  title: "Prospecção Inteligente Administrativa",
  description:
    "Descoberta discriminada de potenciais clientes na web e convites personalizados com Gemini no Artigen.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminProspectingPage() {
  return <AdminProspectingPageClient />;
}
