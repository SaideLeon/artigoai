import crypto from "crypto";
import type { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdminClient } from "@/lib/cakto-fulfillment";
import { getAuthenticatedServerUser } from "@/lib/partners-server";
import {
  FREE_PLAN,
  getPlanQuotaConfig,
  MAX_IMAGES_PER_ARTICLE,
  type PlanQuotaConfig,
} from "@/lib/pricing";
import type { PlanoGeracao } from "@/lib/types";

export const GUEST_QUOTA_COOKIE = "artigen_guest_quota";

export type UsageStatusSnapshot = {
  authenticated: boolean;
  planId: string;
  planName: string;
  isPaid: boolean;
  status: string;
  monthlyArticlesUsed: number;
  monthlyArticlesLimit: number;
  monthlyImagesUsed: number;
  monthlyImagesLimit: number;
  maxImagesPerArticle: number;
  articleCreditsBonus: number;
  resetAt: string | null;
};

export type QuotaDecision =
  | {
      allowed: true;
      effectivePlano: PlanoGeracao;
      planId: string;
      snapshot: UsageStatusSnapshot;
      deductedArticleCreditForImage?: boolean;
      articleImagesUsed?: number;
      articleImagesAllowance?: number;
      updatedGuestCookieValue?: string;
    }
  | {
      allowed: false;
      status: 401 | 403 | 429;
      code:
        | "paid_plan_required"
        | "article_limit_reached"
        | "monthly_image_limit_reached"
        | "article_image_limit_reached";
      error: string;
      snapshot?: UsageStatusSnapshot;
    };

export type QuotaStateLike = {
  planId: string;
  isPaid: boolean;
  status: string;
  monthlyArticlesUsed: number;
  monthlyArticlesLimit: number;
  monthlyImagesUsed: number;
  monthlyImagesLimit: number;
  articleCreditsBonus: number;
  resetAtIso: string;
  sessions: Record<
    string,
    {
      imagesUsed: number;
      imagesAllowance: number;
      extraArticleCreditsUsed: number;
    }
  >;
};

export function normalizeSessionKey(rawKey: string | null | undefined): string {
  const cleaned = (rawKey ?? "").trim().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);
  return cleaned || "default";
}

function getGuestSigningSecret(): string {
  return (
    process.env.CAKTO_WEBHOOK_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    "artigen-guest-quota-dev-key"
  );
}

function computeNextMonthIso(fromDate = new Date()): string {
  const next = new Date(fromDate);
  next.setUTCMonth(next.getUTCMonth() + 1);
  return next.toISOString();
}

export function reconcileQuotaStateReset(
  state: QuotaStateLike,
  now = new Date()
): QuotaStateLike {
  const resetMs = new Date(state.resetAtIso).getTime();
  if (!Number.isFinite(resetMs) || resetMs <= now.getTime()) {
    return {
      ...state,
      monthlyArticlesUsed: 0,
      monthlyImagesUsed: 0,
      resetAtIso: computeNextMonthIso(now),
      sessions: {},
    };
  }
  return state;
}

/**
 * Máquina de estados pura para consumo de cota de artigo (com suporte a idempotência por sessionKey).
 */
export function evaluateArticleConsumption(params: {
  state: QuotaStateLike;
  sessionKey: string;
  now?: Date;
}): {
  ok: boolean;
  nextState: QuotaStateLike;
  alreadyCounted?: boolean;
  reason?: "article_limit_reached";
} {
  const state = reconcileQuotaStateReset(params.state, params.now);
  const key = normalizeSessionKey(params.sessionKey);

  if (state.sessions[key]) {
    return { ok: true, nextState: state, alreadyCounted: true };
  }

  const hasMonthlyQuota = state.monthlyArticlesUsed < state.monthlyArticlesLimit;
  const hasBonusCredits = !hasMonthlyQuota && state.articleCreditsBonus > 0;

  if (!hasMonthlyQuota && !hasBonusCredits) {
    return {
      ok: false,
      nextState: state,
      reason: "article_limit_reached",
    };
  }

  const nextSessions = {
    ...state.sessions,
    [key]: {
      imagesUsed: 0,
      imagesAllowance: MAX_IMAGES_PER_ARTICLE,
      extraArticleCreditsUsed: 0,
    },
  };

  return {
    ok: true,
    nextState: {
      ...state,
      monthlyArticlesUsed: hasMonthlyQuota
        ? state.monthlyArticlesUsed + 1
        : state.monthlyArticlesUsed,
      articleCreditsBonus: hasBonusCredits
        ? Math.max(0, state.articleCreditsBonus - 1)
        : state.articleCreditsBonus,
      sessions: nextSessions,
    },
  };
}

/**
 * Máquina de estados pura para consumo de cota de imagem:
 * - Respeita limite mensal de imagens (14 Grátis / 98 Starter / 231 Pro / 336 Agência)
 * - Respeita máximo de 7 imagens por artigo incluídas
 * - Se o artigo necessitar de mais de 7 imagens, desconta 1 crédito de artigo ainda não gerado
 *   e libera mais 7 slots de imagem para o artigo (até o teto mensal de imagens).
 */
export function evaluateImageConsumption(params: {
  state: QuotaStateLike;
  sessionKey: string;
  now?: Date;
}): {
  ok: boolean;
  nextState: QuotaStateLike;
  deductedArticleCredit: boolean;
  articleImagesUsed: number;
  articleImagesAllowance: number;
  reason?: "monthly_image_limit_reached" | "article_image_limit_reached";
} {
  const state = reconcileQuotaStateReset(params.state, params.now);
  const key = normalizeSessionKey(params.sessionKey);

  if (state.monthlyImagesUsed >= state.monthlyImagesLimit) {
    const existing = state.sessions[key];
    return {
      ok: false,
      nextState: state,
      deductedArticleCredit: false,
      articleImagesUsed: existing?.imagesUsed ?? 0,
      articleImagesAllowance: existing?.imagesAllowance ?? MAX_IMAGES_PER_ARTICLE,
      reason: "monthly_image_limit_reached",
    };
  }

  let currentArticlesUsed = state.monthlyArticlesUsed;
  let currentBonusCredits = state.articleCreditsBonus;
  const existingSession = state.sessions[key];

  const session = existingSession
    ? { ...existingSession }
    : {
        imagesUsed: 0,
        imagesAllowance: MAX_IMAGES_PER_ARTICLE,
        extraArticleCreditsUsed: 0,
      };

  // Caso seja uma imagem avulsa num artigo sem sessão iniciada, reserva a sessão primeiro se houver artigo disponível
  if (!existingSession) {
    if (currentArticlesUsed < state.monthlyArticlesLimit) {
      currentArticlesUsed += 1;
    } else if (currentBonusCredits > 0) {
      currentBonusCredits -= 1;
    } else {
      return {
        ok: false,
        nextState: state,
        deductedArticleCredit: false,
        articleImagesUsed: 0,
        articleImagesAllowance: MAX_IMAGES_PER_ARTICLE,
        reason: "article_image_limit_reached",
      };
    }
  }

  let deductedArticleCredit = false;
  if (session.imagesUsed >= session.imagesAllowance) {
    // Passou de 7 imagens no mesmo artigo: tenta descontar de artigo ainda não gerado
    if (currentArticlesUsed < state.monthlyArticlesLimit) {
      currentArticlesUsed += 1;
      deductedArticleCredit = true;
    } else if (currentBonusCredits > 0) {
      currentBonusCredits -= 1;
      deductedArticleCredit = true;
    } else {
      return {
        ok: false,
        nextState: state,
        deductedArticleCredit: false,
        articleImagesUsed: session.imagesUsed,
        articleImagesAllowance: session.imagesAllowance,
        reason: "article_image_limit_reached",
      };
    }
    session.imagesAllowance += MAX_IMAGES_PER_ARTICLE;
    session.extraArticleCreditsUsed += 1;
  }

  session.imagesUsed += 1;

  return {
    ok: true,
    nextState: {
      ...state,
      monthlyArticlesUsed: currentArticlesUsed,
      monthlyImagesUsed: state.monthlyImagesUsed + 1,
      articleCreditsBonus: currentBonusCredits,
      sessions: {
        ...state.sessions,
        [key]: session,
      },
    },
    deductedArticleCredit,
    articleImagesUsed: session.imagesUsed,
    articleImagesAllowance: session.imagesAllowance,
  };
}

function buildSnapshotFromState(
  state: QuotaStateLike,
  authenticated: boolean
): UsageStatusSnapshot {
  const cfg = getPlanQuotaConfig(state.planId);
  return {
    authenticated,
    planId: cfg.id,
    planName: cfg.nome,
    isPaid: state.isPaid,
    status: state.status,
    monthlyArticlesUsed: state.monthlyArticlesUsed,
    monthlyArticlesLimit: state.monthlyArticlesLimit,
    monthlyImagesUsed: state.monthlyImagesUsed,
    monthlyImagesLimit: state.monthlyImagesLimit,
    maxImagesPerArticle: MAX_IMAGES_PER_ARTICLE,
    articleCreditsBonus: state.articleCreditsBonus,
    resetAt: state.resetAtIso,
  };
}

// =============================================================================
// Assinatura HMAC para cota de visitante (Guest Trial no Plano Grátis)
// =============================================================================
function parseCookieHeader(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  const pairs = cookieHeader.split(";");
  for (const pair of pairs) {
    const idx = pair.indexOf("=");
    if (idx === -1) continue;
    const key = pair.slice(0, idx).trim();
    if (key === name) {
      return decodeURIComponent(pair.slice(idx + 1).trim());
    }
  }
  return null;
}

function createInitialGuestState(now = new Date()): QuotaStateLike {
  return {
    planId: "free",
    isPaid: false,
    status: "active",
    monthlyArticlesUsed: 0,
    monthlyArticlesLimit: FREE_PLAN.artigosMes,
    monthlyImagesUsed: 0,
    monthlyImagesLimit: FREE_PLAN.imagensMes,
    articleCreditsBonus: 0,
    resetAtIso: computeNextMonthIso(now),
    sessions: {},
  };
}

export function decodeGuestQuotaCookie(
  rawCookie: string | null | undefined,
  now = new Date()
): QuotaStateLike {
  if (!rawCookie) return createInitialGuestState(now);
  const parts = rawCookie.split(".");
  if (parts.length !== 2) return createInitialGuestState(now);
  const [payloadB64, sigB64] = parts;
  if (!payloadB64 || !sigB64) return createInitialGuestState(now);

  try {
    const expectedSig = crypto
      .createHmac("sha256", getGuestSigningSecret())
      .update(payloadB64)
      .digest("base64url");

    const sigBuf = Buffer.from(sigB64);
    const expectedBuf = Buffer.from(expectedSig);
    if (
      sigBuf.length !== expectedBuf.length ||
      !crypto.timingSafeEqual(sigBuf, expectedBuf)
    ) {
      return createInitialGuestState(now);
    }

    const parsed = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf8")
    ) as Partial<QuotaStateLike>;

    return reconcileQuotaStateReset(
      {
        planId: "free",
        isPaid: false,
        status: "active",
        monthlyArticlesUsed: Math.max(0, Number(parsed.monthlyArticlesUsed ?? 0)),
        monthlyArticlesLimit: FREE_PLAN.artigosMes,
        monthlyImagesUsed: Math.max(0, Number(parsed.monthlyImagesUsed ?? 0)),
        monthlyImagesLimit: FREE_PLAN.imagensMes,
        articleCreditsBonus: 0,
        resetAtIso:
          typeof parsed.resetAtIso === "string"
            ? parsed.resetAtIso
            : computeNextMonthIso(now),
        sessions:
          parsed.sessions && typeof parsed.sessions === "object"
            ? (parsed.sessions as QuotaStateLike["sessions"])
            : {},
      },
      now
    );
  } catch {
    return createInitialGuestState(now);
  }
}

export function encodeGuestQuotaCookie(state: QuotaStateLike): string {
  // Limita histórico de sessões para manter cookie compacto (< 2 KB)
  const sessionEntries = Object.entries(state.sessions).slice(-6);
  const compact: QuotaStateLike = {
    ...state,
    sessions: Object.fromEntries(sessionEntries),
  };
  const payloadB64 = Buffer.from(JSON.stringify(compact), "utf8").toString(
    "base64url"
  );
  const sigB64 = crypto
    .createHmac("sha256", getGuestSigningSecret())
    .update(payloadB64)
    .digest("base64url");
  return `${payloadB64}.${sigB64}`;
}

export function attachGuestQuotaCookie(
  res: NextResponse,
  cookieValue: string | undefined
): NextResponse {
  if (!cookieValue) return res;
  res.cookies.set({
    name: GUEST_QUOTA_COOKIE,
    value: cookieValue,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 35,
  });
  return res;
}

// =============================================================================
// Resolução de plano e cota do utilizador autenticado (Supabase)
// =============================================================================
async function loadAuthenticatedUserPlanAndState(
  admin: SupabaseClient,
  userId: string
): Promise<{
  planCfg: PlanQuotaConfig;
  status: string;
  isPaidActive: boolean;
  resetAtIso: string;
  monthlyArticlesUsed: number;
  monthlyArticlesLimit: number;
  monthlyImagesUsed: number;
  monthlyImagesLimit: number;
  articleCreditsBonus: number;
}> {
  const [{ data: sub }, { data: usage }] = await Promise.all([
    admin
      .from("subscriptions")
      .select("plan, status, current_period_end")
      .eq("user_id", userId)
      .maybeSingle(),
    admin
      .from("usage_limits")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  const rawPlan = typeof sub?.plan === "string" ? sub.plan : "free";
  const subStatus = typeof sub?.status === "string" ? sub.status : "active";
  const isPaidActive = rawPlan !== "free" && subStatus === "active";
  const effectivePlanId = isPaidActive ? rawPlan : "free";
  const planCfg = getPlanQuotaConfig(effectivePlanId);

  const now = new Date();
  let resetAtIso =
    typeof usage?.reset_at === "string"
      ? usage.reset_at
      : typeof sub?.current_period_end === "string" &&
        new Date(sub.current_period_end).getTime() > now.getTime()
      ? sub.current_period_end
      : computeNextMonthIso(now);

  let monthlyArticlesUsed = Number(usage?.monthly_articles_used ?? 0);
  let monthlyImagesUsed = Number(
    (usage as Record<string, unknown> | null)?.monthly_images_used ?? 0
  );
  const articleCreditsBonus = Number(usage?.article_credits ?? 0);

  // Reinicia ciclo mensal caso reset_at já tenha vencido
  if (new Date(resetAtIso).getTime() <= now.getTime()) {
    monthlyArticlesUsed = 0;
    monthlyImagesUsed = 0;
    resetAtIso =
      typeof sub?.current_period_end === "string" &&
      new Date(sub.current_period_end).getTime() > now.getTime()
        ? sub.current_period_end
        : computeNextMonthIso(now);

    await admin.from("usage_limits").upsert(
      {
        user_id: userId,
        monthly_articles_used: 0,
        monthly_articles_limit: planCfg.artigosMes,
        reset_at: resetAtIso,
      },
      { onConflict: "user_id" }
    );
  } else if (
    usage &&
    Number(usage.monthly_articles_limit) !== planCfg.artigosMes
  ) {
    // Sincroniza limites atualizados do plano sem apagar o uso já feito no ciclo
    await admin
      .from("usage_limits")
      .update({ monthly_articles_limit: planCfg.artigosMes })
      .eq("user_id", userId);
  }

  return {
    planCfg,
    status: subStatus,
    isPaidActive,
    resetAtIso,
    monthlyArticlesUsed: Math.max(0, monthlyArticlesUsed),
    monthlyArticlesLimit: planCfg.artigosMes,
    monthlyImagesUsed: Math.max(0, monthlyImagesUsed),
    monthlyImagesLimit: planCfg.imagensMes,
    articleCreditsBonus: Math.max(0, articleCreditsBonus),
  };
}

export async function getUserUsageSnapshotForRequest(): Promise<UsageStatusSnapshot> {
  const user = await getAuthenticatedServerUser();
  if (!user) {
    return buildSnapshotFromState(createInitialGuestState(), false);
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    return buildSnapshotFromState(createInitialGuestState(), true);
  }

  const loaded = await loadAuthenticatedUserPlanAndState(admin, user.id);
  return {
    authenticated: true,
    planId: loaded.planCfg.id,
    planName: loaded.planCfg.nome,
    isPaid: loaded.isPaidActive,
    status: loaded.status,
    monthlyArticlesUsed: loaded.monthlyArticlesUsed,
    monthlyArticlesLimit: loaded.monthlyArticlesLimit,
    monthlyImagesUsed: loaded.monthlyImagesUsed,
    monthlyImagesLimit: loaded.monthlyImagesLimit,
    maxImagesPerArticle: MAX_IMAGES_PER_ARTICLE,
    articleCreditsBonus: loaded.articleCreditsBonus,
    resetAt: loaded.resetAtIso,
  };
}

/**
 * Valida acesso ao motor IA e, opcionalmente, consome/valida cota de artigo ou imagem.
 */
export async function enforceGenerationQuota(params: {
  req: Request;
  requestedPlano: PlanoGeracao;
  action: "verify_plan" | "article" | "image";
  sessionKey?: string | null;
}): Promise<QuotaDecision> {
  const { req, requestedPlano, action } = params;
  const sessionKey = normalizeSessionKey(params.sessionKey);
  const user = await getAuthenticatedServerUser();

  // Caso 1: Visitante não autenticado (apenas plano Grátis com limite em cookie assinado)
  if (!user) {
    if (requestedPlano === "paid") {
      return {
        allowed: false,
        status: 401,
        code: "paid_plan_required",
        error:
          "O motor Google Gemini é exclusivo para assinantes dos planos Starter, Pro ou Agência. Inicie sessão e assine um plano para utilizar.",
      };
    }

    const rawCookie = parseCookieHeader(
      req.headers.get("cookie"),
      GUEST_QUOTA_COOKIE
    );
    const guestState = decodeGuestQuotaCookie(rawCookie);

    if (action === "verify_plan") {
      if (guestState.monthlyArticlesUsed >= guestState.monthlyArticlesLimit) {
        return {
          allowed: false,
          status: 403,
          code: "article_limit_reached",
          error: `Atingiu o limite gratuito de ${FREE_PLAN.artigosMes} artigos por mês. Crie sua conta ou assine um plano para continuar gerando.`,
          snapshot: buildSnapshotFromState(guestState, false),
        };
      }
      return {
        allowed: true,
        effectivePlano: "free",
        planId: "free",
        snapshot: buildSnapshotFromState(guestState, false),
      };
    }

    if (action === "article") {
      const res = evaluateArticleConsumption({
        state: guestState,
        sessionKey,
      });
      if (!res.ok) {
        return {
          allowed: false,
          status: 403,
          code: "article_limit_reached",
          error: `Atingiu o limite gratuito de ${FREE_PLAN.artigosMes} artigos por mês. Inicie sessão e escolha um plano para gerar mais artigos.`,
          snapshot: buildSnapshotFromState(res.nextState, false),
        };
      }
      return {
        allowed: true,
        effectivePlano: "free",
        planId: "free",
        snapshot: buildSnapshotFromState(res.nextState, false),
        updatedGuestCookieValue: encodeGuestQuotaCookie(res.nextState),
      };
    }

    const imgRes = evaluateImageConsumption({
      state: guestState,
      sessionKey,
    });
    if (!imgRes.ok) {
      return {
        allowed: false,
        status: 403,
        code:
          imgRes.reason === "monthly_image_limit_reached"
            ? "monthly_image_limit_reached"
            : "article_image_limit_reached",
        error:
          imgRes.reason === "monthly_image_limit_reached"
            ? `Atingiu o limite mensal de ${FREE_PLAN.imagensMes} imagens do plano Grátis.`
            : `Limite de ${MAX_IMAGES_PER_ARTICLE} imagens por artigo atingido e sem créditos de artigos restantes para compensar imagens extras.`,
        snapshot: buildSnapshotFromState(imgRes.nextState, false),
      };
    }
    return {
      allowed: true,
      effectivePlano: "free",
      planId: "free",
      snapshot: buildSnapshotFromState(imgRes.nextState, false),
      deductedArticleCreditForImage: imgRes.deductedArticleCredit,
      articleImagesUsed: imgRes.articleImagesUsed,
      articleImagesAllowance: imgRes.articleImagesAllowance,
      updatedGuestCookieValue: encodeGuestQuotaCookie(imgRes.nextState),
    };
  }

  // Caso 2: Utilizador autenticado -> valida plano e limites reais no Supabase
  const admin = getSupabaseAdminClient();
  if (!admin) {
    return {
      allowed: true,
      effectivePlano: requestedPlano,
      planId: requestedPlano === "paid" ? "starter" : "free",
      snapshot: buildSnapshotFromState(createInitialGuestState(), true),
    };
  }

  const loaded = await loadAuthenticatedUserPlanAndState(admin, user.id);

  if (requestedPlano === "paid" && !loaded.isPaidActive) {
    return {
      allowed: false,
      status: 403,
      code: "paid_plan_required",
      error:
        "O motor pago Google Gemini requer uma assinatura ativa (Starter, Pro ou Agência). Assine um plano para desbloquear.",
      snapshot: {
        authenticated: true,
        planId: loaded.planCfg.id,
        planName: loaded.planCfg.nome,
        isPaid: loaded.isPaidActive,
        status: loaded.status,
        monthlyArticlesUsed: loaded.monthlyArticlesUsed,
        monthlyArticlesLimit: loaded.monthlyArticlesLimit,
        monthlyImagesUsed: loaded.monthlyImagesUsed,
        monthlyImagesLimit: loaded.monthlyImagesLimit,
        maxImagesPerArticle: MAX_IMAGES_PER_ARTICLE,
        articleCreditsBonus: loaded.articleCreditsBonus,
        resetAt: loaded.resetAtIso,
      },
    };
  }

  const effectivePlano: PlanoGeracao =
    requestedPlano === "paid" && loaded.isPaidActive ? "paid" : "free";

  if (action === "verify_plan") {
    const existingSessionAllowed =
      sessionKey !== "default"
        ? await admin
            .from("article_usage_sessions")
            .select("id")
            .eq("user_id", user.id)
            .eq("session_key", sessionKey)
            .maybeSingle()
        : { data: null };

    if (
      !existingSessionAllowed?.data &&
      loaded.monthlyArticlesUsed >= loaded.monthlyArticlesLimit &&
      loaded.articleCreditsBonus <= 0
    ) {
      return {
        allowed: false,
        status: 403,
        code: "article_limit_reached",
        error: `Atingiu o limite mensal de ${loaded.monthlyArticlesLimit} artigos do plano ${loaded.planCfg.nome}. Faça upgrade ou aguarde a renovação do ciclo.`,
      };
    }

    return {
      allowed: true,
      effectivePlano,
      planId: loaded.planCfg.id,
      snapshot: {
        authenticated: true,
        planId: loaded.planCfg.id,
        planName: loaded.planCfg.nome,
        isPaid: loaded.isPaidActive,
        status: loaded.status,
        monthlyArticlesUsed: loaded.monthlyArticlesUsed,
        monthlyArticlesLimit: loaded.monthlyArticlesLimit,
        monthlyImagesUsed: loaded.monthlyImagesUsed,
        monthlyImagesLimit: loaded.monthlyImagesLimit,
        maxImagesPerArticle: MAX_IMAGES_PER_ARTICLE,
        articleCreditsBonus: loaded.articleCreditsBonus,
        resetAt: loaded.resetAtIso,
      },
    };
  }

  if (action === "article") {
    const { data: rpcData, error: rpcErr } = await admin.rpc(
      "consume_article_quota",
      {
        p_user_id: user.id,
        p_session_key: sessionKey,
        p_articles_limit: loaded.monthlyArticlesLimit,
        p_images_limit: loaded.monthlyImagesLimit,
        p_max_images_per_article: MAX_IMAGES_PER_ARTICLE,
        p_reset_at: loaded.resetAtIso,
      }
    );

    if (!rpcErr && rpcData && typeof rpcData === "object") {
      const res = rpcData as {
        ok?: boolean;
        reason?: string;
        monthly_articles_used?: number;
        monthly_articles_limit?: number;
        monthly_images_used?: number;
        monthly_images_limit?: number;
      };
      if (!res.ok) {
        return {
          allowed: false,
          status: 403,
          code: "article_limit_reached",
          error: `Atingiu o limite mensal de ${loaded.monthlyArticlesLimit} artigos do plano ${loaded.planCfg.nome}. Faça upgrade ou aguarde a renovação do ciclo.`,
        };
      }
      return {
        allowed: true,
        effectivePlano,
        planId: loaded.planCfg.id,
        snapshot: {
          authenticated: true,
          planId: loaded.planCfg.id,
          planName: loaded.planCfg.nome,
          isPaid: loaded.isPaidActive,
          status: loaded.status,
          monthlyArticlesUsed: Number(
            res.monthly_articles_used ?? loaded.monthlyArticlesUsed + 1
          ),
          monthlyArticlesLimit: Number(
            res.monthly_articles_limit ?? loaded.monthlyArticlesLimit
          ),
          monthlyImagesUsed: Number(
            res.monthly_images_used ?? loaded.monthlyImagesUsed
          ),
          monthlyImagesLimit: Number(
            res.monthly_images_limit ?? loaded.monthlyImagesLimit
          ),
          maxImagesPerArticle: MAX_IMAGES_PER_ARTICLE,
          articleCreditsBonus: loaded.articleCreditsBonus,
          resetAt: loaded.resetAtIso,
        },
      };
    }

    // Fallback seguro caso migração 14 ainda não tenha sido aplicada no PostgreSQL
    if (
      loaded.monthlyArticlesUsed >= loaded.monthlyArticlesLimit &&
      loaded.articleCreditsBonus <= 0
    ) {
      return {
        allowed: false,
        status: 403,
        code: "article_limit_reached",
        error: `Atingiu o limite mensal de ${loaded.monthlyArticlesLimit} artigos do plano ${loaded.planCfg.nome}.`,
      };
    }

    const useMonthly = loaded.monthlyArticlesUsed < loaded.monthlyArticlesLimit;
    await admin.from("usage_limits").upsert(
      {
        user_id: user.id,
        monthly_articles_limit: loaded.monthlyArticlesLimit,
        monthly_articles_used: useMonthly
          ? loaded.monthlyArticlesUsed + 1
          : loaded.monthlyArticlesUsed,
        article_credits: useMonthly
          ? loaded.articleCreditsBonus
          : Math.max(0, loaded.articleCreditsBonus - 1),
        reset_at: loaded.resetAtIso,
      },
      { onConflict: "user_id" }
    );

    return {
      allowed: true,
      effectivePlano,
      planId: loaded.planCfg.id,
      snapshot: {
        authenticated: true,
        planId: loaded.planCfg.id,
        planName: loaded.planCfg.nome,
        isPaid: loaded.isPaidActive,
        status: loaded.status,
        monthlyArticlesUsed: useMonthly
          ? loaded.monthlyArticlesUsed + 1
          : loaded.monthlyArticlesUsed,
        monthlyArticlesLimit: loaded.monthlyArticlesLimit,
        monthlyImagesUsed: loaded.monthlyImagesUsed,
        monthlyImagesLimit: loaded.monthlyImagesLimit,
        maxImagesPerArticle: MAX_IMAGES_PER_ARTICLE,
        articleCreditsBonus: useMonthly
          ? loaded.articleCreditsBonus
          : Math.max(0, loaded.articleCreditsBonus - 1),
        resetAt: loaded.resetAtIso,
      },
    };
  }

  // action === "image"
  const { data: imgRpc, error: imgRpcErr } = await admin.rpc(
    "consume_image_quota",
    {
      p_user_id: user.id,
      p_session_key: sessionKey,
      p_articles_limit: loaded.monthlyArticlesLimit,
      p_images_limit: loaded.monthlyImagesLimit,
      p_max_images_per_article: MAX_IMAGES_PER_ARTICLE,
      p_reset_at: loaded.resetAtIso,
    }
  );

  if (!imgRpcErr && imgRpc && typeof imgRpc === "object") {
    const res = imgRpc as {
      ok?: boolean;
      reason?: string;
      deducted_article_credit?: boolean;
      article_images_used?: number;
      article_images_allowance?: number;
      monthly_articles_used?: number;
      monthly_articles_limit?: number;
      monthly_images_used?: number;
      monthly_images_limit?: number;
    };

    if (!res.ok) {
      const isMonthlyCap = res.reason === "monthly_image_limit_reached";
      return {
        allowed: false,
        status: 403,
        code: isMonthlyCap
          ? "monthly_image_limit_reached"
          : "article_image_limit_reached",
        error: isMonthlyCap
          ? `Atingiu o limite mensal de ${loaded.monthlyImagesLimit} imagens do plano ${loaded.planCfg.nome}.`
          : `Limite de ${MAX_IMAGES_PER_ARTICLE} imagens por artigo atingido e sem créditos de artigos restantes para compensar imagens extras.`,
      };
    }

    return {
      allowed: true,
      effectivePlano,
      planId: loaded.planCfg.id,
      deductedArticleCreditForImage: Boolean(res.deducted_article_credit),
      articleImagesUsed: Number(res.article_images_used ?? 1),
      articleImagesAllowance: Number(
        res.article_images_allowance ?? MAX_IMAGES_PER_ARTICLE
      ),
      snapshot: {
        authenticated: true,
        planId: loaded.planCfg.id,
        planName: loaded.planCfg.nome,
        isPaid: loaded.isPaidActive,
        status: loaded.status,
        monthlyArticlesUsed: Number(
          res.monthly_articles_used ?? loaded.monthlyArticlesUsed
        ),
        monthlyArticlesLimit: Number(
          res.monthly_articles_limit ?? loaded.monthlyArticlesLimit
        ),
        monthlyImagesUsed: Number(
          res.monthly_images_used ?? loaded.monthlyImagesUsed + 1
        ),
        monthlyImagesLimit: Number(
          res.monthly_images_limit ?? loaded.monthlyImagesLimit
        ),
        maxImagesPerArticle: MAX_IMAGES_PER_ARTICLE,
        articleCreditsBonus: loaded.articleCreditsBonus,
        resetAt: loaded.resetAtIso,
      },
    };
  }

  // Fallback seguro caso migração 14 ainda não tenha sido aplicada
  if (loaded.monthlyImagesUsed >= loaded.monthlyImagesLimit) {
    return {
      allowed: false,
      status: 403,
      code: "monthly_image_limit_reached",
      error: `Atingiu o limite mensal de ${loaded.monthlyImagesLimit} imagens do plano ${loaded.planCfg.nome}.`,
    };
  }

  return {
    allowed: true,
    effectivePlano,
    planId: loaded.planCfg.id,
    deductedArticleCreditForImage: false,
    articleImagesUsed: 1,
    articleImagesAllowance: MAX_IMAGES_PER_ARTICLE,
    snapshot: {
      authenticated: true,
      planId: loaded.planCfg.id,
      planName: loaded.planCfg.nome,
      isPaid: loaded.isPaidActive,
      status: loaded.status,
      monthlyArticlesUsed: loaded.monthlyArticlesUsed,
      monthlyArticlesLimit: loaded.monthlyArticlesLimit,
      monthlyImagesUsed: loaded.monthlyImagesUsed + 1,
      monthlyImagesLimit: loaded.monthlyImagesLimit,
      maxImagesPerArticle: MAX_IMAGES_PER_ARTICLE,
      articleCreditsBonus: loaded.articleCreditsBonus,
      resetAt: loaded.resetAtIso,
    },
  };
}
