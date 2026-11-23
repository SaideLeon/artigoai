import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  calculateCommissionCents,
  getPartnerAdminEmails,
  getSupremeAdminEmail,
  isSupremeAdminEmail,
  validateWithdrawalPayload,
} from "@/lib/partners";
import { InMemoryPartnerLedgerEngine } from "@/lib/partners-ledger";

describe("Sistema de Parceiros — Livro-Caixa em Centavos e Saques", () => {
  test("1) Calcula centavos inteiros e registra comissão de renovação recorrente", async () => {
    const engine = new InMemoryPartnerLedgerEngine();
    engine.seedPartner({
      id: "partner-1",
      userId: "user-partner-1",
      percentualComissao: 45,
      ativo: true,
    });
    engine.assignReferral("buyer-1", "partner-1");

    // 1º pagamento: Pro Mensal R$ 94,90 (9490 centavos) * 45% = 4270.5 -> 4271 centavos
    const first = await engine.processPaymentWebhook({
      userId: "buyer-1",
      transactionId: "cakto-tx-001",
      planId: "pro",
      billingCycle: "monthly",
      grossAmountCents: 9490,
      netAmountCents: 9040,
      eventType: "purchase_approved",
      nowIso: "2026-11-01T10:00:00.000Z",
    });

    assert.equal(first.recorded, true);
    assert.equal(first.commission?.tipo, "primeiro_pagamento");
    assert.equal(first.commission?.valorComissaoCentavos, 4271);
    assert.equal(first.commission?.status, "pendente");

    // Renovação mensal: gera nova comissão distinta com tipo "renovacao"
    const renewal = await engine.processPaymentWebhook({
      userId: "buyer-1",
      transactionId: "cakto-tx-002",
      planId: "pro",
      billingCycle: "monthly",
      grossAmountCents: 9490,
      netAmountCents: 9040,
      eventType: "subscription_renewed",
      nowIso: "2026-12-01T10:00:00.000Z",
    });

    assert.equal(renewal.recorded, true);
    assert.equal(renewal.commission?.tipo, "renovacao");
    assert.equal(renewal.commission?.valorComissaoCentavos, 4271);

    // Base líquida configurável
    const netBased = await engine.processPaymentWebhook({
      userId: "buyer-1",
      transactionId: "cakto-tx-003",
      planId: "pro",
      billingCycle: "monthly",
      grossAmountCents: 9490,
      netAmountCents: 9000,
      eventType: "subscription_renewed",
      baseMode: "valor_liquido",
      nowIso: "2027-01-01T10:00:00.000Z",
    });
    assert.equal(
      netBased.commission?.valorComissaoCentavos,
      calculateCommissionCents(9000, 45)
    );
    assert.equal(netBased.commission?.valorComissaoCentavos, 4050);

    // Após cancelamento, novas renovações não geram comissão
    engine.cancelUserSubscription("buyer-1");
    const afterCancel = await engine.processPaymentWebhook({
      userId: "buyer-1",
      transactionId: "cakto-tx-004",
      planId: "pro",
      billingCycle: "monthly",
      grossAmountCents: 9490,
      eventType: "subscription_renewed",
      nowIso: "2027-02-01T10:00:00.000Z",
    });
    assert.equal(afterCancel.recorded, false);
    assert.equal(afterCancel.reason, "subscription_canceled");

    const bal = engine.getBalance("partner-1");
    assert.equal(bal.saldoPendenteCentavos, 4271 + 4271 + 4050);
    assert.equal(bal.totalGanhoCentavos, 12592);
  });

  test("2) Webhook duplicado não duplica comissão (idempotência)", async () => {
    const engine = new InMemoryPartnerLedgerEngine();
    engine.seedPartner({
      id: "partner-1",
      userId: "user-partner-1",
      percentualComissao: 45,
      ativo: true,
    });
    engine.assignReferral("buyer-1", "partner-1");

    const first = await engine.processPaymentWebhook({
      userId: "buyer-1",
      transactionId: "cakto-dup-999",
      planId: "agencia",
      billingCycle: "monthly",
      grossAmountCents: 14990,
      eventType: "purchase_approved",
    });
    const duplicate = await engine.processPaymentWebhook({
      userId: "buyer-1",
      transactionId: "cakto-dup-999",
      planId: "agencia",
      billingCycle: "monthly",
      grossAmountCents: 14990,
      eventType: "purchase_approved",
    });

    assert.equal(first.recorded, true);
    assert.equal(duplicate.recorded, false);
    assert.equal(duplicate.alreadyExists, true);
    assert.equal(engine.getCommissions("partner-1").length, 1);
    assert.equal(engine.getBalance("partner-1").saldoPendenteCentavos, 6746);
  });

  test("3) Estorno antes e depois do pagamento (com compensação automática no saldo futuro)", async () => {
    const engine = new InMemoryPartnerLedgerEngine();
    engine.seedPartner({
      id: "partner-1",
      userId: "user-partner-1",
      percentualComissao: 50,
      ativo: true,
    });
    engine.assignReferral("buyer-1", "partner-1");

    // Venda 1: R$ 100,00 -> comissão R$ 50,00 (5000 centavos)
    await engine.processPaymentWebhook({
      userId: "buyer-1",
      transactionId: "tx-paid-then-refunded",
      planId: "pro",
      billingCycle: "monthly",
      grossAmountCents: 10000,
      eventType: "purchase_approved",
      nowIso: "2026-11-01T10:00:00.000Z",
    });

    // Passa 7 dias -> matura para disponível
    const matured = engine.matureCommissions("2026-11-08T11:00:00.000Z");
    assert.equal(matured, 1);
    assert.equal(engine.getBalance("partner-1").saldoDisponivelCentavos, 5000);

    // Parceiro saca e admin marca pago
    const wd1 = await engine.requestWithdrawal({
      partnerId: "partner-1",
      metodo: "pix",
      pixTipoChave: "email",
      dadosPagamento: "parceiro@exemplo.com",
      nowIso: "2026-11-09T10:00:00.000Z",
    });
    assert.equal(wd1.ok, true);
    if (!wd1.ok) throw new Error("expected withdrawal");

    await engine.adminUpdateWithdrawal({
      withdrawalId: wd1.withdrawal.id,
      action: "pago",
      comprovativoRef: "PIX-E2E-001",
      nowIso: "2026-11-09T12:00:00.000Z",
    });

    assert.equal(engine.getBalance("partner-1").totalRecebidoCentavos, 5000);

    // Agora o cliente pede chargeback da Venda 1 já paga!
    const rev = await engine.reverseByTransactionId(
      "tx-paid-then-refunded",
      "2026-11-10T09:00:00.000Z"
    );
    assert.equal(rev.reversed, true);
    assert.equal(rev.negativeOffsetApplied, true);

    // Saldo disponível fica -5000 (-R$ 50,00) a compensar
    assert.equal(engine.getBalance("partner-1").saldoDisponivelCentavos, -5000);

    // Nova venda R$ 160,00 -> comissão R$ 80,00 (8000 centavos)
    await engine.processPaymentWebhook({
      userId: "buyer-1",
      transactionId: "tx-future-gain",
      planId: "agencia",
      billingCycle: "monthly",
      grossAmountCents: 16000,
      eventType: "subscription_renewed",
      nowIso: "2026-11-11T10:00:00.000Z",
    });
    engine.matureCommissions("2026-11-19T10:00:00.000Z");

    // 8000 - 5000 de compensação = 3000 centavos disponíveis (R$ 30,00)!
    const afterOffset = engine.getBalance("partner-1");
    assert.equal(afterOffset.saldoDisponivelCentavos, 3000);
    assert.equal(afterOffset.totalRecebidoCentavos, 5000);
    assert.equal(afterOffset.totalGanhoCentavos, 8000);

    // Auditoria deve registrar criação, maturação, saque, pagamento e estorno
    assert.ok(engine.getAuditLogs("partner-1").length >= 5);
  });

  test("4) Saque com saldo insuficiente e devolução quando admin recusa", async () => {
    const engine = new InMemoryPartnerLedgerEngine();
    engine.seedPartner({
      id: "partner-1",
      userId: "user-partner-1",
      percentualComissao: 45,
      ativo: true,
    });
    engine.assignReferral("buyer-1", "partner-1");

    // Comissão Starter R$ 34,90 * 45% = R$ 15,71 (1571 centavos) -> abaixo de R$ 50,00
    await engine.processPaymentWebhook({
      userId: "buyer-1",
      transactionId: "tx-low-1",
      planId: "starter",
      billingCycle: "monthly",
      grossAmountCents: 3490,
      eventType: "purchase_approved",
      nowIso: "2026-11-01T10:00:00.000Z",
    });
    engine.matureCommissions("2026-11-09T10:00:00.000Z");

    const lowAttempt = await engine.requestWithdrawal({
      partnerId: "partner-1",
      metodo: "pix",
      pixTipoChave: "cpf",
      dadosPagamento: "12345678909",
    });
    assert.equal(lowAttempt.ok, false);
    if (!lowAttempt.ok) {
      assert.equal(lowAttempt.code, "insufficient_balance");
    }

    // Adiciona mais comissões para passar de R$ 50,00 (+ 6746 = 8317 centavos)
    await engine.processPaymentWebhook({
      userId: "buyer-1",
      transactionId: "tx-high-2",
      planId: "agencia",
      billingCycle: "monthly",
      grossAmountCents: 14990,
      eventType: "subscription_renewed",
      nowIso: "2026-11-10T10:00:00.000Z",
    });
    engine.matureCommissions("2026-11-18T10:00:00.000Z");

    // Tentativa solicitando valor acima do saldo disponível (10000 > 8317)
    const overAttempt = await engine.requestWithdrawal({
      partnerId: "partner-1",
      metodo: "pix",
      pixTipoChave: "cpf",
      dadosPagamento: "12345678909",
      requestedCents: 10000,
    });
    assert.equal(overAttempt.ok, false);
    if (!overAttempt.ok) {
      assert.equal(overAttempt.code, "insufficient_balance");
    }

    // Solicita saque válido e admin recusa -> saldo deve retornar intacto para disponível
    const validReq = await engine.requestWithdrawal({
      partnerId: "partner-1",
      metodo: "outro",
      pixTipoChave: null,
      dadosPagamento: "Banco Inter Ag 0001 Conta 99999-0",
    });
    assert.equal(validReq.ok, true);
    if (!validReq.ok) throw new Error("expected valid withdrawal");
    assert.equal(engine.getBalance("partner-1").saldoDisponivelCentavos, 0);
    assert.equal(engine.getBalance("partner-1").saldoEmSaqueCentavos, 8317);

    const refuse = await engine.adminUpdateWithdrawal({
      withdrawalId: validReq.withdrawal.id,
      action: "recusado",
      motivoRecusa: "Titularidade divergente.",
    });
    assert.equal(refuse.ok, true);
    assert.equal(engine.getBalance("partner-1").saldoDisponivelCentavos, 8317);
    assert.equal(engine.getBalance("partner-1").saldoEmSaqueCentavos, 0);
  });

  test("5) Dois saques simultâneos: apenas um é criado e não há saque duplicado", async () => {
    const engine = new InMemoryPartnerLedgerEngine();
    engine.seedPartner({
      id: "partner-race",
      userId: "user-partner-race",
      percentualComissao: 45,
      ativo: true,
    });
    engine.assignReferral("buyer-race", "partner-race");

    await engine.processPaymentWebhook({
      userId: "buyer-race",
      transactionId: "tx-race-1",
      planId: "agencia",
      billingCycle: "monthly",
      grossAmountCents: 14990,
      eventType: "purchase_approved",
      nowIso: "2026-11-01T10:00:00.000Z",
    });
    engine.matureCommissions("2026-11-09T10:00:00.000Z");

    const [resA, resB] = await Promise.all([
      engine.requestWithdrawal({
        partnerId: "partner-race",
        metodo: "pix",
        pixTipoChave: "email",
        dadosPagamento: "race@exemplo.com",
      }),
      engine.requestWithdrawal({
        partnerId: "partner-race",
        metodo: "pix",
        pixTipoChave: "email",
        dadosPagamento: "race@exemplo.com",
      }),
    ]);

    const successes = [resA, resB].filter((r) => r.ok);
    const failures = [resA, resB].filter((r) => !r.ok);

    assert.equal(successes.length, 1);
    assert.equal(failures.length, 1);
    if (!failures[0].ok) {
      assert.equal(failures[0].code, "open_exists");
    }

    const withdrawals = engine.getWithdrawals("partner-race");
    assert.equal(withdrawals.length, 1);
    assert.equal(engine.getBalance("partner-race").saldoEmSaqueCentavos, 6746);
    assert.equal(engine.getBalance("partner-race").saldoDisponivelCentavos, 0);
  });

  test("Validação de entrada de saque no servidor bloqueia payload inválido", () => {
    const invalidPix = validateWithdrawalPayload({
      metodo: "pix",
      pixTipoChave: "invalido",
      dadosPagamento: "12345678909",
    });
    assert.equal(invalidPix.ok, false);

    const negativeAmount = validateWithdrawalPayload({
      metodo: "outro",
      dadosPagamento: "Wise USD",
      valorCentavos: -100,
    });
    assert.equal(negativeAmount.ok, false);

    const validPix = validateWithdrawalPayload({
      metodo: "pix",
      pixTipoChave: "aleatoria",
      dadosPagamento: "a3458c18-8c8e-4d7e-b4ee-4ba59f1389e8",
      valorCentavos: 5000,
    });
    assert.equal(validPix.ok, true);
  });

  test("7) Diretiva de acesso: apenas um Administrador Supremo autorizado", () => {
    const prevSuper = process.env.SUPER_ADMIN_EMAIL;
    const prevAdmin = process.env.ADMIN_EMAIL;
    const prevLegacy = process.env.PARTNER_ADMIN_EMAILS;

    try {
      process.env.SUPER_ADMIN_EMAIL = "supremo@exemplo.com";
      process.env.ADMIN_EMAIL = "secundario@exemplo.com";
      process.env.PARTNER_ADMIN_EMAILS =
        "outro1@exemplo.com,outro2@exemplo.com";

      assert.equal(getSupremeAdminEmail(), "supremo@exemplo.com");
      assert.deepEqual(getPartnerAdminEmails(), ["supremo@exemplo.com"]);
      assert.equal(isSupremeAdminEmail("Supremo@Exemplo.com "), true);
      assert.equal(isSupremeAdminEmail("secundario@exemplo.com"), false);
      assert.equal(isSupremeAdminEmail("outro1@exemplo.com"), false);

      // Fail-closed se alguém tentar colocar múltiplos e-mails em SUPER_ADMIN_EMAIL
      process.env.SUPER_ADMIN_EMAIL = "supremo@exemplo.com,invasor@exemplo.com";
      assert.equal(getSupremeAdminEmail(), null);
      assert.equal(isSupremeAdminEmail("supremo@exemplo.com"), false);
      assert.equal(isSupremeAdminEmail("invasor@exemplo.com"), false);

      // Fallback legado aceita no máximo o primeiro e-mail único
      delete process.env.SUPER_ADMIN_EMAIL;
      delete process.env.ADMIN_EMAIL;
      process.env.PARTNER_ADMIN_EMAILS =
        "legado1@exemplo.com,legado2@exemplo.com";
      assert.equal(getSupremeAdminEmail(), "legado1@exemplo.com");
      assert.equal(isSupremeAdminEmail("legado1@exemplo.com"), true);
      assert.equal(isSupremeAdminEmail("legado2@exemplo.com"), false);
    } finally {
      if (prevSuper === undefined) delete process.env.SUPER_ADMIN_EMAIL;
      else process.env.SUPER_ADMIN_EMAIL = prevSuper;
      if (prevAdmin === undefined) delete process.env.ADMIN_EMAIL;
      else process.env.ADMIN_EMAIL = prevAdmin;
      if (prevLegacy === undefined) delete process.env.PARTNER_ADMIN_EMAILS;
      else process.env.PARTNER_ADMIN_EMAILS = prevLegacy;
    }
  });
});
