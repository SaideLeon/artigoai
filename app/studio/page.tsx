import type { Metadata } from "next";
import ArticleStudioApp from "@/components/ArticleStudioApp";
import { DEFAULT_OPEN_GRAPH, DEFAULT_TWITTER, SITE_URL } from "@/lib/seo";

const STUDIO_TITLE = "Gerador de Artigos para Blogs";
const STUDIO_DESCRIPTION =
  "Gere artigos para blogs seção a seção com IA, pesquisa web em tempo real, ilustrações automáticas e exportação em HTML limpo.";

export const metadata: Metadata = {
  title: STUDIO_TITLE,
  description: STUDIO_DESCRIPTION,
  alternates: {
    canonical: "/studio",
  },
  openGraph: {
    ...DEFAULT_OPEN_GRAPH,
    title: `${STUDIO_TITLE} — Artigen`,
    description: STUDIO_DESCRIPTION,
    url: `${SITE_URL}/studio`,
  },
  twitter: {
    ...DEFAULT_TWITTER,
    title: `${STUDIO_TITLE} — Artigen`,
    description: STUDIO_DESCRIPTION,
  },
};

export default function StudioPage() {
  return <ArticleStudioApp />;
}
