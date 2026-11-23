import type { Metadata } from "next";
import PartnerDashboardClient from "@/components/PartnerDashboardClient";

export const metadata: Metadata = {
  title: "Painel do Parceiro",
  description:
    "Acompanhe seu link exclusivo de indicação, cliques diários, cadastros e comissões no Programa de Parceiros Artigen.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function PartnerDashboardPage() {
  return <PartnerDashboardClient />;
}
