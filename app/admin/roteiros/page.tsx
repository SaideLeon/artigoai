import type { Metadata } from "next";
import AdminScriptsPageClient from "@/components/AdminScriptsPageClient";

export const metadata: Metadata = {
  title: "Roteiros YouTube, Cursos & Áudio Google — Admin Artigen",
  description:
    "Área administrativa exclusiva para gerar roteiros de captação de leads no YouTube, módulos de curso e locução nativa com Google TTS.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminScriptsPage() {
  return <AdminScriptsPageClient />;
}
