export const USD_TO_BRL = 5.9337;

export type CurrencyCode = "BRL" | "USD";

export type PricingTier = {
  id: string;
  nome: string;
  artigos: number;
  precoPorArtigoUsd: number;
  totalUsd: number;
  totalBrl: number;
  descontoPct: number;
  destaque?: "popular" | "melhor-valor";
  descricao: string;
};

export const PRICING_TIERS: PricingTier[] = [
  {
    id: "avulso-1",
    nome: "Artigo Avulso",
    artigos: 1,
    precoPorArtigoUsd: 1.25,
    totalUsd: 1.25,
    totalBrl: 7.42,
    descontoPct: 0,
    descricao: "Ideal para testar ou publicar um artigo pontual completo",
  },
  {
    id: "pacote-5",
    nome: "Pacote 5 Artigos",
    artigos: 5,
    precoPorArtigoUsd: 1.2,
    totalUsd: 6.0,
    totalBrl: 35.6,
    descontoPct: 4,
    descricao: "Para blogs iniciantes com ritmo semanal de publicação",
  },
  {
    id: "pacote-10",
    nome: "Pacote 10 Artigos",
    artigos: 10,
    precoPorArtigoUsd: 1.1,
    totalUsd: 11.0,
    totalBrl: 65.27,
    descontoPct: 12,
    descricao: "Ótimo equilíbrio para manter consistência editorial mensal",
  },
  {
    id: "pacote-16",
    nome: "Pacote 16 Artigos",
    artigos: 16,
    precoPorArtigoUsd: 1.0,
    totalUsd: 16.0,
    totalBrl: 94.94,
    descontoPct: 20,
    destaque: "popular",
    descricao: "O mais escolhido por criadores e estrategistas de conteúdo",
  },
  {
    id: "pacote-20",
    nome: "Pacote 20 Artigos",
    artigos: 20,
    precoPorArtigoUsd: 0.95,
    totalUsd: 19.0,
    totalBrl: 112.74,
    descontoPct: 24,
    descricao: "Escala editorial para projetos multi-temáticos e SEO",
  },
  {
    id: "pacote-30",
    nome: "Pacote 30 Artigos",
    artigos: 30,
    precoPorArtigoUsd: 0.85,
    totalUsd: 25.5,
    totalBrl: 151.31,
    descontoPct: 32,
    destaque: "melhor-valor",
    descricao: "Menor custo por artigo para publicação diária e agências",
  },
];

export function formatCurrency(value: number, currency: CurrencyCode): string {
  const formatted = value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return currency === "BRL" ? `R$ ${formatted}` : `US$ ${formatted}`;
}

export function getPerArticlePrice(
  tier: PricingTier,
  currency: CurrencyCode
): number {
  return currency === "BRL"
    ? tier.totalBrl / tier.artigos
    : tier.precoPorArtigoUsd;
}
