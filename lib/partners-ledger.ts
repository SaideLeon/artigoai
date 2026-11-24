import {
  BASE_DE_CALCULO,
  calculateCommissionCents,
  COMISSAO_MAX_MESES,
  COMISSAO_RECORRENTE,
  GARANTIA_DIAS,
  getOfficialCommissionPercentForPlan,
  SAQUE_MINIMO_CENTAVOS,
  type CommissionBaseMode,
  type CommissionStatus,
  type CommissionType,
  type PixKeyType,
  type WithdrawalMethod,
  type WithdrawalStatus,
} from "@/lib/partners";

export type LedgerCommissionRecord = {
  id: string;
  partnerId: string;
  userId: string;
  transactionId: string;
  plano: string;
  ciclo: "monthly" | "yearly";
  tipo: CommissionType;
  valorBaseCentavos: number;
  percentualAplicado: number;
  valorComissaoCentavos: number;
  baseCalculo: CommissionBaseMode;
  status: CommissionStatus;
  criadoEm: string;
  disponivelEm: string;
  pagaEm: string | null;
  estornadaEm: string | null;
  withdrawalRequestId: string | null;
};

export type LedgerWithdrawalRecord = {
  id: string;
  partnerId: string;
  valorCentavos: number;
  saldoNoMomentoCentavos: number;
  metodo: WithdrawalMethod;
  pixTipoChave: PixKeyType | null;
  dadosPagamento: string;
  status: WithdrawalStatus;
  comprovativoRef: string | null;
  motivoRecusa: string | null;
  solicitadoEm: string;
  analisadoEm: string | null;
  pagoEm: string | null;
  recusadoEm: string | null;
};

export type LedgerAdjustmentRecord = {
  id: string;
  partnerId: string;
  commissionId: string | null;
  withdrawalRequestId: string | null;
  settledWithdrawalId: string | null;
  tipo:
    | "comissao_pendente"
    | "liberacao_disponivel"
    | "reserva_saque"
    | "pagamento_saque"
    | "liberacao_saque_recusado"
    | "estorno_comissao"
    | "ajuste_estorno_pos_pagamento"
    | "credito_troco_saque";
  valorCentavos: number;
  saldoAfetado: "pendente" | "disponivel" | "em_saque" | "pago" | "compensacao";
  descricao: string;
  criadoEm: string;
};

export type LedgerAuditRecord = {
  id: string;
  entidade: "commission" | "withdrawal_request";
  entidadeId: string;
  partnerId: string;
  actorType: "webhook" | "cron" | "partner" | "admin" | "system";
  actorId: string | null;
  actorEmail: string;
  acao: string;
  estadoAnterior: Record<string, unknown> | null;
  estadoNovo: Record<string, unknown> | null;
  motivo: string | null;
  criadoEm: string;
};

export type PartnerBalanceSummary = {
  saldoPendenteCentavos: number;
  saldoDisponivelBrutoCentavos: number;
  ajustesEmAbertoCentavos: number;
  saldoDisponivelCentavos: number;
  saldoEmSaqueCentavos: number;
  totalRecebidoCentavos: number;
  totalGanhoCentavos: number;
  totalEstornadoCentavos: number;
  hasOpenWithdrawal: boolean;
  podeSolicitarSaque: boolean;
};

/**
 * Calcula TODOS os saldos do parceiro em centavos inteiros a partir exclusivamente
 * das comissões, pedidos de saque e lançamentos do livro-caixa.
 */
export function computePartnerBalanceSummary(params: {
  commissions: Pick<
    LedgerCommissionRecord,
    "status" | "valorComissaoCentavos" | "withdrawalRequestId"
  >[];
  withdrawals: Pick<LedgerWithdrawalRecord, "id" | "status" | "valorCentavos">[];
  ledgerEntries: Pick<
    LedgerAdjustmentRecord,
    "tipo" | "valorCentavos" | "settledWithdrawalId" | "withdrawalRequestId"
  >[];
  minWithdrawalCents?: number;
  partnerActive?: boolean;
}): PartnerBalanceSummary {
  const minCents = params.minWithdrawalCents ?? SAQUE_MINIMO_CENTAVOS;
  let saldoPendenteCentavos = 0;
  let saldoDisponivelBrutoCentavos = 0;
  let legacyPaidWithoutWithdrawal = 0;
  let totalEstornadoCentavos = 0;

  for (const c of params.commissions) {
    const val = Math.round(Number(c.valorComissaoCentavos || 0));
    if (c.status === "pendente") {
      saldoPendenteCentavos += val;
    } else if (c.status === "disponivel") {
      saldoDisponivelBrutoCentavos += val;
    } else if (c.status === "paga" && !c.withdrawalRequestId) {
      legacyPaidWithoutWithdrawal += val;
    } else if (c.status === "estornada") {
      totalEstornadoCentavos += val;
    }
  }

  let ajustesEmAbertoCentavos = 0;
  for (const entry of params.ledgerEntries) {
    if (
      (entry.tipo === "ajuste_estorno_pos_pagamento" ||
        entry.tipo === "credito_troco_saque") &&
      !entry.settledWithdrawalId
    ) {
      ajustesEmAbertoCentavos += Math.round(Number(entry.valorCentavos || 0));
    }
  }

  const saldoDisponivelCentavos =
    saldoDisponivelBrutoCentavos + ajustesEmAbertoCentavos;

  let saldoEmSaqueCentavos = 0;
  let paidWithdrawalsCents = 0;
  let hasOpenWithdrawal = false;

  for (const w of params.withdrawals) {
    const val = Math.round(Number(w.valorCentavos || 0));
    if (w.status === "solicitado" || w.status === "em_analise") {
      hasOpenWithdrawal = true;
      saldoEmSaqueCentavos += val;
    } else if (w.status === "pago") {
      paidWithdrawalsCents += val;
    }
  }

  const totalRecebidoCentavos =
    paidWithdrawalsCents + legacyPaidWithoutWithdrawal;
  const totalGanhoCentavos =
    saldoPendenteCentavos +
    saldoDisponivelCentavos +
    saldoEmSaqueCentavos +
    totalRecebidoCentavos;

  const podeSolicitarSaque =
    Boolean(params.partnerActive ?? true) &&
    !hasOpenWithdrawal &&
    saldoDisponivelCentavos >= minCents;

  return {
    saldoPendenteCentavos,
    saldoDisponivelBrutoCentavos,
    ajustesEmAbertoCentavos,
    saldoDisponivelCentavos,
    saldoEmSaqueCentavos,
    totalRecebidoCentavos,
    totalGanhoCentavos,
    totalEstornadoCentavos,
    hasOpenWithdrawal,
    podeSolicitarSaque,
  };
}

export type InMemoryPartner = {
  id: string;
  userId: string;
  percentualComissao: number;
  ativo: boolean;
};

/**
 * Motor in-memory com mutex por parceiro para testes automatizados fiéis ao comportamento
 * transacional das RPCs PostgreSQL (inclui concorrência, idempotência, garantia, saque e estorno).
 */
export class InMemoryPartnerLedgerEngine {
  private partners = new Map<string, InMemoryPartner>();
  private referredByUser = new Map<string, string>();
  private canceledUsers = new Set<string>();
  private commissions: LedgerCommissionRecord[] = [];
  private withdrawals: LedgerWithdrawalRecord[] = [];
  private ledgerEntries: LedgerAdjustmentRecord[] = [];
  private auditLogs: LedgerAuditRecord[] = [];
  private partnerLocks = new Map<string, Promise<void>>();
  private idSeq = 1;

  private nextId(prefix: string): string {
    const id = `${prefix}-${this.idSeq}`;
    this.idSeq += 1;
    return id;
  }

  private async withPartnerLock<T>(
    partnerId: string,
    fn: () => Promise<T> | T
  ): Promise<T> {
    const prev = this.partnerLocks.get(partnerId) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.partnerLocks.set(partnerId, current);
    await prev;
    try {
      // Simula um micro tick de I/O assíncrono para exercitar corridas reais com Promise.all
      await Promise.resolve();
      return await fn();
    } finally {
      release();
    }
  }

  seedPartner(partner: InMemoryPartner) {
    this.partners.set(partner.id, { ...partner });
  }

  assignReferral(userId: string, partnerId: string) {
    this.referredByUser.set(userId, partnerId);
  }

  cancelUserSubscription(userId: string) {
    this.canceledUsers.add(userId);
  }

  getBalance(partnerId: string, minWithdrawalCents = SAQUE_MINIMO_CENTAVOS) {
    const partner = this.partners.get(partnerId);
    return computePartnerBalanceSummary({
      commissions: this.commissions.filter((c) => c.partnerId === partnerId),
      withdrawals: this.withdrawals.filter((w) => w.partnerId === partnerId),
      ledgerEntries: this.ledgerEntries.filter((l) => l.partnerId === partnerId),
      minWithdrawalCents,
      partnerActive: partner?.ativo ?? false,
    });
  }

  getCommissions(partnerId?: string) {
    return partnerId
      ? this.commissions.filter((c) => c.partnerId === partnerId)
      : [...this.commissions];
  }

  getWithdrawals(partnerId?: string) {
    return partnerId
      ? this.withdrawals.filter((w) => w.partnerId === partnerId)
      : [...this.withdrawals];
  }

  getAuditLogs(partnerId?: string) {
    return partnerId
      ? this.auditLogs.filter((a) => a.partnerId === partnerId)
      : [...this.auditLogs];
  }

  async processPaymentWebhook(params: {
    userId: string;
    transactionId: string;
    planId: string;
    billingCycle: "monthly" | "yearly";
    grossAmountCents: number;
    netAmountCents?: number;
    eventType: "purchase_approved" | "subscription_renewed";
    nowIso?: string;
    baseMode?: CommissionBaseMode;
    recurringEnabled?: boolean;
    maxMonths?: number | null;
    warrantyDays?: number;
    percentOverride?: number;
  }): Promise<{
    recorded: boolean;
    alreadyExists?: boolean;
    reason?: string;
    commission?: LedgerCommissionRecord;
  }> {
    const partnerId = this.referredByUser.get(params.userId);
    if (!partnerId) return { recorded: false, reason: "user_not_referred" };
    const partner = this.partners.get(partnerId);
    if (!partner) return { recorded: false, reason: "partner_not_found" };
    if (!partner.ativo) return { recorded: false, reason: "partner_inactive" };
    if (partner.userId === params.userId) {
      return { recorded: false, reason: "self_referral_blocked" };
    }

    if (
      params.eventType === "subscription_renewed" &&
      this.canceledUsers.has(params.userId)
    ) {
      return { recorded: false, reason: "subscription_canceled" };
    }

    return this.withPartnerLock(partnerId, () => {
      if (this.commissions.some((c) => c.transactionId === params.transactionId)) {
        return { recorded: false, alreadyExists: true };
      }

      const prior = this.commissions
        .filter((c) => c.partnerId === partnerId && c.userId === params.userId)
        .sort((a, b) => a.criadoEm.localeCompare(b.criadoEm));

      const tipo: CommissionType =
        params.eventType === "subscription_renewed" || prior.length > 0
          ? "renovacao"
          : "primeiro_pagamento";

      const recurring = params.recurringEnabled ?? COMISSAO_RECORRENTE;
      if (tipo === "renovacao" && !recurring) {
        return { recorded: false, reason: "recurring_disabled" };
      }

      const nowMs = params.nowIso ? new Date(params.nowIso).getTime() : Date.now();
      const maxMonths =
        params.maxMonths !== undefined ? params.maxMonths : COMISSAO_MAX_MESES;

      if (tipo === "renovacao" && maxMonths !== null && prior.length > 0) {
        const firstMs = new Date(prior[0].criadoEm).getTime();
        const elapsedMonths = (nowMs - firstMs) / (1000 * 60 * 60 * 24 * 30.4375);
        if (elapsedMonths >= maxMonths) {
          return { recorded: false, reason: "max_months_reached" };
        }
      }

      const baseMode = params.baseMode ?? BASE_DE_CALCULO;
      const baseAmountCents =
        baseMode === "valor_liquido" && typeof params.netAmountCents === "number"
          ? Math.max(0, Math.round(params.netAmountCents))
          : Math.max(0, Math.round(params.grossAmountCents));

      const percentualAplicado =
        typeof params.percentOverride === "number"
          ? params.percentOverride
          : getOfficialCommissionPercentForPlan(
              params.planId,
              partner.percentualComissao
            );

      const valorComissaoCentavos = calculateCommissionCents(
        baseAmountCents,
        percentualAplicado
      );

      const warrantyDays = params.warrantyDays ?? GARANTIA_DIAS;
      const criadoEm = new Date(nowMs).toISOString();
      const disponivelEm = new Date(
        nowMs + warrantyDays * 24 * 60 * 60 * 1000
      ).toISOString();

      const commission: LedgerCommissionRecord = {
        id: this.nextId("comm"),
        partnerId,
        userId: params.userId,
        transactionId: params.transactionId,
        plano: params.planId,
        ciclo: params.billingCycle,
        tipo,
        valorBaseCentavos: baseAmountCents,
        percentualAplicado,
        valorComissaoCentavos,
        baseCalculo: baseMode,
        status: "pendente",
        criadoEm,
        disponivelEm,
        pagaEm: null,
        estornadaEm: null,
        withdrawalRequestId: null,
      };

      this.commissions.push(commission);
      this.ledgerEntries.push({
        id: this.nextId("led"),
        partnerId,
        commissionId: commission.id,
        withdrawalRequestId: null,
        settledWithdrawalId: null,
        tipo: "comissao_pendente",
        valorCentavos: valorComissaoCentavos,
        saldoAfetado: "pendente",
        descricao: `Comissão ${tipo} gerada (${params.planId})`,
        criadoEm,
      });
      this.auditLogs.push({
        id: this.nextId("aud"),
        entidade: "commission",
        entidadeId: commission.id,
        partnerId,
        actorType: "webhook",
        actorId: null,
        actorEmail: "cakto:webhook",
        acao: "criada",
        estadoAnterior: null,
        estadoNovo: { status: "pendente", valorComissaoCentavos },
        motivo: `Webhook ${params.eventType}`,
        criadoEm,
      });

      return { recorded: true, commission };
    });
  }

  matureCommissions(nowIso = new Date().toISOString()): number {
    const nowMs = new Date(nowIso).getTime();
    let count = 0;
    for (const c of this.commissions) {
      if (c.status === "pendente" && new Date(c.disponivelEm).getTime() <= nowMs) {
        c.status = "disponivel";
        this.ledgerEntries.push({
          id: this.nextId("led"),
          partnerId: c.partnerId,
          commissionId: c.id,
          withdrawalRequestId: null,
          settledWithdrawalId: null,
          tipo: "liberacao_disponivel",
          valorCentavos: c.valorComissaoCentavos,
          saldoAfetado: "disponivel",
          descricao: "Garantia concluída",
          criadoEm: nowIso,
        });
        this.auditLogs.push({
          id: this.nextId("aud"),
          entidade: "commission",
          entidadeId: c.id,
          partnerId: c.partnerId,
          actorType: "cron",
          actorId: null,
          actorEmail: "system:cron",
          acao: "maturada",
          estadoAnterior: { status: "pendente" },
          estadoNovo: { status: "disponivel" },
          motivo: "Prazo de garantia concluído",
          criadoEm: nowIso,
        });
        count += 1;
      }
    }
    return count;
  }

  async requestWithdrawal(params: {
    partnerId: string;
    metodo: WithdrawalMethod;
    pixTipoChave: PixKeyType | null;
    dadosPagamento: string;
    requestedCents?: number | null;
    minWithdrawalCents?: number;
    nowIso?: string;
  }): Promise<
    | { ok: true; withdrawal: LedgerWithdrawalRecord }
    | { ok: false; code: string; error: string }
  > {
    const minCents = params.minWithdrawalCents ?? SAQUE_MINIMO_CENTAVOS;
    return this.withPartnerLock(params.partnerId, () => {
      const partner = this.partners.get(params.partnerId);
      if (!partner || !partner.ativo) {
        return { ok: false, code: "inactive", error: "Parceiro inativo." };
      }

      const openExists = this.withdrawals.some(
        (w) =>
          w.partnerId === params.partnerId &&
          (w.status === "solicitado" || w.status === "em_analise")
      );
      if (openExists) {
        return {
          ok: false,
          code: "open_exists",
          error: "Já existe um pedido de saque em aberto.",
        };
      }

      const summary = this.getBalance(params.partnerId, minCents);
      if (summary.saldoDisponivelCentavos < minCents) {
        return {
          ok: false,
          code: "insufficient_balance",
          error: "Saldo disponível abaixo do mínimo para saque.",
        };
      }

      const targetCents =
        params.requestedCents && params.requestedCents > 0
          ? params.requestedCents
          : summary.saldoDisponivelCentavos;

      if (targetCents < minCents) {
        return {
          ok: false,
          code: "below_minimum",
          error: "Valor abaixo do mínimo.",
        };
      }

      if (targetCents > summary.saldoDisponivelCentavos) {
        return {
          ok: false,
          code: "insufficient_balance",
          error: "Saldo disponível insuficiente.",
        };
      }

      const nowIso = params.nowIso ?? new Date().toISOString();
      const withdrawal: LedgerWithdrawalRecord = {
        id: this.nextId("wd"),
        partnerId: params.partnerId,
        valorCentavos: targetCents,
        saldoNoMomentoCentavos: summary.saldoDisponivelCentavos,
        metodo: params.metodo,
        pixTipoChave: params.metodo === "pix" ? params.pixTipoChave : null,
        dadosPagamento: params.dadosPagamento.trim(),
        status: "solicitado",
        comprovativoRef: null,
        motivoRecusa: null,
        solicitadoEm: nowIso,
        analisadoEm: null,
        pagoEm: null,
        recusadoEm: null,
      };
      this.withdrawals.push(withdrawal);

      let openAdj = 0;
      for (const entry of this.ledgerEntries) {
        if (
          entry.partnerId === params.partnerId &&
          (entry.tipo === "ajuste_estorno_pos_pagamento" ||
            entry.tipo === "credito_troco_saque") &&
          !entry.settledWithdrawalId
        ) {
          openAdj += entry.valorCentavos;
          entry.settledWithdrawalId = withdrawal.id;
        }
      }

      const neededFromComms = targetCents - openAdj;
      const eligible = this.commissions
        .filter((c) => c.partnerId === params.partnerId && c.status === "disponivel")
        .sort((a, b) => a.disponivelEm.localeCompare(b.disponivelEm));

      let selectedSum = 0;
      for (const c of eligible) {
        if (
          targetCents < summary.saldoDisponivelCentavos &&
          selectedSum >= neededFromComms
        ) {
          break;
        }
        c.status = "em_saque";
        c.withdrawalRequestId = withdrawal.id;
        selectedSum += c.valorComissaoCentavos;
        this.auditLogs.push({
          id: this.nextId("aud"),
          entidade: "commission",
          entidadeId: c.id,
          partnerId: params.partnerId,
          actorType: "partner",
          actorId: partner.userId,
          actorEmail: "partner",
          acao: "incluida_em_saque",
          estadoAnterior: { status: "disponivel" },
          estadoNovo: { status: "em_saque", withdrawalRequestId: withdrawal.id },
          motivo: "Incluída em pedido de saque",
          criadoEm: nowIso,
        });
      }

      const remainder = selectedSum + openAdj - targetCents;
      if (remainder > 0) {
        this.ledgerEntries.push({
          id: this.nextId("led"),
          partnerId: params.partnerId,
          commissionId: null,
          withdrawalRequestId: withdrawal.id,
          settledWithdrawalId: null,
          tipo: "credito_troco_saque",
          valorCentavos: remainder,
          saldoAfetado: "disponivel",
          descricao: "Troco remanescente mantido disponível",
          criadoEm: nowIso,
        });
      }

      this.auditLogs.push({
        id: this.nextId("aud"),
        entidade: "withdrawal_request",
        entidadeId: withdrawal.id,
        partnerId: params.partnerId,
        actorType: "partner",
        actorId: partner.userId,
        actorEmail: "partner",
        acao: "saque_solicitado",
        estadoAnterior: null,
        estadoNovo: { status: "solicitado", valorCentavos: targetCents },
        motivo: "Solicitado pelo parceiro",
        criadoEm: nowIso,
      });

      return { ok: true, withdrawal };
    });
  }

  async adminUpdateWithdrawal(params: {
    withdrawalId: string;
    action: "em_analise" | "pago" | "recusado";
    comprovativoRef?: string;
    motivoRecusa?: string;
    adminEmail?: string;
    nowIso?: string;
  }): Promise<{ ok: boolean; error?: string }> {
    const w = this.withdrawals.find((item) => item.id === params.withdrawalId);
    if (!w) return { ok: false, error: "Pedido não encontrado." };

    return this.withPartnerLock(w.partnerId, () => {
      const nowIso = params.nowIso ?? new Date().toISOString();
      if (w.status === "pago" || w.status === "recusado") {
        return { ok: false, error: "Pedido já finalizado." };
      }

      if (params.action === "em_analise") {
        const prev = w.status;
        w.status = "em_analise";
        w.analisadoEm = nowIso;
        this.auditLogs.push({
          id: this.nextId("aud"),
          entidade: "withdrawal_request",
          entidadeId: w.id,
          partnerId: w.partnerId,
          actorType: "admin",
          actorId: null,
          actorEmail: params.adminEmail ?? "admin",
          acao: "saque_em_analise",
          estadoAnterior: { status: prev },
          estadoNovo: { status: "em_analise" },
          motivo: "Em análise",
          criadoEm: nowIso,
        });
        return { ok: true };
      }

      if (params.action === "pago") {
        const prev = w.status;
        w.status = "pago";
        w.pagoEm = nowIso;
        w.comprovativoRef = params.comprovativoRef?.trim() || null;

        for (const c of this.commissions) {
          if (c.withdrawalRequestId === w.id && c.status === "em_saque") {
            c.status = "paga";
            c.pagaEm = nowIso;
            this.auditLogs.push({
              id: this.nextId("aud"),
              entidade: "commission",
              entidadeId: c.id,
              partnerId: w.partnerId,
              actorType: "admin",
              actorId: null,
              actorEmail: params.adminEmail ?? "admin",
              acao: "paga",
              estadoAnterior: { status: "em_saque" },
              estadoNovo: { status: "paga", pagaEm: nowIso },
              motivo: w.comprovativoRef ?? "Saque pago",
              criadoEm: nowIso,
            });
          }
        }

        this.auditLogs.push({
          id: this.nextId("aud"),
          entidade: "withdrawal_request",
          entidadeId: w.id,
          partnerId: w.partnerId,
          actorType: "admin",
          actorId: null,
          actorEmail: params.adminEmail ?? "admin",
          acao: "saque_pago",
          estadoAnterior: { status: prev },
          estadoNovo: { status: "pago", comprovativoRef: w.comprovativoRef },
          motivo: "Pago pelo administrador",
          criadoEm: nowIso,
        });
        return { ok: true };
      }

      if (!params.motivoRecusa?.trim()) {
        return { ok: false, error: "Motivo obrigatório." };
      }
      const prev = w.status;
      w.status = "recusado";
      w.recusadoEm = nowIso;
      w.motivoRecusa = params.motivoRecusa.trim();

      for (const c of this.commissions) {
        if (c.withdrawalRequestId === w.id && c.status === "em_saque") {
          c.status = "disponivel";
          c.withdrawalRequestId = null;
          this.auditLogs.push({
            id: this.nextId("aud"),
            entidade: "commission",
            entidadeId: c.id,
            partnerId: w.partnerId,
            actorType: "admin",
            actorId: null,
            actorEmail: params.adminEmail ?? "admin",
            acao: "devolvida_para_disponivel",
            estadoAnterior: { status: "em_saque" },
            estadoNovo: { status: "disponivel" },
            motivo: w.motivoRecusa,
            criadoEm: nowIso,
          });
        }
      }

      this.ledgerEntries = this.ledgerEntries.filter(
        (e) =>
          !(
            e.withdrawalRequestId === w.id && e.tipo === "credito_troco_saque"
          )
      );
      for (const e of this.ledgerEntries) {
        if (e.settledWithdrawalId === w.id) {
          e.settledWithdrawalId = null;
        }
      }

      this.auditLogs.push({
        id: this.nextId("aud"),
        entidade: "withdrawal_request",
        entidadeId: w.id,
        partnerId: w.partnerId,
        actorType: "admin",
        actorId: null,
        actorEmail: params.adminEmail ?? "admin",
        acao: "saque_recusado",
        estadoAnterior: { status: prev },
        estadoNovo: { status: "recusado", motivoRecusa: w.motivoRecusa },
        motivo: w.motivoRecusa,
        criadoEm: nowIso,
      });

      return { ok: true };
    });
  }

  async reverseByTransactionId(
    transactionId: string,
    nowIso = new Date().toISOString()
  ): Promise<{ reversed: boolean; negativeOffsetApplied: boolean }> {
    const comm = this.commissions.find(
      (c) => c.transactionId === transactionId
    );
    if (!comm || comm.status === "estornada") {
      return { reversed: false, negativeOffsetApplied: false };
    }

    return this.withPartnerLock(comm.partnerId, () => {
      const prevStatus = comm.status;
      const prevWithdrawalId = comm.withdrawalRequestId;
      comm.status = "estornada";
      comm.estornadaEm = nowIso;
      comm.withdrawalRequestId = null;

      let negativeOffsetApplied = false;
      if (prevStatus === "paga") {
        negativeOffsetApplied = true;
        this.ledgerEntries.push({
          id: this.nextId("led"),
          partnerId: comm.partnerId,
          commissionId: comm.id,
          withdrawalRequestId: null,
          settledWithdrawalId: null,
          tipo: "ajuste_estorno_pos_pagamento",
          valorCentavos: -Math.abs(comm.valorComissaoCentavos),
          saldoAfetado: "compensacao",
          descricao: "Estorno pós-pagamento",
          criadoEm: nowIso,
        });
      } else if (prevStatus === "em_saque" && prevWithdrawalId) {
        const openW = this.withdrawals.find((w) => w.id === prevWithdrawalId);
        if (
          openW &&
          (openW.status === "solicitado" || openW.status === "em_analise")
        ) {
          const nextAmount = openW.valorCentavos - comm.valorComissaoCentavos;
          if (nextAmount <= 0) {
            openW.status = "recusado";
            openW.motivoRecusa =
              "Comissão vinculada estornada antes do pagamento.";
            openW.recusadoEm = nowIso;
            for (const c of this.commissions) {
              if (c.withdrawalRequestId === openW.id && c.status === "em_saque") {
                c.status = "disponivel";
                c.withdrawalRequestId = null;
              }
            }
          } else {
            openW.valorCentavos = nextAmount;
          }
        }
      }

      this.auditLogs.push({
        id: this.nextId("aud"),
        entidade: "commission",
        entidadeId: comm.id,
        partnerId: comm.partnerId,
        actorType: "webhook",
        actorId: null,
        actorEmail: "cakto:webhook",
        acao: "estornada",
        estadoAnterior: { status: prevStatus },
        estadoNovo: {
          status: "estornada",
          compensacaoPendente: negativeOffsetApplied,
        },
        motivo: "Reembolso ou chargeback",
        criadoEm: nowIso,
      });

      return { reversed: true, negativeOffsetApplied };
    });
  }
}
