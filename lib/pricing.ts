export type BillingCycle = "monthly" | "yearly";

export type PaidPlanId = "starter" | "pro" | "agencia";
export type PlanId = "free" | PaidPlanId;

export type SubscriptionPlan = {
  id: PaidPlanId;
  nome: string;
  artigosMes: number;
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
  precoMensalBrl: 0,
  descricao: "Para conhecer o Artigen sem compromisso.",
  recursos: [
    "2 artigos por mês",
    "Pesquisa na web e exportação em HTML",
    "Imagens por seção",
    "Sem cartão de crédito",
  ],
};

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: "starter",
    nome: "Starter",
    artigosMes: 5,
    precoMensalBrl: 34.9,
    precoAnualBrl: 349.0,
    equivalenteMensalAnualBrl: 29.08,
    descricao: "Para blogs iniciantes com ritmo semanal de publicação.",
  },
  {
    id: "pro",
    nome: "Pro",
    artigosMes: 16,
    precoMensalBrl: 94.9,
    precoAnualBrl: 949.0,
    equivalenteMensalAnualBrl: 79.08,
    destaque: "popular",
    descricao:
      "Para criadores e estrategistas de conteúdo que publicam com frequência.",
  },
  {
    id: "agencia",
    nome: "Agência",
    artigosMes: 30,
    precoMensalBrl: 149.9,
    precoAnualBrl: 1499.0,
    equivalenteMensalAnualBrl: 124.92,
    destaque: "melhor-valor",
    descricao: "Para publicação diária, agências e equipes de SEO.",
  },
];

export const SUBSCRIPTION_FAQS = [
  {
    q: "Posso cancelar quando quiser?",
    a: "Sim. Você cancela a qualquer momento no portal do cliente, e o acesso continua até o fim do período já pago.",
  },
  {
    q: "Os artigos que não usei acumulam para o mês seguinte?",
    a: "Não. A cota de artigos é renovada a cada mês e não acumula.",
  },
  {
    q: "Quais formas de pagamento são aceitas?",
    a: "Cartão de crédito via Stripe em Real (R$).",
  },
  {
    q: "O que acontece se o pagamento falhar?",
    a: "Avisamos você por e-mail e tentamos cobrar novamente. Se não for resolvido, a conta volta ao plano Grátis.",
  },
  {
    q: "Posso mudar de plano?",
    a: "Sim, você faz upgrade ou downgrade pelo portal do cliente, e o valor é ajustado proporcionalmente.",
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
