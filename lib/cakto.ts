import crypto from "crypto";
import {
  SUBSCRIPTION_PLANS,
  type BillingCycle,
  type PaidPlanId,
  type SubscriptionPlan,
} from "@/lib/pricing";

const CAKTO_API_BASE = "https://api.cakto.com.br/public_api";
const CAKTO_PAY_BASE = "https://pay.cakto.com.br";
export const CAKTO_BUYER_PORTAL_URL = "https://assinatura.cakto.com.br/";

type CachedToken = {
  accessToken: string;
  expiresAtMs: number;
};

type CachedOffer = {
  id: string;
  name?: string;
  price?: number | string;
  status?: string;
  type?: string;
  intervalType?: string;
  interval?: number;
  recurrence_period?: number;
  product?: string;
};

let cachedOAuthToken: CachedToken | null = null;
let cachedOffers: { items: CachedOffer[]; fetchedAtMs: number } | null = null;

// Segredo efémero de fallback por processo caso nenhuma variável secreta esteja definida ainda.
const RUNTIME_FALLBACK_KEY = crypto.randomBytes(32).toString("hex");

function getSigningSecret(): string {
  return (
    process.env.CAKTO_CLIENT_SECRET?.trim() ||
    process.env.CAKTO_WEBHOOK_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    RUNTIME_FALLBACK_KEY
  );
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

const DEFAULT_CAKTO_OFFERS: Partial<Record<string, string>> = {
  starter_monthly: "3e3ipym_1357216",
  starter_yearly: "jzeph29_1357316",
  pro_monthly: "4em9936_1357359",
  pro_yearly: "36fj5k5_1357550",
  agencia_monthly: "3cpxbah_1357633",
  agencia_yearly: "3523arg_1357713",
};

const DEFAULT_CAKTO_PRODUCT_IDS: Partial<Record<string, string>> = {
  starter_monthly: "091cc5d8-999b-4b97-8338-fc556eda39b7",
  starter_yearly: "0cb9127b-40b8-4248-b4d9-ada98a577519",
  pro_monthly: "f4aff12b-7ae7-4568-952a-6e05d6734ec0",
  pro_yearly: "e904c794-07cf-4497-84ac-ea802805c83d",
  agencia_monthly: "4e65c12d-5c77-4345-b0b8-35ae6dc3ecdf",
  agencia_yearly: "d8d0c055-417c-49a2-a2b8-fa761df558f7",
};

export function getConfiguredCaktoOfferRaw(
  planId: PaidPlanId,
  billingCycle: BillingCycle
): string | null {
  const key = `${planId}_${billingCycle}`;
  const envMap: Record<string, string | undefined> = {
    starter_monthly: process.env.CAKTO_OFFER_STARTER_MONTHLY,
    starter_yearly: process.env.CAKTO_OFFER_STARTER_YEARLY,
    pro_monthly: process.env.CAKTO_OFFER_PRO_MONTHLY,
    pro_yearly: process.env.CAKTO_OFFER_PRO_YEARLY,
    agencia_monthly: process.env.CAKTO_OFFER_AGENCIA_MONTHLY,
    agencia_yearly: process.env.CAKTO_OFFER_AGENCIA_YEARLY,
  };
  const val = envMap[key]?.trim() || DEFAULT_CAKTO_OFFERS[key];
  return val || null;
}

export function normalizeCaktoOfferId(rawValue: string): string | null {
  const trimmed = rawValue.trim();
  if (!trimmed) return null;

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      if (!parsed.hostname.endsWith("cakto.com.br")) {
        return null;
      }
      const slug = parsed.pathname.replace(/^\/+|\/+$/g, "").split("/")[0];
      return slug && /^[a-zA-Z0-9_-]{3,80}$/.test(slug) ? slug : null;
    } catch {
      return null;
    }
  }

  return /^[a-zA-Z0-9_-]{3,80}$/.test(trimmed) ? trimmed : null;
}

export function hasAnyConfiguredCaktoOffer(): boolean {
  const cycles: BillingCycle[] = ["monthly", "yearly"];
  for (const plan of SUBSCRIPTION_PLANS) {
    for (const cycle of cycles) {
      const raw = getConfiguredCaktoOfferRaw(plan.id, cycle);
      if (raw && normalizeCaktoOfferId(raw)) {
        return true;
      }
    }
  }
  return false;
}

export function isCaktoApiCredentialsConfigured(): boolean {
  return Boolean(
    process.env.CAKTO_CLIENT_ID?.trim() &&
      process.env.CAKTO_CLIENT_SECRET?.trim()
  );
}

export function isCaktoConfigured(): boolean {
  return isCaktoApiCredentialsConfigured() || hasAnyConfiguredCaktoOffer();
}

export function constantTimeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function createCaktoAttributionToken(params: {
  userId: string;
  planId: PaidPlanId;
  billingCycle: BillingCycle;
}): string {
  const cycleCode = params.billingCycle === "yearly" ? "y" : "m";
  const payload = `${params.userId}|${params.planId}|${cycleCode}`;
  const sig = crypto
    .createHmac("sha256", getSigningSecret())
    .update(payload)
    .digest("base64url")
    .slice(0, 16);
  const encoded = Buffer.from(payload, "utf8").toString("base64url");
  return `art1.${encoded}.${sig}`;
}

export function verifyCaktoAttributionToken(token: string): {
  userId: string;
  planId: PaidPlanId;
  billingCycle: BillingCycle;
} | null {
  const trimmed = token.trim();
  if (!trimmed.startsWith("art1.")) return null;

  const parts = trimmed.split(".");
  if (parts.length !== 3) return null;

  const [, encoded, providedSig] = parts;
  if (!encoded || !providedSig) return null;

  let payload = "";
  try {
    payload = Buffer.from(encoded, "base64url").toString("utf8");
  } catch {
    return null;
  }

  const expectedSig = crypto
    .createHmac("sha256", getSigningSecret())
    .update(payload)
    .digest("base64url")
    .slice(0, 16);

  if (!constantTimeCompare(providedSig, expectedSig)) {
    return null;
  }

  const [userId, planIdRaw, cycleCode] = payload.split("|");
  if (!userId || !planIdRaw) return null;
  const plan = findSubscriptionPlan(planIdRaw);
  if (!plan) return null;

  return {
    userId,
    planId: plan.id,
    billingCycle: cycleCode === "y" ? "yearly" : "monthly",
  };
}

export async function getCaktoAccessToken(): Promise<string> {
  const clientId = process.env.CAKTO_CLIENT_ID?.trim();
  const clientSecret = process.env.CAKTO_CLIENT_SECRET?.trim();

  if (!clientId || !clientSecret) {
    throw new Error(
      "Credenciais da API Cakto não configuradas (defina CAKTO_CLIENT_ID e CAKTO_CLIENT_SECRET)."
    );
  }

  const now = Date.now();
  if (cachedOAuthToken && cachedOAuthToken.expiresAtMs - 60_000 > now) {
    return cachedOAuthToken.accessToken;
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
  });

  const res = await fetch(`${CAKTO_API_BASE}/token/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
    cache: "no-store",
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(
      `Falha ao autenticar na API da Cakto (${res.status}): ${errText.slice(0, 180)}`
    );
  }

  const data = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
  };

  if (!data.access_token) {
    throw new Error("A API da Cakto não retornou access_token.");
  }

  const ttlMs =
    typeof data.expires_in === "number" && data.expires_in > 120
      ? data.expires_in * 1000
      : 3600 * 1000;

  cachedOAuthToken = {
    accessToken: data.access_token,
    expiresAtMs: now + ttlMs,
  };

  return data.access_token;
}

async function caktoApiFetch<T>(
  pathWithQuery: string,
  init: RequestInit = {}
): Promise<T> {
  const token = await getCaktoAccessToken();
  const res = await fetch(`${CAKTO_API_BASE}${pathWithQuery}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(
      `Erro na API Cakto (${res.status}): ${errText.slice(0, 220)}`
    );
  }

  return (await res.json()) as T;
}

export async function listActiveCaktoOffers(): Promise<CachedOffer[]> {
  const now = Date.now();
  if (cachedOffers && now - cachedOffers.fetchedAtMs < 5 * 60_000) {
    return cachedOffers.items;
  }

  const data = await caktoApiFetch<{ results?: CachedOffer[] }>(
    "/offers/?status=active"
  );
  const items = Array.isArray(data.results) ? data.results : [];
  cachedOffers = { items, fetchedAtMs: now };
  return items;
}

function parseOfferPriceCents(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return raw >= 1000 && Number.isInteger(raw)
      ? raw
      : Math.round(raw * 100);
  }
  if (typeof raw === "string") {
    const normalized = raw.replace(",", ".").trim();
    const num = Number(normalized);
    if (!Number.isFinite(num)) return null;
    return normalized.includes(".") ? Math.round(num * 100) : Math.round(num * 100);
  }
  return null;
}

export async function resolveCaktoOfferId(
  plan: SubscriptionPlan,
  billingCycle: BillingCycle
): Promise<string | null> {
  const envRaw = getConfiguredCaktoOfferRaw(plan.id, billingCycle);
  if (envRaw) {
    const normalized = normalizeCaktoOfferId(envRaw);
    if (normalized) return normalized;
  }

  if (!isCaktoApiCredentialsConfigured()) {
    return null;
  }

  try {
    const offers = await listActiveCaktoOffers();
    const targetCents = getSubscriptionAmountCents(plan, billingCycle);
    const planSlug = plan.id.toLowerCase();
    const planName = plan.nome.toLowerCase();

    const byPriceAndName = offers.find((offer) => {
      const cents = parseOfferPriceCents(offer.price);
      const nameLower = (offer.name ?? "").toLowerCase();
      return (
        cents === targetCents &&
        (nameLower.includes(planSlug) || nameLower.includes(planName))
      );
    });
    if (byPriceAndName?.id) return byPriceAndName.id;

    const byPrice = offers.find((offer) => {
      const cents = parseOfferPriceCents(offer.price);
      if (cents !== targetCents) return false;
      const intervalStr = (offer.intervalType ?? "").toLowerCase();
      if (!intervalStr) return true;
      return billingCycle === "yearly"
        ? intervalStr.includes("year") || intervalStr.includes("ano")
        : intervalStr.includes("month") || intervalStr.includes("mes");
    });
    if (byPrice?.id) return byPrice.id;
  } catch {
    // Fallback controlado caso a conta Cakto ainda não tenha ofertas via API
  }

  return null;
}

export function buildCaktoCheckoutUrl(params: {
  offerId: string;
  userId: string;
  planId: PaidPlanId;
  billingCycle: BillingCycle;
  email?: string | null;
  name?: string | null;
}): { url: string; trackingToken: string } {
  const safeOfferId = normalizeCaktoOfferId(params.offerId);
  if (!safeOfferId) {
    throw new Error("Identificador de oferta Cakto inválido.");
  }

  const trackingToken = createCaktoAttributionToken({
    userId: params.userId,
    planId: params.planId,
    billingCycle: params.billingCycle,
  });

  const checkoutUrl = new URL(`${CAKTO_PAY_BASE}/${safeOfferId}`);
  if (params.name?.trim()) {
    checkoutUrl.searchParams.set("name", params.name.trim().slice(0, 120));
  }
  if (params.email?.trim()) {
    const cleanEmail = params.email.trim();
    checkoutUrl.searchParams.set("email", cleanEmail);
    checkoutUrl.searchParams.set("confirmEmail", cleanEmail);
  }
  checkoutUrl.searchParams.set("sck", trackingToken);

  return {
    url: checkoutUrl.toString(),
    trackingToken,
  };
}

export function resolvePlanFromOfferId(offerId: string | null | undefined): {
  plan?: SubscriptionPlan;
  billingCycle: BillingCycle;
} {
  if (!offerId) {
    return { billingCycle: "monthly" };
  }
  const normalizedTarget = normalizeCaktoOfferId(offerId);
  if (!normalizedTarget) {
    return { billingCycle: "monthly" };
  }

  const targetPrefix = normalizedTarget.split("_")[0];
  const cycles: BillingCycle[] = ["monthly", "yearly"];
  for (const plan of SUBSCRIPTION_PLANS) {
    for (const cycle of cycles) {
      const raw = getConfiguredCaktoOfferRaw(plan.id, cycle);
      const configuredId = raw ? normalizeCaktoOfferId(raw) : null;
      if (
        configuredId &&
        (configuredId === normalizedTarget ||
          configuredId.split("_")[0] === targetPrefix)
      ) {
        return { plan, billingCycle: cycle };
      }
    }
  }

  return { billingCycle: "monthly" };
}

export function resolvePlanFromProductId(
  productId: string | null | undefined
): {
  plan?: SubscriptionPlan;
  billingCycle: BillingCycle;
} {
  const cleanId = productId?.trim();
  if (!cleanId) {
    return { billingCycle: "monthly" };
  }

  const envMap: Record<string, string | undefined> = {
    starter_monthly: process.env.CAKTO_PRODUCT_STARTER_MONTHLY,
    starter_yearly: process.env.CAKTO_PRODUCT_STARTER_YEARLY,
    pro_monthly: process.env.CAKTO_PRODUCT_PRO_MONTHLY,
    pro_yearly: process.env.CAKTO_PRODUCT_PRO_YEARLY,
    agencia_monthly: process.env.CAKTO_PRODUCT_AGENCIA_MONTHLY,
    agencia_yearly: process.env.CAKTO_PRODUCT_AGENCIA_YEARLY,
  };

  const cycles: BillingCycle[] = ["monthly", "yearly"];
  for (const plan of SUBSCRIPTION_PLANS) {
    for (const cycle of cycles) {
      const key = `${plan.id}_${cycle}`;
      const configuredProductId =
        envMap[key]?.trim() || DEFAULT_CAKTO_PRODUCT_IDS[key];
      if (configuredProductId && configuredProductId === cleanId) {
        return { plan, billingCycle: cycle };
      }
    }
  }

  return { billingCycle: "monthly" };
}

export type CaktoOrderRecord = {
  id: string;
  refId?: string;
  status?: string;
  type?: string;
  amount?: number | string;
  baseAmount?: number | string;
  currency?: string;
  paymentMethod?: string;
  payment_method?: string;
  subscription?: string | { id?: string } | null;
  offer?: { id?: string; name?: string; price?: number | string } | string | null;
  product?: { id?: string; name?: string } | null;
  customer?: {
    name?: string;
    email?: string;
    phone?: string;
    document?: string;
  } | null;
  tracking?: { sck?: string; src?: string } | null;
  metadata?: Record<string, unknown> | null;
  sck?: string;
  createdAt?: string;
  paidAt?: string;
};

export async function fetchCaktoOrderById(
  orderId: string
): Promise<CaktoOrderRecord | null> {
  const cleanId = orderId.trim();
  if (!/^[a-zA-Z0-9_-]{3,80}$/.test(cleanId)) {
    return null;
  }

  try {
    return await caktoApiFetch<CaktoOrderRecord>(
      `/orders/${encodeURIComponent(cleanId)}/`
    );
  } catch {
    return null;
  }
}

export async function searchCaktoOrders(
  search: string
): Promise<CaktoOrderRecord[]> {
  const query = new URLSearchParams({ search: search.trim() });
  const data = await caktoApiFetch<{ results?: CaktoOrderRecord[] }>(
    `/orders/?${query.toString()}`
  );
  return Array.isArray(data.results) ? data.results : [];
}

export async function cancelCaktoSubscription(
  subscriptionId: string
): Promise<{ canceled: boolean; message?: string }> {
  const cleanId = subscriptionId.trim();
  if (!/^[a-zA-Z0-9_-]{3,80}$/.test(cleanId)) {
    return { canceled: false, message: "Identificador de assinatura inválido." };
  }

  await caktoApiFetch<unknown>(
    `/subscriptions/${encodeURIComponent(cleanId)}/cancel/`,
    { method: "POST" }
  );

  return { canceled: true };
}
