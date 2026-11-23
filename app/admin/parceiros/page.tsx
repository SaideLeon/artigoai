import type { Metadata } from "next";
import AdminPartnersClient from "@/components/AdminPartnersClient";

export const metadata: Metadata = {
  title: "Administração de Parceiros",
  description:
    "Gerencie convites, parceiros, comissões e exportação financeira no Artigen.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminPartnersPage() {
  return <AdminPartnersClient />;
}
