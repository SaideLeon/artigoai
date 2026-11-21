import { createClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import {
  findSubscriptionPlan,
  getSubscriptionAmountCents,
} from "@/lib/stripe";
import { FREE_PLAN, type BillingCycle } from "@/lib/pricing";

export type FulfillmentResult = {
  fulfilled: boolean;
  alreadyProcessed: boolean;
  dbUpdated: boolean;
  planId: string;
  billingCycle: BillingCycle;
  articlesPerMonth: number;
  amountCents: number;
  error?: string;
};

export function getSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceRoleKey) return null;
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function normalizeBillingCycle(raw: unknown): BillingCycle {
  return raw === "yearly" ? "yearly" : "monthly";
}

function extractPeriodEndIso(sub: Stripe.Subscription | null): string | null {
  if (!sub) return null;
  const topLevel = (sub as unknown as { current_period_end?: number })
    .current_period_end;
  const itemLevel = sub.items?.data?.[0]?.current_period_end;
  const unixSec =
    typeof itemLevel === "number"
      ? itemLevel
      : typeof topLevel === "number"
      ? topLevel
      : null;
  return unixSec ? new Date(unixSec * 1000).toISOString() : null;
}

export async function getUserStripeCustomerId(
  userId: string
): Promise<string | null> {
  const admin = getSupabaseAdminClient();
  if (!admin) return null;
  const { data } = await admin
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", userId)
    .maybeSingle();
  return typeof data?.stripe_customer_id === "string" && data.stripe_customer_id
    ? data.stripe_customer_id
    : null;
}

export async function fulfillSubscriptionCheckoutSession(
  session: Stripe.Checkout.Session,
  stripe?: Stripe
): Promise<FulfillmentResult> {
  const planId =
    session.metadata?.plan_id ?? session.metadata?.package_id ?? "";
  const userId = session.metadata?.user_id ?? session.client_reference_id ?? "";
  const billingCycle = normalizeBillingCycle(session.metadata?.billing_cycle);

  const plan = findSubscriptionPlan(planId);
  if (!plan || !userId) {
    return {
      fulfilled: false,
      alreadyProcessed: false,
      dbUpdated: false,
      planId,
      billingCycle,
      articlesPerMonth: 0,
      amountCents: 0,
      error: "Metadados da sessão Stripe inválidos ou plano desconhecido.",
    };
  }

  const isPaid =
    session.payment_status === "paid" || session.status === "complete";
  if (!isPaid) {
    return {
      fulfilled: false,
      alreadyProcessed: false,
      dbUpdated: false,
      planId: plan.id,
      billingCycle,
      articlesPerMonth: plan.artigosMes,
      amountCents:
        session.amount_total ?? getSubscriptionAmountCents(plan, billingCycle),
      error: "Assinatura ainda não confirmada pela Stripe.",
    };
  }

  const amountCents =
    typeof session.amount_total === "number"
      ? session.amount_total
      : getSubscriptionAmountCents(plan, billingCycle);
  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id ?? null;
  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id ?? null;
  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? null;

  let periodEndIso: string | null = null;
  if (stripe && subscriptionId) {
    try {
      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      periodEndIso = extractPeriodEndIso(sub);
    } catch {
      periodEndIso = null;
    }
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    return {
      fulfilled: true,
      alreadyProcessed: false,
      dbUpdated: false,
      planId: plan.id,
      billingCycle,
      articlesPerMonth: plan.artigosMes,
      amountCents,
    };
  }

  // Idempotência via stripe_session_id
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
      planId: plan.id,
      billingCycle,
      articlesPerMonth: plan.artigosMes,
      amountCents,
    };
  }

  const basePayment = {
    user_id: userId,
    package_id: plan.id,
    articles_granted: plan.artigosMes,
    amount_cents: amountCents,
    currency: "BRL",
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

  if (insertError?.code === "23505") {
    return {
      fulfilled: true,
      alreadyProcessed: true,
      dbUpdated: true,
      planId: plan.id,
      billingCycle,
      articlesPerMonth: plan.artigosMes,
      amountCents,
    };
  }

  const subPayload: Record<string, unknown> = {
    user_id: userId,
    plan: plan.id,
    billing_cycle: billingCycle,
    active_package: plan.id,
    status: "active",
    stripe_customer_id: customerId,
    stripe_subscription_id: subscriptionId,
    updated_at: new Date().toISOString(),
  };
  if (periodEndIso) {
    subPayload.current_period_end = periodEndIso;
  }

  const { error: subError } = await admin
    .from("subscriptions")
    .upsert(subPayload, { onConflict: "user_id" });

  // Cota mensal renovada (não acumula artigos não usados do mês anterior)
  const { error: usageError } = await admin.from("usage_limits").upsert(
    {
      user_id: userId,
      monthly_articles_limit: plan.artigosMes,
      monthly_articles_used: 0,
      reset_at:
        periodEndIso ??
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    },
    { onConflict: "user_id" }
  );

  return {
    fulfilled: true,
    alreadyProcessed: false,
    dbUpdated: !insertError && !subError && !usageError,
    planId: plan.id,
    billingCycle,
    articlesPerMonth: plan.artigosMes,
    amountCents,
    error: insertError?.message || subError?.message || usageError?.message,
  };
}

export async function handleStripeInvoicePaid(
  invoice: Stripe.Invoice,
  stripe: Stripe
): Promise<void> {
  const admin = getSupabaseAdminClient();
  if (!admin) return;

  const rawSub =
    invoice.parent?.subscription_details?.subscription ??
    (invoice as unknown as { subscription?: string | { id?: string } })
      .subscription;
  const subscriptionId =
    typeof rawSub === "string" ? rawSub : rawSub?.id ?? null;
  if (!subscriptionId) return;

  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  const userId = sub.metadata?.user_id ?? "";
  const planId = sub.metadata?.plan_id ?? "";
  const billingCycle = normalizeBillingCycle(sub.metadata?.billing_cycle);
  const plan = findSubscriptionPlan(planId);
  if (!userId || !plan) return;

  const periodEndIso = extractPeriodEndIso(sub);

  // Evita duplicar pagamento caso já tenha sido processado pelo invoice_id
  const { data: existing } = await admin
    .from("payments")
    .select("id")
    .eq("stripe_invoice_id", invoice.id)
    .maybeSingle();

  if (!existing && (invoice.amount_paid ?? 0) > 0) {
    await admin.from("payments").insert({
      user_id: userId,
      package_id: plan.id,
      articles_granted: plan.artigosMes,
      amount_cents: invoice.amount_paid,
      currency: "BRL",
      status: "paid",
      stripe_invoice_id: invoice.id,
    });
  }

  await admin.from("subscriptions").upsert(
    {
      user_id: userId,
      plan: plan.id,
      billing_cycle: billingCycle,
      active_package: plan.id,
      status: "active",
      stripe_customer_id:
        typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? null,
      stripe_subscription_id: sub.id,
      current_period_end: periodEndIso,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  // Renova cota do mês sem acumular sobras anteriores
  await admin.from("usage_limits").upsert(
    {
      user_id: userId,
      monthly_articles_limit: plan.artigosMes,
      monthly_articles_used: 0,
      reset_at:
        periodEndIso ??
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    },
    { onConflict: "user_id" }
  );
}

export async function handleStripeSubscriptionUpdated(
  sub: Stripe.Subscription
): Promise<void> {
  const admin = getSupabaseAdminClient();
  if (!admin) return;

  const userId = sub.metadata?.user_id ?? "";
  if (!userId) return;

  const planId = sub.metadata?.plan_id ?? "";
  const plan = findSubscriptionPlan(planId);
  const billingCycle = normalizeBillingCycle(sub.metadata?.billing_cycle);
  const periodEndIso = extractPeriodEndIso(sub);

  const mappedStatus =
    sub.status === "active" || sub.status === "trialing"
      ? "active"
      : sub.status === "past_due" || sub.status === "unpaid"
      ? "past_due"
      : "canceled";

  const effectivePlan =
    mappedStatus === "canceled" ? "free" : plan?.id ?? "starter";
  const effectiveLimit =
    mappedStatus === "canceled"
      ? FREE_PLAN.artigosMes
      : plan?.artigosMes ?? FREE_PLAN.artigosMes;

  await admin.from("subscriptions").upsert(
    {
      user_id: userId,
      plan: effectivePlan,
      billing_cycle: billingCycle,
      active_package: effectivePlan,
      status: mappedStatus,
      stripe_customer_id:
        typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? null,
      stripe_subscription_id: sub.id,
      current_period_end: periodEndIso,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  await admin.from("usage_limits").upsert(
    {
      user_id: userId,
      monthly_articles_limit: effectiveLimit,
    },
    { onConflict: "user_id" }
  );
}

export async function handleStripeSubscriptionDeleted(
  sub: Stripe.Subscription
): Promise<void> {
  const admin = getSupabaseAdminClient();
  if (!admin) return;

  const userId = sub.metadata?.user_id ?? "";
  if (!userId) return;

  await admin.from("subscriptions").upsert(
    {
      user_id: userId,
      plan: "free",
      billing_cycle: "monthly",
      active_package: "free",
      status: "canceled",
      stripe_subscription_id: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  await admin.from("usage_limits").upsert(
    {
      user_id: userId,
      monthly_articles_limit: FREE_PLAN.artigosMes,
      monthly_articles_used: 0,
    },
    { onConflict: "user_id" }
  );
}

export async function handleStripeInvoicePaymentFailed(
  invoice: Stripe.Invoice,
  stripe: Stripe
): Promise<void> {
  const admin = getSupabaseAdminClient();
  if (!admin) return;

  const rawSub =
    invoice.parent?.subscription_details?.subscription ??
    (invoice as unknown as { subscription?: string | { id?: string } })
      .subscription;
  const subscriptionId =
    typeof rawSub === "string" ? rawSub : rawSub?.id ?? null;
  if (!subscriptionId) return;

  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  const userId = sub.metadata?.user_id ?? "";
  if (!userId) return;

  await admin
    .from("subscriptions")
    .update({
      status: "past_due",
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
}
