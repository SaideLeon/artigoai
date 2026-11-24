import { NextRequest, NextResponse } from "next/server";
import {
  brlToCents,
  centsToBrlNumber,
  PLAN_COMMISSION_RATES,
  type CommissionStatus,
  type WithdrawalStatus,
} from "@/lib/partners";
import {
  computePartnerBalanceSummary,
  type LedgerAdjustmentRecord,
  type LedgerCommissionRecord,
  type LedgerWithdrawalRecord,
} from "@/lib/partners-ledger";
import { requirePartnerAdmin } from "@/lib/partners-server";

const VALID_COMM_STATUSES = new Set<CommissionStatus>([
  "pendente",
  "disponivel",
  "em_saque",
  "paga",
  "estornada",
]);

const VALID_WITHDRAWAL_STATUSES = new Set<WithdrawalStatus>([
  "solicitado",
  "em_analise",
  "pago",
  "recusado",
]);

export async function GET(req: NextRequest) {
  const auth = await requirePartnerAdmin();
  if (!auth.ok) {
    return NextResponse.json(
      { erro: auth.error, diag: auth.diag ?? null },
      { status: auth.status }
    );
  }

  const partnerIdFilter = req.nextUrl.searchParams.get("partnerId")?.trim();
  const statusFilter = req.nextUrl.searchParams.get("status")?.trim();
  const withdrawalStatusFilter = req.nextUrl.searchParams
    .get("withdrawalStatus")
    ?.trim();

  // Atualiza convites expirados
  const nowIso = new Date().toISOString();
  await auth.admin
    .from("partner_invites")
    .update({ status: "expirado" })
    .eq("status", "pendente")
    .lt("expira_em", nowIso);

  let commissionsQuery = auth.admin
    .from("commissions")
    .select("*")
    .order("criado_em", { ascending: false })
    .limit(300);

  if (partnerIdFilter && /^[0-9a-fA-F-]{36}$/.test(partnerIdFilter)) {
    commissionsQuery = commissionsQuery.eq("partner_id", partnerIdFilter);
  }
  if (statusFilter && VALID_COMM_STATUSES.has(statusFilter as CommissionStatus)) {
    commissionsQuery = commissionsQuery.eq("status", statusFilter);
  }

  let withdrawalsQuery = auth.admin
    .from("withdrawal_requests")
    .select("*")
    .order("solicitado_em", { ascending: false })
    .limit(300);

  if (partnerIdFilter && /^[0-9a-fA-F-]{36}$/.test(partnerIdFilter)) {
    withdrawalsQuery = withdrawalsQuery.eq("partner_id", partnerIdFilter);
  }
  if (
    withdrawalStatusFilter &&
    VALID_WITHDRAWAL_STATUSES.has(withdrawalStatusFilter as WithdrawalStatus)
  ) {
    withdrawalsQuery = withdrawalsQuery.eq("status", withdrawalStatusFilter);
  }

  const [
    { data: invites, error: invErr },
    { data: partners, error: partErr },
    { data: clickRows },
    { data: referredProfiles },
    { data: paidSubs },
    { data: allCommissions },
    { data: filteredCommissions, error: commErr },
    { data: allWithdrawals },
    { data: filteredWithdrawals, error: wdErr },
    { data: allLedgerEntries },
    { data: auditRows },
  ] = await Promise.all([
    auth.admin
      .from("partner_invites")
      .select(
        "id, nome_sugerido, percentual_comissao, expira_em, status, criado_em, aceito_em, aceito_por_user_id, criado_por_email"
      )
      .order("criado_em", { ascending: false })
      .limit(100),
    auth.admin
      .from("partners")
      .select(
        "id, user_id, codigo, percentual_comissao, ativo, codigo_personalizado, criado_em"
      )
      .order("criado_em", { ascending: false }),
    auth.admin.from("referral_clicks").select("partner_id, total"),
    auth.admin
      .from("profiles")
      .select("id, referred_by")
      .not("referred_by", "is", null),
    auth.admin
      .from("subscriptions")
      .select("user_id, plan, status")
      .eq("status", "active")
      .neq("plan", "free"),
    auth.admin.from("commissions").select("*"),
    commissionsQuery,
    auth.admin.from("withdrawal_requests").select("*"),
    withdrawalsQuery,
    auth.admin.from("partner_ledger_entries").select("*"),
    auth.admin
      .from("partner_audit_logs")
      .select("*")
      .order("criado_em", { ascending: false })
      .limit(80),
  ]);

  if (invErr || partErr || commErr || wdErr) {
    return NextResponse.json(
      {
        erro:
          invErr?.message ||
          partErr?.message ||
          commErr?.message ||
          wdErr?.message ||
          "Erro ao consultar dados de parceiros.",
      },
      { status: 500 }
    );
  }

  const partnerUserIds = (partners ?? []).map((p) => String(p.user_id));
  const commissionUserIds = (filteredCommissions ?? []).map((c) =>
    String(c.user_id)
  );
  const allProfileIds = Array.from(
    new Set([...partnerUserIds, ...commissionUserIds])
  );

  const profileMap = new Map<
    string,
    { email: string; full_name: string }
  >();
  if (allProfileIds.length > 0) {
    const { data: profiles } = await auth.admin
      .from("profiles")
      .select("id, email, full_name")
      .in("id", allProfileIds);
    for (const p of profiles ?? []) {
      profileMap.set(String(p.id), {
        email: String(p.email ?? ""),
        full_name: String(p.full_name ?? "Usuário Artigen"),
      });
    }
  }

  const activeSubUsers = new Set(
    (paidSubs ?? []).map((s) => String(s.user_id))
  );

  const clicksByPartner = new Map<string, number>();
  for (const row of clickRows ?? []) {
    const pid = String(row.partner_id);
    clicksByPartner.set(
      pid,
      (clicksByPartner.get(pid) ?? 0) + Number(row.total ?? 0)
    );
  }

  const referralsByPartner = new Map<string, number>();
  const activeSubsByPartner = new Map<string, number>();
  for (const prof of referredProfiles ?? []) {
    const pid = String(prof.referred_by);
    referralsByPartner.set(pid, (referralsByPartner.get(pid) ?? 0) + 1);
    if (activeSubUsers.has(String(prof.id))) {
      activeSubsByPartner.set(
        pid,
        (activeSubsByPartner.get(pid) ?? 0) + 1
      );
    }
  }

  const normalizeComm = (c: Record<string, unknown>): LedgerCommissionRecord => ({
    id: String(c.id),
    partnerId: String(c.partner_id),
    userId: String(c.user_id),
    transactionId: String(c.id_da_transacao_cakto ?? ""),
    plano: String(c.plano ?? "starter"),
    ciclo: c.ciclo === "yearly" ? "yearly" : "monthly",
    tipo: c.tipo === "renovacao" ? "renovacao" : "primeiro_pagamento",
    valorBaseCentavos:
      typeof c.valor_base_centavos === "number"
        ? c.valor_base_centavos
        : brlToCents(Number(c.valor_bruto ?? 0)),
    percentualAplicado: Number(c.percentual_aplicado ?? 0),
    valorComissaoCentavos:
      typeof c.valor_comissao_centavos === "number"
        ? c.valor_comissao_centavos
        : brlToCents(Number(c.valor_comissao ?? 0)),
    baseCalculo:
      c.base_calculo === "valor_liquido" ? "valor_liquido" : "valor_bruto",
    status: c.status as CommissionStatus,
    criadoEm: String(c.criado_em ?? ""),
    disponivelEm: String(c.disponivel_em ?? c.criado_em ?? ""),
    pagaEm: c.paga_em ? String(c.paga_em) : null,
    estornadaEm: c.estornada_em ? String(c.estornada_em) : null,
    withdrawalRequestId: c.withdrawal_request_id
      ? String(c.withdrawal_request_id)
      : null,
  });

  const normalizeWd = (w: Record<string, unknown>): LedgerWithdrawalRecord => ({
    id: String(w.id),
    partnerId: String(w.partner_id),
    valorCentavos: Number(w.valor_centavos ?? 0),
    saldoNoMomentoCentavos: Number(w.saldo_no_momento_centavos ?? 0),
    metodo: w.metodo === "outro" ? "outro" : "pix",
    pixTipoChave: (w.pix_tipo_chave as LedgerWithdrawalRecord["pixTipoChave"]) ?? null,
    dadosPagamento: String(w.dados_pagamento ?? ""),
    status: w.status as WithdrawalStatus,
    comprovativoRef: w.comprovativo_ref ? String(w.comprovativo_ref) : null,
    motivoRecusa: w.motivo_recusa ? String(w.motivo_recusa) : null,
    solicitadoEm: String(w.solicitado_em ?? ""),
    analisadoEm: w.analisado_em ? String(w.analisado_em) : null,
    pagoEm: w.pago_em ? String(w.pago_em) : null,
    recusadoEm: w.recusado_em ? String(w.recusado_em) : null,
  });

  const allNormalizedComms = (allCommissions ?? []).map(normalizeComm);
  const allNormalizedWds = (allWithdrawals ?? []).map(normalizeWd);
  const allNormalizedLedger: LedgerAdjustmentRecord[] = (
    allLedgerEntries ?? []
  ).map((l) => ({
    id: String(l.id),
    partnerId: String(l.partner_id),
    commissionId: l.commission_id ? String(l.commission_id) : null,
    withdrawalRequestId: l.withdrawal_request_id
      ? String(l.withdrawal_request_id)
      : null,
    settledWithdrawalId: l.settled_withdrawal_id
      ? String(l.settled_withdrawal_id)
      : null,
    tipo: l.tipo,
    valorCentavos: Number(l.valor_centavos ?? 0),
    saldoAfetado: l.saldo_afetado,
    descricao: String(l.descricao ?? ""),
    criadoEm: String(l.criado_em ?? ""),
  }));

  let totalPendenteGarantiaCentavos = 0;
  let totalDisponivelCentavos = 0;
  let totalEmSaqueCentavos = 0;
  let totalJaPagoCentavos = 0;
  let totalEstornadoCentavos = 0;

  const partnerInfoMap = new Map<
    string,
    { codigo: string; nome: string; email: string }
  >();

  const enrichedPartners = (partners ?? []).map((p) => {
    const pid = String(p.id);
    const prof = profileMap.get(String(p.user_id));
    const nome = prof?.full_name || "Parceiro Artigen";
    const email = prof?.email || "";
    partnerInfoMap.set(pid, { codigo: String(p.codigo), nome, email });

    const balance = computePartnerBalanceSummary({
      commissions: allNormalizedComms.filter((c) => c.partnerId === pid),
      withdrawals: allNormalizedWds.filter((w) => w.partnerId === pid),
      ledgerEntries: allNormalizedLedger.filter((l) => l.partnerId === pid),
      partnerActive: Boolean(p.ativo),
    });

    totalPendenteGarantiaCentavos += balance.saldoPendenteCentavos;
    totalDisponivelCentavos += balance.saldoDisponivelCentavos;
    totalEmSaqueCentavos += balance.saldoEmSaqueCentavos;
    totalJaPagoCentavos += balance.totalRecebidoCentavos;
    totalEstornadoCentavos += balance.totalEstornadoCentavos;

    return {
      id: pid,
      userId: String(p.user_id),
      nome,
      email,
      codigo: p.codigo,
      percentualComissao: Number(p.percentual_comissao),
      ativo: Boolean(p.ativo),
      codigoPersonalizado: Boolean(p.codigo_personalizado),
      criadoEm: p.criado_em,
      cliques: clicksByPartner.get(pid) ?? 0,
      cadastros: referralsByPartner.get(pid) ?? 0,
      assinantesAtivos: activeSubsByPartner.get(pid) ?? 0,
      pendenteBrl: centsToBrlNumber(balance.saldoPendenteCentavos),
      disponivelBrl: centsToBrlNumber(balance.saldoDisponivelCentavos),
      emSaqueBrl: centsToBrlNumber(balance.saldoEmSaqueCentavos),
      pagaBrl: centsToBrlNumber(balance.totalRecebidoCentavos),
      estornadaBrl: centsToBrlNumber(balance.totalEstornadoCentavos),
      totalGanhoBrl: centsToBrlNumber(balance.totalGanhoCentavos),
    };
  });

  const enrichedCommissions = (filteredCommissions ?? []).map((raw) => {
    const c = normalizeComm(raw);
    const customerProf = profileMap.get(c.userId);
    return {
      id: c.id,
      partnerId: c.partnerId,
      partnerCodigo: partnerInfoMap.get(c.partnerId)?.codigo ?? "—",
      userId: c.userId,
      customerEmail: customerProf?.email || c.userId,
      transacaoCakto: c.transactionId,
      plano: c.plano,
      ciclo: c.ciclo,
      tipo: c.tipo,
      valorBruto: centsToBrlNumber(c.valorBaseCentavos),
      percentualAplicado: c.percentualAplicado,
      valorComissao: centsToBrlNumber(c.valorComissaoCentavos),
      moeda: "BRL",
      status: c.status,
      criadoEm: c.criadoEm,
      disponivelEm: c.disponivelEm,
      pagaEm: c.pagaEm,
      estornadaEm: c.estornadaEm,
    };
  });

  const enrichedWithdrawals = (filteredWithdrawals ?? []).map((raw) => {
    const w = normalizeWd(raw);
    const pInfo = partnerInfoMap.get(w.partnerId);
    return {
      id: w.id,
      partnerId: w.partnerId,
      partnerCodigo: pInfo?.codigo ?? "—",
      partnerNome: pInfo?.nome ?? "Parceiro",
      partnerEmail: pInfo?.email ?? "",
      valorCentavos: w.valorCentavos,
      valorBrl: centsToBrlNumber(w.valorCentavos),
      saldoNoMomentoBrl: centsToBrlNumber(w.saldoNoMomentoCentavos),
      metodo: w.metodo,
      pixTipoChave: w.pixTipoChave,
      dadosPagamento: w.dadosPagamento,
      status: w.status,
      comprovativoRef: w.comprovativoRef,
      motivoRecusa: w.motivoRecusa,
      solicitadoEm: w.solicitadoEm,
      analisadoEm: w.analisadoEm,
      pagoEm: w.pagoEm,
      recusadoEm: w.recusadoEm,
    };
  });

  const totalAPagarCentavos =
    totalPendenteGarantiaCentavos +
    totalDisponivelCentavos +
    totalEmSaqueCentavos;

  const totalCliques = Array.from(clicksByPartner.values()).reduce(
    (a, b) => a + b,
    0
  );

  return NextResponse.json({
    adminEmail: auth.user.email ?? "",
    planCommissionRates: PLAN_COMMISSION_RATES,
    summary: {
      totalParceiros: enrichedPartners.length,
      parceirosAtivos: enrichedPartners.filter((p) => p.ativo).length,
      totalCliques,
      totalCadastros: (referredProfiles ?? []).length,
      totalPendenteBrl: centsToBrlNumber(totalPendenteGarantiaCentavos),
      totalDisponivelBrl: centsToBrlNumber(totalDisponivelCentavos),
      totalEmSaqueBrl: centsToBrlNumber(totalEmSaqueCentavos),
      totalAPagarBrl: centsToBrlNumber(totalAPagarCentavos),
      totalPagaBrl: centsToBrlNumber(totalJaPagoCentavos),
      totalEstornadoBrl: centsToBrlNumber(totalEstornadoCentavos),
      saquesAbertosCount: allNormalizedWds.filter(
        (w) => w.status === "solicitado" || w.status === "em_analise"
      ).length,
    },
    invites: invites ?? [],
    partners: enrichedPartners,
    commissions: enrichedCommissions,
    withdrawals: enrichedWithdrawals,
    auditLogs: (auditRows ?? []).map((a) => ({
      id: a.id,
      entidade: a.entidade,
      entidadeId: a.entidade_id,
      partnerId: a.partner_id,
      partnerCodigo: partnerInfoMap.get(String(a.partner_id))?.codigo ?? "—",
      actorType: a.actor_type,
      actorEmail: a.actor_email,
      acao: a.acao,
      estadoAnterior: a.estado_anterior,
      estadoNovo: a.estado_novo,
      motivo: a.motivo,
      criadoEm: a.criado_em,
    })),
  });
}
