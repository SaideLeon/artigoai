import type { Metadata } from "next";
import { FREE_PLAN, SUBSCRIPTION_PLANS, SUBSCRIPTION_FAQS } from "@/lib/pricing";

const rawSiteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
  process.env.APP_URL?.trim() ||
  "https://criador.artificializar.site";

export const SITE_URL = rawSiteUrl.replace(/\/+$/, "");
export const SITE_NAME = "Artigen";
export const SITE_TITLE = "Artigen — Gerador de Artigos para Blogs com IA";
export const SITE_DESCRIPTION =
  "Gerador de artigos para blogs com IA, pesquisa web em tempo real, imagens por seção e exportação em HTML limpo para publicar rápido.";

export const DEFAULT_KEYWORDS = [
  "gerador de artigos para blogs",
  "gerador de artigos para blog com ia",
  "criar artigos para blog",
  "redação de artigos para blogs",
  "artigos com inteligência artificial",
  "pesquisa web automática",
  "exportação html para blogs",
  "artigen",
];

export const DEFAULT_OPEN_GRAPH: NonNullable<Metadata["openGraph"]> = {
  type: "website",
  locale: "pt_BR",
  url: SITE_URL,
  siteName: SITE_NAME,
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  images: [
    {
      url: "/opengraph-image",
      width: 1200,
      height: 630,
      alt: "Artigen — Gerador de Artigos para Blogs com IA",
    },
  ],
};

export const DEFAULT_TWITTER: NonNullable<Metadata["twitter"]> = {
  card: "summary_large_image",
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  images: ["/twitter-image"],
};

const LANDING_FAQS = [
  {
    q: "Preciso preencher todos os campos antes de gerar um artigo?",
    a: "Não. Basta digitar o título principal e clicar em gerar — o estúdio sugere automaticamente descrição, palavras-chave, tom e extensão, que você pode editar quando quiser.",
  },
  {
    q: "Como funciona a pesquisa web para notícias e artigos informativos?",
    a: "No modo automático ou sempre ativo, o estúdio analisa o tema e busca fontes atualizadas na web antes de criar o esboço e redigir as secções, exibindo as referências consultadas ao final.",
  },
  {
    q: "Posso escolher escrever em primeira ou terceira pessoa?",
    a: "Sim. O interruptor de perspectiva narrativa vem habilitado por padrão para textos em primeira pessoa e pode ser alternado para escrita impessoal a qualquer momento.",
  },
  {
    q: "Em quais formatos posso exportar os artigos criados?",
    a: "Além de editar secções ao vivo e copiar o texto completo, você pode descarregar o artigo inteiro em HTML limpo, com imagens integradas e lista de fontes.",
  },
] as const;

export function buildStructuredDataJsonLd() {
  const allFaqs = [...LANDING_FAQS, ...SUBSCRIPTION_FAQS];

  const offers = [
    {
      "@type": "Offer",
      name: `${SITE_NAME} ${FREE_PLAN.nome}`,
      price: "0",
      priceCurrency: "BRL",
      description: FREE_PLAN.descricao,
      availability: "https://schema.org/InStock",
      url: `${SITE_URL}/#planos`,
    },
    ...SUBSCRIPTION_PLANS.map((plan) => ({
      "@type": "Offer",
      name: `${SITE_NAME} ${plan.nome}`,
      price: plan.precoMensalBrl.toFixed(2),
      priceCurrency: "BRL",
      description: `${plan.artigosMes} artigos para blogs por mês. ${plan.descricao}`,
      availability: "https://schema.org/InStock",
      url: `${SITE_URL}/#planos`,
    })),
  ];

  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: SITE_NAME,
        url: SITE_URL,
        logo: {
          "@type": "ImageObject",
          url: `${SITE_URL}/icon.svg`,
        },
        publishingPrinciples: `${SITE_URL}/sobre`,
        contactPoint: {
          "@type": "ContactPoint",
          contactType: "customer support",
          email: "contato@artificializar.site",
          url: `${SITE_URL}/#contato`,
          availableLanguage: ["Portuguese"],
        },
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: SITE_URL,
        name: SITE_NAME,
        description: SITE_DESCRIPTION,
        inLanguage: "pt-BR",
        publisher: {
          "@id": `${SITE_URL}/#organization`,
        },
      },
      {
        "@type": ["SoftwareApplication", "WebApplication"],
        "@id": `${SITE_URL}/#software`,
        name: SITE_NAME,
        url: SITE_URL,
        applicationCategory: "BusinessApplication",
        operatingSystem: "All",
        inLanguage: "pt-BR",
        description: SITE_DESCRIPTION,
        image: `${SITE_URL}/opengraph-image`,
        termsOfService: `${SITE_URL}/termos-de-uso`,
        featureList: [
          "Geração de artigos longos para blogs seção a seção",
          "Pesquisa web automática em tempo real com fontes citadas",
          "Ilustrações automáticas por seção para posts de blog",
          "Escrita configurável em primeira ou terceira pessoa",
          "Edição ao vivo e exportação em HTML limpo para CMS e blogs",
        ],
        offers: {
          "@type": "AggregateOffer",
          priceCurrency: "BRL",
          lowPrice: "0",
          highPrice: "149.90",
          offerCount: offers.length,
          offers,
        },
      },
      {
        "@type": "FAQPage",
        "@id": `${SITE_URL}/#faq`,
        mainEntity: allFaqs.map((item) => ({
          "@type": "Question",
          name: item.q,
          acceptedAnswer: {
            "@type": "Answer",
            text: item.a,
          },
        })),
      },
    ],
  };

  return JSON.stringify(graph);
}
