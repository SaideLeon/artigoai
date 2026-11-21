import Stripe from "stripe";
import { PRICING_TIERS, type CurrencyCode, type PricingTier } from "@/lib/pricing";

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

export function findPricingTier(packageId: string): PricingTier | undefined {
  return PRICING_TIERS.find((t) => t.id === packageId);
}

export function getStripeAmountCents(
  tier: PricingTier,
  currency: CurrencyCode
): number {
  const value = currency === "BRL" ? tier.totalBrl : tier.totalUsd;
  return Math.round(value * 100);
}
