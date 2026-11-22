import type { Metadata } from "next";
import NotFoundView from "@/components/NotFoundView";

export const metadata: Metadata = {
  title: "Página não encontrada (404) | Artigen",
  description:
    "O Mulébi não encontrou esta página. Volte para a página inicial do Artigen.",
  robots: {
    index: false,
    follow: true,
  },
};

export default function NotFound() {
  return <NotFoundView />;
}
