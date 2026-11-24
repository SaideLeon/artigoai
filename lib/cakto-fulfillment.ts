import { createClient } from "@supabase/supabase-js";
import {
  findSubscriptionPlan,
  getSubscriptionAmountCents,
  resolvePlanFromOfferId,
  resolvePlanFromProductId,
  verifyCaktoAttributionToken,
  type CaktoOrderRecord,
} from "@/lib/cakto";
import {
  FREE_PLAN,
  SUBSCRIPTION_PLANS,
  type BillingCycle,
  type SubscriptionPlan,
} from "@/lib/pricing";
import {
  recordPartnerCommissionForPayment,
  reversePartnerCommissionForTransaction,
} from "@/lib/partner-commissions";
import { notifySubscriptionConfirmed } from "@/lib/email";

export type CaktoFulfillmentResult = {
  fulfilled: boolean;
  alreadyProcessed: boolean;
  dbUpdated: boolean;
  planId: string;
  billingCycle: BillingCycle;
  articlesPerMonth: number;
  amountCents: number;
  orderId?: string;
  paymentMethod?: string;
  error?: string;
};

export type CaktoWebhookPayload = {
  secret?: unknown;
  event?: unknown;
  data?: Record<string, unknown> | null;
};

export function getSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !serviceRoleKey) return null;
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeCaktoAmountCents(
  rawAmount: unknown,
  plan: SubscriptionPlan | undefined,
  billingCycle: BillingCycle
): number {
  const fallbackCents = plan
    ? getSubscriptionAmountCents(plan, billingCycle)
    : 0;

  let numeric: number | null = null;
  if (typeof rawAmount === "number" && Number.isFinite(rawAmount) && rawAmount > 0) {
    numeric = rawAmount;
  } else if (typeof rawAmount === "string") {
    const cleaned = rawAmount.replace(",", ".").trim();
    const parsed = Number(cleaned);
    if (Number.isFinite(parsed) && parsed > 0) {
      numeric = parsed;
    }
  }

  if (numeric === null) {
    return fallbackCents;
  }

  const asBrlCents = Math.round(numeric * 100);
  if (plan) {
    const expectedCents = getSubscriptionAmountCents(plan, billingCycle);
    const diffAsBrl = Math.abs(asBrlCents - expectedCents);
    const diffAsCents = Math.abs(numeric - expectedCents);
    if (diffAsCents < diffAsBrl && diffAsCents <= 500) {
      return Math.round(numeric);
    }
    return asBrlCents;
  }

  return numeric >= 20000 && Number.isInteger(numeric)
    ? Math.round(numeric)
    : asBrlCents;
}

function resolvePlanHeuristic(params: {
  offerId: string | null;
  productId: string | null;
  checkoutUrl: string | null;
  offerName: string | null;
  productName: string | null;
  rawAmount: unknown;
}): { plan?: SubscriptionPlan; billingCycle: BillingCycle } {
  const byOfferEnv = resolvePlanFromOfferId(
    params.checkoutUrl || params.offerId
  );
  if (byOfferEnv.plan) return byOfferEnv;

  const byProductId = resolvePlanFromProductId(params.productId);
  if (byProductId.plan) return byProductId;

  const combinedText = `${params.offerName ?? ""} ${params.productName ?? ""}`.toLowerCase();
  const billingCycle: BillingCycle =
    combinedText.includes("anual") || combinedText.includes("yearly")
      ? "yearly"
      : "monthly";

  if (combinedText.includes("agencia") || combinedText.includes("agência")) {
    return { plan: findSubscriptionPlan("agencia"), billingCycle };
  }
  if (combinedText.includes("pro")) {
    return { plan: findSubscriptionPlan("pro"), billingCycle };
  }
  if (combinedText.includes("starter")) {
    return { plan: findSubscriptionPlan("starter"), billingCycle };
  }

  // Fallback por valor em BRL ou centavos
  for (const plan of SUBSCRIPTION_PLANS) {
    for (const cycle of ["monthly", "yearly"] as const) {
      const expectedCents = getSubscriptionAmountCents(plan, cycle);
      const parsed = normalizeCaktoAmountCents(params.rawAmount, plan, cycle);
      if (parsed > 0 && Math.abs(parsed - expectedCents) <= 100) {
        return { plan, billingCycle: cycle };
      }
    }
  }

  return { billingCycle: "monthly" };
}

async function findSupabaseUserIdByEmail(
  email: string
): Promise<string | null> {
  const admin = getSupabaseAdminClient();
  if (!admin) return null;
  const targetEmail = email.trim().toLowerCase();
  if (!targetEmail) return null;

  let page = 1;
  const perPage = 200;
  for (let i = 0; i < 10; i++) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage,
    });
    if (error || !data?.users?.length) break;
    const match = data.users.find(
      (u) => (u.email ?? "").trim().toLowerCase() === targetEmail
    );
    if (match?.id) return match.id;
    if (data.users.length < perPage) break;
    page += 1;
  }

  return null;
}

function extractFieldsFromOrderOrData(raw: Record<string, unknown>) {
  const nestedOrder = asRecord(raw.order);
  const customer = asRecord(raw.customer);
  const offer = asRecord(raw.offer);
  const product = asRecord(raw.product);
  const subscriptionObj = asRecord(raw.subscription);
  const tracking = asRecord(raw.tracking);
  const metadata = asRecord(raw.metadata);

  const orderId =
    readString(raw.id) ??
    readString(nestedOrder?.id) ??
    readString(raw.refId) ??
    readString(nestedOrder?.refId);

  const refId = readString(raw.refId) ?? readString(nestedOrder?.refId);
  const status = (
    readString(raw.status) ??
    readString(nestedOrder?.status) ??
    ""
  ).toLowerCase();

  const sckCandidate =
    readString(raw.sck) ??
    readString(tracking?.sck) ??
    readString(metadata?.sck) ??
    readString(nestedOrder?.sck);

  const offerId =
    readString(offer?.id) ??
    (typeof raw.offer === "string" ? readString(raw.offer) : null);
  const offerName = readString(offer?.name);
  const productId =
    readString(product?.id) ??
    (typeof raw.product === "string" ? readString(raw.product) : null);
  const productName = readString(product?.name);
  const checkoutUrl =
    readString(raw.checkoutUrl) ?? readString(raw.checkout);
  const customerEmail =
    readString(customer?.email) ?? readString(raw.email) ?? null;

  const subscriptionId =
    readString(subscriptionObj?.id) ??
    (typeof raw.subscription === "string" ? readString(raw.subscription) : null);

  const paymentMethod =
    readString(raw.paymentMethod) ??
    readString(raw.payment_method) ??
    readString(nestedOrder?.payment_method) ??
    readString(nestedOrder?.paymentMethod) ??
    "pix";

  const rawAmount =
    raw.amount ?? nestedOrder?.amount ?? offer?.price ?? raw.baseAmount;

  const rawFees = raw.fees ?? nestedOrder?.fees ?? 0;
  const commissionsArr = Array.isArray(raw.commissions) ? raw.commissions : [];
  const producerCommission = commissionsArr.find((item) => {
    const rec = asRecord(item);
    return rec && rec.type === "producer";
  });
  const producerNetRaw = asRecord(producerCommission)?.totalAmount ?? null;

  return {
    orderId,
    refId,
    status,
    sckCandidate,
    offerId,
    offerName,
    productId,
    productName,
    checkoutUrl,
    customerEmail,
    subscriptionId,
    paymentMethod,
    rawAmount,
    rawFees,
    producerNetRaw,
  };
}

export async function getUserCaktoSubscriptionInfo(userId: string): Promise<{
  plan: string;
  status: string;
  caktoSubscriptionId: string | null;
  customerEmail: string | null;
}> {
  const admin = getSupabaseAdminClient();
  if (!admin) {
    return {
      plan: "free",
      status: "active",
      caktoSubscriptionId: null,
      customerEmail: null,
    };
  }

  const { data } = await admin
    .from("subscriptions")
    .select("plan, status, stripe_customer_id, stripe_subscription_id")
    .eq("user_id", userId)
    .maybeSingle();

  const rawSub =
    typeof data?.stripe_subscription_id === "string"
      ? data.stripe_subscription_id.trim()
      : "";
  const caktoSubscriptionId = rawSub
    ? rawSub.replace(/^cakto:/, "")
    : null;

  const rawCustomer =
    typeof data?.stripe_customer_id === "string"
      ? data.stripe_customer_id.trim()
      : "";
  const customerEmail = rawCustomer.includes("@") ? rawCustomer : null;

  return {
    plan: typeof data?.plan === "string" ? data.plan : "free",
    status: typeof data?.status === "string" ? data.status : "active",
    caktoSubscriptionId: caktoSubscriptionId || null,
    customerEmail,
  };
}

export async function fulfillCaktoOrderOrEvent(params: {
  rawData: Record<string, unknown> | CaktoOrderRecord;
  eventType?: string;
  explicitUserId?: string;
  forceApproved?: boolean;
}): Promise<CaktoFulfillmentResult> {
  const extracted = extractFieldsFromOrderOrData(
    params.rawData as Record<string, unknown>
  );

  const tokenData = extracted.sckCandidate
    ? verifyCaktoAttributionToken(extracted.sckCandidate)
    : null;

  const resolvedHeuristic = resolvePlanHeuristic({
    offerId: extracted.offerId,
    productId: extracted.productId,
    checkoutUrl: extracted.checkoutUrl,
    offerName: extracted.offerName,
    productName: extracted.productName,
    rawAmount: extracted.rawAmount,
  });

  const plan = tokenData
    ? findSubscriptionPlan(tokenData.planId)
    : resolvedHeuristic.plan;
  const billingCycle: BillingCycle = tokenData
    ? tokenData.billingCycle
    : resolvedHeuristic.billingCycle;

  const userId =
    tokenData?.userId ||
    params.explicitUserId ||
    (extracted.customerEmail
      ? await findSupabaseUserIdByEmail(extracted.customerEmail)
      : null);

  if (!plan || !userId) {
    return {
      fulfilled: false,
      alreadyProcessed: false,
      dbUpdated: false,
      planId: plan?.id ?? "",
      billingCycle,
      articlesPerMonth: plan?.artigosMes ?? 0,
      amountCents: 0,
      orderId: extracted.orderId ?? undefined,
      paymentMethod: extracted.paymentMethod,
      error:
        "Não foi possível associar o pedido Cakto ao utilizador ou ao plano.",
    };
  }

  const paidStatuses = new Set([
    "paid",
    "approved",
    "completed",
    "confirmed",
    "active",
    "authorized",
  ]);
  const isApprovedEvent =
    params.eventType === "purchase_approved" ||
    params.eventType === "subscription_renewed";
  const isPaid =
    params.forceApproved || isApprovedEvent || paidStatuses.has(extracted.status);

  const amountCents = normalizeCaktoAmountCents(
    extracted.rawAmount,
    plan,
    billingCycle
  );

  if (!isPaid) {
    return {
      fulfilled: false,
      alreadyProcessed: false,
      dbUpdated: false,
      planId: plan.id,
      billingCycle,
      articlesPerMonth: plan.artigosMes,
      amountCents,
      orderId: extracted.orderId ?? undefined,
      paymentMethod: extracted.paymentMethod,
      error: "Pagamento ainda pendente de confirmação na Cakto (aguardando Pix/compensação).",
    };
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
      orderId: extracted.orderId ?? undefined,
      paymentMethod: extracted.paymentMethod,
    };
  }

  const idempotencyKey = extracted.orderId
    ? `cakto:${extracted.orderId}`
    : extracted.refId
    ? `cakto_ref:${extracted.refId}`
    : null;

  if (idempotencyKey) {
    // Tenta coluna nova `cakto_order_id` ou coluna compatível `stripe_session_id`
    const { data: existingCakto, error: caktoCheckErr } = await admin
      .from("payments")
      .select("id")
      .eq("cakto_order_id", extracted.orderId ?? idempotencyKey)
      .maybeSingle();

    if (!caktoCheckErr && existingCakto) {
      return {
        fulfilled: true,
        alreadyProcessed: true,
        dbUpdated: true,
        planId: plan.id,
        billingCycle,
        articlesPerMonth: plan.artigosMes,
        amountCents,
        orderId: extracted.orderId ?? undefined,
        paymentMethod: extracted.paymentMethod,
      };
    }

    const { data: existingCompat, error: compatCheckErr } = await admin
      .from("payments")
      .select("id")
      .eq("stripe_session_id", idempotencyKey)
      .maybeSingle();

    if (!compatCheckErr && existingCompat) {
      return {
        fulfilled: true,
        alreadyProcessed: true,
        dbUpdated: true,
        planId: plan.id,
        billingCycle,
        articlesPerMonth: plan.artigosMes,
        amountCents,
        orderId: extracted.orderId ?? undefined,
        paymentMethod: extracted.paymentMethod,
      };
    }
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
      ...(idempotencyKey ? { stripe_session_id: idempotencyKey } : {}),
      stripe_payment_intent_id: `cakto:${extracted.paymentMethod}`,
      cakto_order_id: extracted.orderId ?? idempotencyKey,
      payment_method: extracted.paymentMethod,
    })
  ).error;

  // Fallback transparente se o banco ainda tiver apenas as colunas legadas de 03_billing_and_limits.sql
  if (
    insertError &&
    (insertError.message.includes("cakto_order_id") ||
      insertError.message.includes("payment_method"))
  ) {
    insertError = (
      await admin.from("payments").insert({
        ...basePayment,
        ...(idempotencyKey ? { stripe_session_id: idempotencyKey } : {}),
        stripe_payment_intent_id: `cakto:${extracted.paymentMethod}`,
      })
    ).error;
  }

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
      orderId: extracted.orderId ?? undefined,
      paymentMethod: extracted.paymentMethod,
    };
  }

  const periodDays = billingCycle === "yearly" ? 365 : 30;
  const periodEndIso = new Date(
    Date.now() + periodDays * 24 * 60 * 60 * 1000
  ).toISOString();

  const storedSubRef = extracted.subscriptionId
    ? `cakto:${extracted.subscriptionId}`
    : extracted.orderId
    ? `cakto_ord:${extracted.orderId}`
    : null;

  const subPayloadBase: Record<string, unknown> = {
    user_id: userId,
    plan: plan.id,
    billing_cycle: billingCycle,
    active_package: plan.id,
    status: "active",
    stripe_customer_id: extracted.customerEmail ?? `cakto_user:${userId}`,
    stripe_subscription_id: storedSubRef,
    current_period_end: periodEndIso,
    updated_at: new Date().toISOString(),
  };

  let { error: subError } = await admin.from("subscriptions").upsert(
    {
      ...subPayloadBase,
      cakto_customer_email: extracted.customerEmail,
      cakto_subscription_id: extracted.subscriptionId ?? extracted.orderId,
    },
    { onConflict: "user_id" }
  );

  if (
    subError &&
    (subError.message.includes("cakto_customer_email") ||
      subError.message.includes("cakto_subscription_id"))
  ) {
    const retry = await admin
      .from("subscriptions")
      .upsert(subPayloadBase, { onConflict: "user_id" });
    subError = retry.error;
  }

  // Renova a cota mensal de artigos e imagens (não acumulam para o mês seguinte)
  let { error: usageError } = await admin.from("usage_limits").upsert(
    {
      user_id: userId,
      monthly_articles_limit: plan.artigosMes,
      monthly_articles_used: 0,
      monthly_images_limit: plan.imagensMes,
      monthly_images_used: 0,
      reset_at: periodEndIso,
    },
    { onConflict: "user_id" }
  );

  if (
    usageError &&
    (usageError.message.includes("monthly_images_limit") ||
      usageError.message.includes("monthly_images_used"))
  ) {
    const retryUsage = await admin.from("usage_limits").upsert(
      {
        user_id: userId,
        monthly_articles_limit: plan.artigosMes,
        monthly_articles_used: 0,
        reset_at: periodEndIso,
      },
      { onConflict: "user_id" }
    );
    usageError = retryUsage.error;
  }

  // Registra comissão automática para parceiro indicador (idempotente por id_da_transacao_cakto)
  const commissionTxId =
    extracted.orderId || extracted.refId || idempotencyKey || null;
  if (!insertError && commissionTxId) {
    const parseBrlOrCents = (val: unknown): number => {
      if (typeof val === "number" && Number.isFinite(val) && val > 0) {
        return Math.round(val * 100);
      }
      if (typeof val === "string") {
        const parsed = Number(val.replace(",", ".").trim());
        if (Number.isFinite(parsed) && parsed > 0) {
          return Math.round(parsed * 100);
        }
      }
      return 0;
    };

    const producerNetCents = parseBrlOrCents(extracted.producerNetRaw);
    const feesCents = parseBrlOrCents(extracted.rawFees);
    const computedNetCents =
      producerNetCents > 0 && producerNetCents <= amountCents
        ? producerNetCents
        : feesCents > 0 && feesCents < amountCents
        ? Math.max(0, amountCents - feesCents)
        : amountCents;

    await recordPartnerCommissionForPayment({
      admin,
      userId,
      planId: plan.id,
      billingCycle,
      grossAmountCents: amountCents,
      netAmountCents: computedNetCents,
      transactionId: commissionTxId,
      eventType: params.eventType,
    });
  }

  if (!insertError) {
    try {
      let recipientEmail = extracted.customerEmail ?? "";
      if (!recipientEmail) {
        const { data: userProf } = await admin
          .from("profiles")
          .select("email")
          .eq("id", userId)
          .maybeSingle();
        recipientEmail = userProf?.email ? String(userProf.email) : "";
      }
      if (recipientEmail) {
        await notifySubscriptionConfirmed({
          userEmail: recipientEmail,
          planName: plan.nome,
          planId: plan.id,
          billingCycle,
          articlesPerMonth: plan.artigosMes,
          imagesPerMonth: plan.imagensMes,
          amountCents,
          paymentMethod: extracted.paymentMethod,
        });
      }
    } catch {
      // Nunca bloqueia o fulfillment do webhook se o e-mail falhar
    }
  }

  return {
    fulfilled: true,
    alreadyProcessed: false,
    dbUpdated: !insertError && !subError && !usageError,
    planId: plan.id,
    billingCycle,
    articlesPerMonth: plan.artigosMes,
    amountCents,
    orderId: extracted.orderId ?? undefined,
    paymentMethod: extracted.paymentMethod,
    error: insertError?.message || subError?.message || usageError?.message,
  };
}

export async function handleCaktoSubscriptionLate(
  rawData: Record<string, unknown>
): Promise<void> {
  const admin = getSupabaseAdminClient();
  if (!admin) return;

  const extracted = extractFieldsFromOrderOrData(rawData);
  const tokenData = extracted.sckCandidate
    ? verifyCaktoAttributionToken(extracted.sckCandidate)
    : null;

  const userId =
    tokenData?.userId ||
    (extracted.customerEmail
      ? await findSupabaseUserIdByEmail(extracted.customerEmail)
      : null);

  if (!userId) return;

  await admin
    .from("subscriptions")
    .update({
      status: "past_due",
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
}

export async function handleCaktoSubscriptionCanceledOrRefunded(
  rawData: Record<string, unknown>,
  eventType?: string
): Promise<void> {
  const admin = getSupabaseAdminClient();
  if (!admin) return;

  const extracted = extractFieldsFromOrderOrData(rawData);
  const tokenData = extracted.sckCandidate
    ? verifyCaktoAttributionToken(extracted.sckCandidate)
    : null;

  const userId =
    tokenData?.userId ||
    (extracted.customerEmail
      ? await findSupabaseUserIdByEmail(extracted.customerEmail)
      : null);

  // Em reembolso ou chargeback, estorna a comissão correspondente na tabela commissions
  if (eventType === "refund" || eventType === "chargeback") {
    const parentOrder = readString(rawData.parent_order);
    const txCandidates = [
      extracted.orderId,
      extracted.refId,
      parentOrder,
      extracted.orderId ? `cakto:${extracted.orderId}` : null,
      extracted.refId ? `cakto_ref:${extracted.refId}` : null,
    ].filter((v): v is string => Boolean(v));

    await reversePartnerCommissionForTransaction({
      admin,
      transactionCandidates: txCandidates,
      userId,
    });
  }

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

  const { error: revertUsageError } = await admin.from("usage_limits").upsert(
    {
      user_id: userId,
      monthly_articles_limit: FREE_PLAN.artigosMes,
      monthly_articles_used: 0,
      monthly_images_limit: FREE_PLAN.imagensMes,
      monthly_images_used: 0,
    },
    { onConflict: "user_id" }
  );

  if (
    revertUsageError &&
    (revertUsageError.message.includes("monthly_images_limit") ||
      revertUsageError.message.includes("monthly_images_used"))
  ) {
    await admin.from("usage_limits").upsert(
      {
        user_id: userId,
        monthly_articles_limit: FREE_PLAN.artigosMes,
        monthly_articles_used: 0,
      },
      { onConflict: "user_id" }
    );
  }
}
