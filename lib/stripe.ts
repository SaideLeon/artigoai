import Stripe from "stripe";
import {
  SUBSCRIPTION_PLANS,
  type BillingCycle,
  type SubscriptionPlan,
} from "@/lib/pricing";

let stripeInstance: Stripe | null = null;

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
