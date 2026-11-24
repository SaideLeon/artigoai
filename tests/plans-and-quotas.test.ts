import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  FREE_PLAN,
  getMonthlyArticleLimit,
  getMonthlyImageLimit,
  getPlanQuotaConfig,
  MAX_IMAGES_PER_ARTICLE,
  SUBSCRIPTION_PLANS,
} from "@/lib/pricing";
import {
  calculateCommissionCents,
  generateInviteToken,
  getOfficialCommissionPercentForPlan,
  hashInviteToken,
  validateCustomPartnerCode,
} from "@/lib/partners";
import {
  decodeGuestQuotaCookie,
  encodeGuestQuotaCookie,
  evaluateArticleConsumption,
  evaluateImageConsumption,
  reconcileQuotaStateReset,
  type QuotaStateLike,
} from "@/lib/usage-enforcement";

function makeQuotaState(
  overrides: Partial<QuotaStateLike> = {}
): QuotaStateLike {
  return {
    planId: "starter",
    isPaid: true,
    status: "active",
    monthlyArticlesUsed: 0,
    monthlyArticlesLimit: 14,
    monthlyImagesUsed: 0,
    monthlyImagesLimit: 98,
    articleCreditsBonus: 0,
    resetAtIso: "2027-01-01T00:00:00.000Z",
    sessions: {},
    ...overrides,
  };
}

describe("Planos de Assinatura, Quotas e Regras de Parceiros", () => {
  test("1) Valores e limites oficiais dos planos Starter, Pro, Agência e Grátis", () => {
    assert.equal(MAX_IMAGES_PER_ARTICLE, 7);

    assert.equal(FREE_PLAN.artigosMes, 2);
    assert.equal(FREE_PLAN.imagensPorArtigo, 7);
    assert.equal(FREE_PLAN.imagensMes, 14);

    const starter = SUBSCRIPTION_PLANS.find((p) => p.id === "starter");
    const pro = SUBSCRIPTION_PLANS.find((p) => p.id === "pro");
    const agencia = SUBSCRIPTION_PLANS.find((p) => p.id === "agencia");

    assert.ok(starter && pro && agencia);

    assert.equal(starter.precoMensalBrl, 34.9);
    assert.equal(starter.artigosMes, 14);
    assert.equal(starter.imagensPorArtigo, 7);
    assert.equal(starter.imagensMes, 98);

    assert.equal(pro.precoMensalBrl, 94.9);
    assert.equal(pro.artigosMes, 33);
    assert.equal(pro.imagensPorArtigo, 7);
    assert.equal(pro.imagensMes, 231);

    assert.equal(agencia.precoMensalBrl, 149.9);
    assert.equal(agencia.artigosMes, 48);
    assert.equal(agencia.imagensPorArtigo, 7);
    assert.equal(agencia.imagensMes, 336);

    assert.equal(getMonthlyArticleLimit("starter"), 14);
    assert.equal(getMonthlyImageLimit("starter"), 98);
    assert.equal(getMonthlyArticleLimit("pro"), 33);
    assert.equal(getMonthlyImageLimit("pro"), 231);
    assert.equal(getMonthlyArticleLimit("agencia"), 48);
    assert.equal(getMonthlyImageLimit("agencia"), 336);
    assert.equal(getPlanQuotaConfig("desconhecido").id, "free");
  });

  test("2) Bloqueia geração ao atingir limite mensal de artigos e reinicia no próximo ciclo", () => {
    let state = makeQuotaState({
      planId: "free",
      isPaid: false,
      monthlyArticlesLimit: 2,
      monthlyImagesLimit: 14,
      resetAtIso: "2026-12-01T00:00:00.000Z",
    });

    const now = new Date("2026-11-15T12:00:00.000Z");

    const a1 = evaluateArticleConsumption({
      state,
      sessionKey: "sess-1",
      now,
    });
    assert.equal(a1.ok, true);
    state = a1.nextState;
    assert.equal(state.monthlyArticlesUsed, 1);

    // Mesma sessionKey é idempotente (não consome 2x para contorno + seções do mesmo artigo)
    const a1Repeat = evaluateArticleConsumption({
      state,
      sessionKey: "sess-1",
      now,
    });
    assert.equal(a1Repeat.ok, true);
    assert.equal(a1Repeat.alreadyCounted, true);
    assert.equal(a1Repeat.nextState.monthlyArticlesUsed, 1);

    const a2 = evaluateArticleConsumption({
      state,
      sessionKey: "sess-2",
      now,
    });
    assert.equal(a2.ok, true);
    state = a2.nextState;
    assert.equal(state.monthlyArticlesUsed, 2);

    // 3º artigo no plano Grátis (limite 2/mês) deve ser bloqueado
    const a3 = evaluateArticleConsumption({
      state,
      sessionKey: "sess-3",
      now,
    });
    assert.equal(a3.ok, false);
    assert.equal(a3.reason, "article_limit_reached");

    // Após reset_at, zera contadores sem acumular não utilizados
    const resetted = reconcileQuotaStateReset(
      state,
      new Date("2026-12-02T00:00:00.000Z")
    );
    assert.equal(resetted.monthlyArticlesUsed, 0);
    assert.equal(resetted.monthlyImagesUsed, 0);
  });

  test("3) Máximo 7 imagens por artigo; imagens extras descontam 1 artigo ainda não gerado", () => {
    let state = makeQuotaState({
      planId: "starter",
      monthlyArticlesLimit: 14,
      monthlyImagesLimit: 98,
    });
    const now = new Date("2026-11-15T12:00:00.000Z");

    // Inicia 1 artigo
    state = evaluateArticleConsumption({
      state,
      sessionKey: "art-1",
      now,
    }).nextState;
    assert.equal(state.monthlyArticlesUsed, 1);

    // Primeiras 7 imagens do artigo não descontam artigo adicional
    for (let i = 1; i <= 7; i++) {
      const imgRes = evaluateImageConsumption({
        state,
        sessionKey: "art-1",
        now,
      });
      assert.equal(imgRes.ok, true);
      assert.equal(imgRes.deductedArticleCredit, false);
      assert.equal(imgRes.articleImagesUsed, i);
      assert.equal(imgRes.articleImagesAllowance, 7);
      state = imgRes.nextState;
    }
    assert.equal(state.monthlyArticlesUsed, 1);
    assert.equal(state.monthlyImagesUsed, 7);

    // 8ª imagem no mesmo artigo desconta 1 crédito de artigo ainda não gerado e libera +7 slots (14)
    const img8 = evaluateImageConsumption({
      state,
      sessionKey: "art-1",
      now,
    });
    assert.equal(img8.ok, true);
    assert.equal(img8.deductedArticleCredit, true);
    assert.equal(img8.articleImagesUsed, 8);
    assert.equal(img8.articleImagesAllowance, 14);
    state = img8.nextState;
    assert.equal(state.monthlyArticlesUsed, 2);
    assert.equal(state.monthlyImagesUsed, 8);

    // Sem artigos restantes (14/14 usados), tentar passar de 7 imagens em um artigo deve ser bloqueado
    const fullArticlesState = makeQuotaState({
      planId: "starter",
      monthlyArticlesUsed: 14,
      monthlyArticlesLimit: 14,
      monthlyImagesUsed: 14,
      monthlyImagesLimit: 98,
      sessions: {
        "art-14": {
          imagesUsed: 7,
          imagesAllowance: 7,
          extraArticleCreditsUsed: 0,
        },
      },
    });
    const blockedExtra = evaluateImageConsumption({
      state: fullArticlesState,
      sessionKey: "art-14",
      now,
    });
    assert.equal(blockedExtra.ok, false);
    assert.equal(blockedExtra.reason, "article_image_limit_reached");

    // Ao atingir o teto mensal de imagens (98/98 no Starter), bloqueia qualquer nova imagem
    const capState = makeQuotaState({
      planId: "starter",
      monthlyArticlesUsed: 5,
      monthlyArticlesLimit: 14,
      monthlyImagesUsed: 98,
      monthlyImagesLimit: 98,
      sessions: {
        "art-5": {
          imagesUsed: 2,
          imagesAllowance: 7,
          extraArticleCreditsUsed: 0,
        },
      },
    });
    const blockedMonthly = evaluateImageConsumption({
      state: capState,
      sessionKey: "art-5",
      now,
    });
    assert.equal(blockedMonthly.ok, false);
    assert.equal(blockedMonthly.reason, "monthly_image_limit_reached");
  });

  test("4) Cookie HMAC de cota de visitante preserva estado e rejeita adulteração", () => {
    const initial = makeQuotaState({
      planId: "free",
      isPaid: false,
      monthlyArticlesUsed: 1,
      monthlyArticlesLimit: 2,
      monthlyImagesUsed: 5,
      monthlyImagesLimit: 14,
    });

    const cookieVal = encodeGuestQuotaCookie(initial);
    const decoded = decodeGuestQuotaCookie(
      cookieVal,
      new Date("2026-11-15T12:00:00.000Z")
    );
    assert.equal(decoded.monthlyArticlesUsed, 1);
    assert.equal(decoded.monthlyImagesUsed, 5);

    // Adulteração do payload invalida assinatura e reseta para estado limpo
    const [payload] = cookieVal.split(".");
    const tampered = `${payload}.assinatura_falsa`;
    const rejected = decodeGuestQuotaCookie(
      tampered,
      new Date("2026-11-15T12:00:00.000Z")
    );
    assert.equal(rejected.monthlyArticlesUsed, 0);
    assert.equal(rejected.monthlyImagesUsed, 0);
  });

  test("5) Cálculo exato de comissões por plano (Starter 20%, Pro 35%, Agência 35%) e validações", () => {
    // Starter R$ 34,90 * 20% = R$ 6,98 (698 centavos)
    assert.equal(
      calculateCommissionCents(3490, getOfficialCommissionPercentForPlan("starter")),
      698
    );
    // Pro R$ 94,90 * 35% = R$ 33,22 (3322 centavos)
    assert.equal(
      calculateCommissionCents(9490, getOfficialCommissionPercentForPlan("pro")),
      3322
    );
    // Agência R$ 149,90 * 35% = R$ 52,47 (5247 centavos)
    assert.equal(
      calculateCommissionCents(14990, getOfficialCommissionPercentForPlan("agencia")),
      5247
    );

    // Token de convite e hash determinístico SHA-256
    const raw = generateInviteToken();
    assert.ok(raw.length >= 32);
    assert.equal(hashInviteToken(raw), hashInviteToken(raw));
    assert.notEqual(hashInviteToken(raw), raw);

    // Validação de código personalizado de parceiro
    assert.equal(validateCustomPartnerCode("kildary").valid, true);
    assert.equal(validateCustomPartnerCode("admin").valid, false);
    assert.equal(validateCustomPartnerCode("ab").valid, false);
  });
});
