import type { MetadataRoute } from "next";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/seo";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: `${SITE_NAME} — Gerador de Artigos para Blogs`,
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION,
    start_url: "/studio",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#F4F6FB",
    theme_color: "#5B4AF4",
    lang: "pt-BR",
    categories: ["productivity", "business", "utilities"],
    icons: [
      {
        src: "/pwa-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/pwa-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/pwa-maskable-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
    shortcuts: [
      {
        name: "Abrir Estúdio",
        short_name: "Estúdio",
        description: "Criar e editar artigos para blogs no estúdio Artigen",
        url: "/studio",
        icons: [
          {
            src: "/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
        ],
      },
      {
        name: "Página Inicial",
        short_name: "Início",
        description: "Visão geral, recursos e planos do Artigen",
        url: "/",
        icons: [
          {
            src: "/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
        ],
      },
    ],
  };
}
