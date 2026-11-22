import type { Metadata } from "next";
import RobotDemo from "@/components/mascot/RobotDemo";
import { DEFAULT_OPEN_GRAPH, DEFAULT_TWITTER, SITE_URL } from "@/lib/seo";

const MASCOTE_TITLE = "Mulébi — Mascote 3D Interativo";
const MASCOTE_DESCRIPTION =
  "Demonstração interativa do Mulébi, o mascote 3D oficial do Artigen modelado em Three.js com animações procedurais e expressões em tempo real.";

export const metadata: Metadata = {
  title: MASCOTE_TITLE,
  description: MASCOTE_DESCRIPTION,
  alternates: {
    canonical: "/mascote",
  },
  openGraph: {
    ...DEFAULT_OPEN_GRAPH,
    title: `${MASCOTE_TITLE} — Artigen`,
    description: MASCOTE_DESCRIPTION,
    url: `${SITE_URL}/mascote`,
  },
  twitter: {
    ...DEFAULT_TWITTER,
    title: `${MASCOTE_TITLE} — Artigen`,
    description: MASCOTE_DESCRIPTION,
  },
};

export default function MascotePage() {
  return <RobotDemo />;
}
