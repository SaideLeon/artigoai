export type BillingCycle = "monthly" | "yearly";

export type PaidPlanId = "starter" | "pro" | "agencia";
export type PlanId = "free" | PaidPlanId;

export const MAX_IMAGES_PER_ARTICLE = 7;

export type SubscriptionPlan = {
  id: PaidPlanId;
  nome: string;
  artigosMes: number;
  imagensPorArtigo: number;
  imagensMes: number;
  precoMensalBrl: number;
  precoAnualBrl: number;
  equivalenteMensalAnualBrl: number;
  destaque?: "popular" | "melhor-valor";
  descricao: string;
};

export const FREE_PLAN = {
  id: "free" as const,
  nome: "Grátis",
  artigosMes: 2,
  imagensPorArtigo: MAX_IMAGES_PER_ARTICLE,
  imagensMes: 2 * MAX_IMAGES_PER_ARTICLE, // 14 imagens mensais
  precoMensalBrl: 0,
  descricao: "Para conhecer o Artigen sem compromisso.",
  recursos: [
    "2 artigos por mês",
    "Até 7 imagens por artigo (14 mensais)",
    "Pesquisa na web e exportação em HTML",
    "Sem cartão de crédito",
  ],
};

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: "starter",
    nome: "Starter",
    artigosMes: 14,
    imagensPorArtigo: MAX_IMAGES_PER_ARTICLE,
    imagensMes: 98,
    precoMensalBrl: 34.9,
    precoAnualBrl: 349.0,
    equivalenteMensalAnualBrl: 29.08,
    descricao: "Para blogs em crescimento com publicação frequente.",
  },
  {
    id: "pro",
    nome: "Pro",
    artigosMes: 33,
    imagensPorArtigo: MAX_IMAGES_PER_ARTICLE,
    imagensMes: 231,
    precoMensalBrl: 94.9,
    precoAnualBrl: 949.0,
    equivalenteMensalAnualBrl: 79.08,
    destaque: "popular",
    descricao:
      "Para criadores e estrategistas de conteúdo que publicam diariamente.",
  },
  {
    id: "agencia",
    nome: "Agência",
    artigosMes: 48,
    imagensPorArtigo: MAX_IMAGES_PER_ARTICLE,
    imagensMes: 336,
    precoMensalBrl: 149.9,
    precoAnualBrl: 1499.0,
    equivalenteMensalAnualBrl: 124.92,
    destaque: "melhor-valor",
    descricao: "Para alta escala editorial, agências e equipas de SEO.",
  },
];

export type PlanQuotaConfig = {
  id: string;
  nome: string;
  isPaid: boolean;
  artigosMes: number;
  imagensPorArtigo: number;
  imagensMes: number;
};

export function getPlanQuotaConfig(planId: string | null | undefined): PlanQuotaConfig {
  const normalized = (planId ?? "").trim().toLowerCase();
  const matched = SUBSCRIPTION_PLANS.find((p) => p.id === normalized);
  if (matched) {
    return {
      id: matched.id,
      nome: matched.nome,
      isPaid: true,
      artigosMes: matched.artigosMes,
      imagensPorArtigo: matched.imagensPorArtigo,
      imagensMes: matched.imagensMes,
    };
  }
  return {
    id: "free",
    nome: FREE_PLAN.nome,
    isPaid: false,
    artigosMes: FREE_PLAN.artigosMes,
    imagensPorArtigo: FREE_PLAN.imagensPorArtigo,
    imagensMes: FREE_PLAN.imagensMes,
  };
}

export function getMonthlyArticleLimit(planId: string | null | undefined): number {
  return getPlanQuotaConfig(planId).artigosMes;
}

export function getMonthlyImageLimit(planId: string | null | undefined): number {
  return getPlanQuotaConfig(planId).imagensMes;
}

export const SUBSCRIPTION_FAQS = [
  {
    q: "Posso cancelar quando quiser?",
    a: "Sim. Você cancela a qualquer momento no Portal do Assinante Cakto (assinatura.cakto.com.br), e o acesso continua até o fim do período já pago.",
  },
  {
    q: "Os artigos que não usei acumulam para o mês seguinte?",
    a: "Não. A cota mensal de artigos e imagens é renovada a cada ciclo de cobrança e não acumula.",
  },
  {
    q: "Quais formas de pagamento são aceitas?",
    a: "Pix (aprovação imediata), Cartão de Crédito e Boleto via Cakto em Real (R$).",
  },
  {
    q: "O que acontece se o pagamento falhar?",
    a: "Avisamos você por e-mail e você pode regularizar o pagamento pela Cakto. Se não for regularizado, a conta volta ao plano Grátis.",
  },
  {
    q: "Posso mudar de plano?",
    a: "Sim, você pode escolher outro plano ou gerir sua assinatura a qualquer momento pelo Portal do Assinante Cakto.",
  },
] as const;

export function formatBrl(value: number): string {
  const formatted = value.toLocaleString("pt-BR", {
    minimumFractionDigits: value === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return `R$ ${formatted}`;
}

export function getPlanDisplayName(planId: string): string {
  if (planId === "free") return FREE_PLAN.nome;
  const found = SUBSCRIPTION_PLANS.find((p) => p.id === planId);
  return found?.nome ?? "Plano Pago";
}
