import type { Metadata } from "next";
import AdminEmailsPageClient from "@/components/AdminEmailsPageClient";

export const metadata: Metadata = {
  title: "Caixa de E-mail Administrativa",
  description:
    "Gerencie e responda e-mails recebidos de clientes diretamente na plataforma Artigen.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminEmailsPage() {
  return <AdminEmailsPageClient />;
}
