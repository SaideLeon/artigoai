import type { Metadata } from "next";
import LandingPage from "@/components/LandingPage";
import {
  DEFAULT_OPEN_GRAPH,
  DEFAULT_TWITTER,
  SITE_DESCRIPTION,
  SITE_TITLE,
  SITE_URL,
} from "@/lib/seo";

export const metadata: Metadata = {
  title: {
    absolute: SITE_TITLE,
  },
  description: SITE_DESCRIPTION,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    ...DEFAULT_OPEN_GRAPH,
    url: `${SITE_URL}/`,
  },
  twitter: DEFAULT_TWITTER,
};

export default function Home() {
  return <LandingPage />;
}
