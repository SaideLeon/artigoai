import { createClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import { findPricingTier, getStripeAmountCents } from "@/lib/stripe";
import type { CurrencyCode } from "@/lib/pricing";

export type FulfillmentResult = {
  fulfilled: boolean;
  alreadyProcessed: boolean;
  dbUpdated: boolean;
  packageId: string;
  articlesGranted: number;
  amountCents: number;
  currency: CurrencyCode;
  error?: string;
};

function getSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceRoleKey) return null;
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function fulfillStripeCheckoutSession(
  session: Stripe.Checkout.Session
): Promise<FulfillmentResult> {
  const packageId = session.metadata?.package_id ?? "";
  const userId = session.metadata?.user_id ?? "";
  const rawCurrency = (
    session.metadata?.currency ||
    session.currency ||
    "BRL"
  ).toUpperCase();
  const currency: CurrencyCode = rawCurrency === "USD" ? "USD" : "BRL";

  const tier = findPricingTier(packageId);
  if (!tier || !userId) {
    return {
      fulfilled: false,
      alreadyProcessed: false,
      dbUpdated: false,
      packageId,
      articlesGranted: 0,
      amountCents: 0,
      currency,
      error: "Metadados da sessão Stripe inválidos ou pacote desconhecido.",
    };
  }

  if (session.payment_status !== "paid") {
    return {
      fulfilled: false,
      alreadyProcessed: false,
      dbUpdated: false,
      packageId: tier.id,
      articlesGranted: tier.artigos,
      amountCents:
        session.amount_total ?? getStripeAmountCents(tier, currency),
      currency,
      error: "Pagamento ainda não confirmado pela Stripe.",
    };
  }

  const amountCents =
    typeof session.amount_total === "number"
      ? session.amount_total
      : getStripeAmountCents(tier, currency);
  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? null;

  const admin = getSupabaseAdminClient();
  if (!admin) {
    return {
      fulfilled: true,
      alreadyProcessed: false,
      dbUpdated: false,
      packageId: tier.id,
      articlesGranted: tier.artigos,
      amountCents,
      currency,
    };
  }

  // Idempotency check by stripe_session_id (if column exists)
  const { data: existing, error: existingErr } = await admin
    .from("payments")
    .select("id")
    .eq("stripe_session_id", session.id)
    .maybeSingle();

  if (!existingErr && existing) {
    return {
      fulfilled: true,
      alreadyProcessed: true,
      dbUpdated: true,
      packageId: tier.id,
      articlesGranted: tier.artigos,
      amountCents,
      currency,
    };
  }

  // Insert payment record (with graceful fallback if older schema lacks stripe_session_id column)
  const basePayment = {
    user_id: userId,
    package_id: tier.id,
    articles_granted: tier.artigos,
    amount_cents: amountCents,
    currency,
    status: "paid",
  };

  let insertError = (
    await admin.from("payments").insert({
      ...basePayment,
      stripe_session_id: session.id,
      stripe_payment_intent_id: paymentIntentId,
    })
  ).error;

  if (insertError && insertError.message.includes("stripe_session_id")) {
    insertError = (await admin.from("payments").insert(basePayment)).error;
  }

  if (insertError) {
    // Unique constraint race condition means another webhook/verify request already processed it
    if (insertError.code === "23505") {
      return {
        fulfilled: true,
        alreadyProcessed: true,
        dbUpdated: true,
        packageId: tier.id,
        articlesGranted: tier.artigos,
        amountCents,
        currency,
      };
    }
    console.error("Erro ao registar pagamento Stripe no Supabase:", insertError.message);
    return {
      fulfilled: true,
      alreadyProcessed: false,
      dbUpdated: false,
      packageId: tier.id,
      articlesGranted: tier.artigos,
      amountCents,
      currency,
      error: insertError.message,
    };
  }

  // Activate paid plan in subscriptions
  const { error: subError } = await admin.from("subscriptions").upsert(
    {
      user_id: userId,
      plan: tier.id,
      active_package: tier.id,
      status: "active",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (subError) {
    console.error("Erro ao atualizar assinatura no Supabase:", subError.message);
  }

  // Credit purchased articles in usage_limits
  const { data: currentUsage } = await admin
    .from("usage_limits")
    .select("article_credits")
    .eq("user_id", userId)
    .maybeSingle();

  const currentCredits = Number(currentUsage?.article_credits ?? 0);
  const nextCredits = Math.max(0, currentCredits) + tier.artigos;

  const { error: usageError } = await admin.from("usage_limits").upsert(
    {
      user_id: userId,
      article_credits: nextCredits,
    },
    { onConflict: "user_id" }
  );

  if (usageError) {
    console.error("Erro ao creditar artigos no Supabase:", usageError.message);
  }

  return {
    fulfilled: true,
    alreadyProcessed: false,
    dbUpdated: !subError && !usageError,
    packageId: tier.id,
    articlesGranted: tier.artigos,
    amountCents,
    currency,
  };
}
