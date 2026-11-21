import Stripe from "stripe";
import {
  SUBSCRIPTION_PLANS,
  type BillingCycle,
  type PaidPlanId,
  type SubscriptionPlan,
} from "@/lib/pricing";

let stripeInstance: Stripe | null = null;

const DEFAULT_STRIPE_PRODUCT_IDS: Partial<Record<PaidPlanId, string>> = {
  starter: "prod_VfVM45LGSnWLoH",
  pro: "prod_VfW1i8hFclTPOh",
  agencia: "prod_VfWGdFmGE4oQnu",
};

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

export function getStripeClient(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) {
    throw new Error(
      "Stripe não configurado no servidor: defina STRIPE_SECRET_KEY nas variáveis de ambiente."
    );
  }
  if (!stripeInstance) {
    stripeInstance = new Stripe(secretKey);
  }
  return stripeInstance;
}

export function findSubscriptionPlan(
  planId: string
): SubscriptionPlan | undefined {
  return SUBSCRIPTION_PLANS.find((p) => p.id === planId);
}

export function getSubscriptionAmountCents(
  plan: SubscriptionPlan,
  billingCycle: BillingCycle
): number {
  const value =
    billingCycle === "yearly" ? plan.precoAnualBrl : plan.precoMensalBrl;
  return Math.round(value * 100);
}

export function getStripeProductId(planId: PaidPlanId): string | null {
  const envMap: Record<PaidPlanId, string | undefined> = {
    starter: process.env.STRIPE_PRODUCT_STARTER_ID,
    pro: process.env.STRIPE_PRODUCT_PRO_ID,
    agencia: process.env.STRIPE_PRODUCT_AGENCIA_ID,
  };
  const val = envMap[planId]?.trim() || DEFAULT_STRIPE_PRODUCT_IDS[planId];
  return val && val.startsWith("prod_") ? val : null;
}

export function getConfiguredStripePriceId(
  planId: PaidPlanId,
  billingCycle: BillingCycle
): string | null {
  const envMap: Record<string, string | undefined> = {
    starter_monthly: process.env.STRIPE_PRICE_STARTER_MONTHLY,
    starter_yearly: process.env.STRIPE_PRICE_STARTER_YEARLY,
    pro_monthly: process.env.STRIPE_PRICE_PRO_MONTHLY,
    pro_yearly: process.env.STRIPE_PRICE_PRO_YEARLY,
    agencia_monthly: process.env.STRIPE_PRICE_AGENCIA_MONTHLY,
    agencia_yearly: process.env.STRIPE_PRICE_AGENCIA_YEARLY,
  };
  const val = envMap[`${planId}_${billingCycle}`]?.trim();
  return val && val.startsWith("price_") ? val : null;
}

export async function resolveStripeLineItem(
  stripe: Stripe,
  plan: SubscriptionPlan,
  billingCycle: BillingCycle
): Promise<Stripe.Checkout.SessionCreateParams.LineItem> {
  const configuredPriceId = getConfiguredStripePriceId(plan.id, billingCycle);
  if (configuredPriceId) {
    return { price: configuredPriceId, quantity: 1 };
  }

  const unitAmount = getSubscriptionAmountCents(plan, billingCycle);
  const interval: "month" | "year" =
    billingCycle === "yearly" ? "year" : "month";
  const productId = getStripeProductId(plan.id);

  if (productId) {
    try {
      const prices = await stripe.prices.list({
        product: productId,
        active: true,
        limit: 20,
      });
      const matched = prices.data.find(
        (p) =>
          p.currency.toLowerCase() === "brl" &&
          p.recurring?.interval === interval &&
          (p.recurring.interval_count ?? 1) === 1 &&
          p.unit_amount === unitAmount
      );
      if (matched) {
        return { price: matched.id, quantity: 1 };
      }

      const product = await stripe.products.retrieve(productId);
      if (product && !("deleted" in product && product.deleted)) {
        return {
          quantity: 1,
          price_data: {
            currency: "brl",
            unit_amount: unitAmount,
            recurring: { interval },
            product: productId,
          },
        };
      }
    } catch {
      // Caso o produto pertença a outro modo (teste vs. produção), usa fallback inline
    }
  }

  return {
    quantity: 1,
    price_data: {
      currency: "brl",
      unit_amount: unitAmount,
      recurring: { interval },
      product_data: {
        name: `Artigen — Plano ${plan.nome} (${
          billingCycle === "yearly" ? "Anual" : "Mensal"
        })`,
        description: `${plan.artigosMes} artigos por mês (~2.500 palavras cada), até 7 imagens 1K com Google Gemini, pesquisa web e HTML. Cancele quando quiser.`,
      },
    },
  };
}

export function resolvePlanFromStripeSubscription(sub: Stripe.Subscription): {
  plan?: SubscriptionPlan;
  billingCycle: BillingCycle;
} {
  const firstItem = sub.items?.data?.[0];
  const price = firstItem?.price;
  const interval = price?.recurring?.interval;
  const billingCycle: BillingCycle =
    interval === "year" || sub.metadata?.billing_cycle === "yearly"
      ? "yearly"
      : "monthly";

  const productRef =
    typeof price?.product === "string"
      ? price.product
      : price?.product?.id ?? null;

  if (productRef) {
    for (const p of SUBSCRIPTION_PLANS) {
      if (getStripeProductId(p.id) === productRef) {
        return { plan: p, billingCycle };
      }
    }
  }

  if (typeof price?.unit_amount === "number") {
    const byAmount = SUBSCRIPTION_PLANS.find(
      (p) => getSubscriptionAmountCents(p, billingCycle) === price.unit_amount
    );
    if (byAmount) {
      return { plan: byAmount, billingCycle };
    }
  }

  const fromMeta = findSubscriptionPlan(sub.metadata?.plan_id ?? "");
  return { plan: fromMeta, billingCycle };
}
