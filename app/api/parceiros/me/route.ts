import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/cakto-fulfillment";
import {
  BASE_DE_CALCULO,
  brlToCents,
  centsToBrlNumber,
  GARANTIA_DIAS,
  maskEmail,
  SAQUE_MINIMO_CENTAVOS,
  type CommissionStatus,
} from "@/lib/partners";
import {
  computePartnerBalanceSummary,
  type LedgerAdjustmentRecord,
  type LedgerCommissionRecord,
  type LedgerWithdrawalRecord,
} from "@/lib/partners-ledger";
import {
  getAuthenticatedServerUser,
  getPublicSiteOrigin,
} from "@/lib/partners-server";

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedServerUser();
  if (!user) {
    return NextResponse.json(
      { erro: "Sessão de utilizador necessária." },
      { status: 401 }
    );
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json(
      { erro: "Supabase service_role não configurado no servidor." },
      { status: 503 }
    );
  }

  const { data: partner, error: partnerErr } = await admin
    .from("partners")
    .select(
      "id, user_id, codigo, percentual_comissao, ativo, codigo_personalizado, criado_em"
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (partnerErr) {
    return NextResponse.json({ erro: partnerErr.message }, { status: 500 });
  }

  if (!partner) {
    return NextResponse.json({ isPartner: false });
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const [
    { data: clickRows },
    { data: referredProfiles, count: totalReferralsCount },
    { data: commissionsRows },
    { data: withdrawalRows },
    { data: ledgerRows },
  ] = await Promise.all([
    admin
      .from("referral_clicks")
      .select("data, total")
      .eq("partner_id", partner.id)
      .order("data", { ascending: false })
      .limit(90),
    admin
      .from("profiles")
      .select("id, email, referred_at", { count: "exact" })
      .eq("referred_by", partner.id)
      .order("referred_at", { ascending: false })
      .limit(50),
    admin
      .from("commissions")
      .select("*")
      .eq("partner_id", partner.id)
      .order("criado_em", { ascending: false })
      .limit(500),
    admin
      .from("withdrawal_requests")
      .select("*")
      .eq("partner_id", partner.id)
      .order("solicitado_em", { ascending: false })
      .limit(100),
    admin
      .from("partner_ledger_entries")
      .select(
        "id, partner_id, commission_id, withdrawal_request_id, settled_withdrawal_id, tipo, valor_centavos, saldo_afetado, descricao, criado_em"
      )
      .eq("partner_id", partner.id)
      .order("criado_em", { ascending: false })
      .limit(500),
  ]);

  const clicksList = (clickRows ?? []) as { data: string; total: number }[];
  const cliquesTotais = clicksList.reduce(
    (acc, row) => acc + Number(row.total || 0),
    0
  );
  const cliquesUltimos30Dias = clicksList
    .filter((row) => row.data >= thirtyDaysAgo)
    .reduce((acc, row) => acc + Number(row.total || 0), 0);

  const referredIds = (referredProfiles ?? []).map((p) => String(p.id));
  const subByUser = new Map<string, { plan: string; status: string }>();
  const emailByUser = new Map<string, string>();

  for (const prof of referredProfiles ?? []) {
    emailByUser.set(String(prof.id), String(prof.email ?? ""));
  }

  if (referredIds.length > 0) {
    const { data: subs } = await admin
      .from("subscriptions")
      .select("user_id, plan, status")
      .in("user_id", referredIds);

    for (const s of subs ?? []) {
      subByUser.set(String(s.user_id), {
        plan: String(s.plan ?? "free"),
        status: String(s.status ?? "active"),
      });
    }
  }

  let assinantesAtivos = 0;
  for (const sub of subByUser.values()) {
    if (sub.plan !== "free" && sub.status === "active") {
      assinantesAtivos += 1;
    }
  }

  const commissionList = commissionsRows ?? [];
  const missingUserIds = Array.from(
    new Set(
      commissionList
        .map((c) => String(c.user_id))
        .filter((uid) => !emailByUser.has(uid))
    )
  );
  if (missingUserIds.length > 0) {
    const { data: extraProfiles } = await admin
      .from("profiles")
      .select("id, email")
      .in("id", missingUserIds);
    for (const ep of extraProfiles ?? []) {
      emailByUser.set(String(ep.id), String(ep.email ?? ""));
    }
  }

  const normalizedCommissions: LedgerCommissionRecord[] = commissionList.map(
    (c) => {
      const baseCents =
        typeof c.valor_base_centavos === "number"
          ? c.valor_base_centavos
          : brlToCents(Number(c.valor_bruto ?? 0));
      const commCents =
        typeof c.valor_comissao_centavos === "number"
          ? c.valor_comissao_centavos
          : brlToCents(Number(c.valor_comissao ?? 0));
      const createdIso = String(c.criado_em);
      const disponivelEm = c.disponivel_em
        ? String(c.disponivel_em)
        : new Date(
            new Date(createdIso).getTime() + GARANTIA_DIAS * 24 * 60 * 60 * 1000
          ).toISOString();

      return {
        id: String(c.id),
        partnerId: String(c.partner_id),
        userId: String(c.user_id),
        transactionId: String(c.id_da_transacao_cakto),
        plano: String(c.plano),
        ciclo: c.ciclo === "yearly" ? "yearly" : "monthly",
        tipo: c.tipo === "renovacao" ? "renovacao" : "primeiro_pagamento",
        valorBaseCentavos: baseCents,
        percentualAplicado: Number(c.percentual_aplicado ?? 0),
        valorComissaoCentavos: commCents,
        baseCalculo:
          c.base_calculo === "valor_liquido" ? "valor_liquido" : "valor_bruto",
        status: c.status as CommissionStatus,
        criadoEm: createdIso,
        disponivelEm,
        pagaEm: c.paga_em ? String(c.paga_em) : null,
        estornadaEm: c.estornada_em ? String(c.estornada_em) : null,
        withdrawalRequestId: c.withdrawal_request_id
          ? String(c.withdrawal_request_id)
          : null,
      };
    }
  );

  const normalizedWithdrawals: LedgerWithdrawalRecord[] = (
    withdrawalRows ?? []
  ).map((w) => ({
    id: String(w.id),
    partnerId: String(w.partner_id),
    valorCentavos: Number(w.valor_centavos ?? 0),
    saldoNoMomentoCentavos: Number(w.saldo_no_momento_centavos ?? 0),
    metodo: w.metodo === "outro" ? "outro" : "pix",
    pixTipoChave: w.pix_tipo_chave ?? null,
    dadosPagamento: String(w.dados_pagamento ?? ""),
    status: w.status,
    comprovativoRef: w.comprovativo_ref ? String(w.comprovativo_ref) : null,
    motivoRecusa: w.motivo_recusa ? String(w.motivo_recusa) : null,
    solicitadoEm: String(w.solicitado_em),
    analisadoEm: w.analisado_em ? String(w.analisado_em) : null,
    pagoEm: w.pago_em ? String(w.pago_em) : null,
    recusadoEm: w.recusado_em ? String(w.recusado_em) : null,
  }));

  const normalizedLedger: LedgerAdjustmentRecord[] = (ledgerRows ?? []).map(
    (l) => ({
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
      criadoEm: String(l.criado_em),
    })
  );

  const balance = computePartnerBalanceSummary({
    commissions: normalizedCommissions,
    withdrawals: normalizedWithdrawals,
    ledgerEntries: normalizedLedger,
    minWithdrawalCents: SAQUE_MINIMO_CENTAVOS,
    partnerActive: Boolean(partner.ativo),
  });

  const origin = getPublicSiteOrigin(req.nextUrl.origin);

  return NextResponse.json({
    isPartner: true,
    config: {
      baseCalculo: BASE_DE_CALCULO,
      garantiaDias: GARANTIA_DIAS,
      saqueMinimoCentavos: SAQUE_MINIMO_CENTAVOS,
      saqueMinimoBrl: centsToBrlNumber(SAQUE_MINIMO_CENTAVOS),
    },
    partner: {
      id: partner.id,
      codigo: partner.codigo,
      percentualComissao: Number(partner.percentual_comissao),
      ativo: Boolean(partner.ativo),
      codigoPersonalizado: Boolean(partner.codigo_personalizado),
      criadoEm: partner.criado_em,
      referralUrl: `${origin}/?ref=${partner.codigo}`,
    },
    metrics: {
      cliquesTotais,
      cliquesUltimos30Dias,
      cadastrosTotais: Number(totalReferralsCount ?? referredIds.length),
      assinantesAtivos,
      saldoPendenteCentavos: balance.saldoPendenteCentavos,
      saldoDisponivelCentavos: balance.saldoDisponivelCentavos,
      saldoEmSaqueCentavos: balance.saldoEmSaqueCentavos,
      totalGanhoCentavos: balance.totalGanhoCentavos,
      totalRecebidoCentavos: balance.totalRecebidoCentavos,
      ajustesEmAbertoCentavos: balance.ajustesEmAbertoCentavos,
      saldoPendenteBrl: centsToBrlNumber(balance.saldoPendenteCentavos),
      saldoDisponivelBrl: centsToBrlNumber(balance.saldoDisponivelCentavos),
      saldoEmSaqueBrl: centsToBrlNumber(balance.saldoEmSaqueCentavos),
      totalGanhoBrl: centsToBrlNumber(balance.totalGanhoCentavos),
      totalRecebidoBrl: centsToBrlNumber(balance.totalRecebidoCentavos),
      comissoesEstornadasBrl: centsToBrlNumber(balance.totalEstornadoCentavos),
      hasOpenWithdrawal: balance.hasOpenWithdrawal,
      podeSolicitarSaque: balance.podeSolicitarSaque,
    },
    clicksByDay: clicksList.slice(0, 14).reverse(),
    referrals: (referredProfiles ?? []).slice(0, 20).map((prof) => {
      const sub = subByUser.get(String(prof.id));
      return {
        maskedEmail: maskEmail(prof.email),
        referredAt: prof.referred_at,
        plan: sub?.plan ?? "free",
        subscriptionStatus: sub?.status ?? "active",
      };
    }),
    commissions: normalizedCommissions.slice(0, 60).map((c) => ({
      id: c.id,
      criadoEm: c.criadoEm,
      disponivelEm: c.disponivelEm,
      pagaEm: c.pagaEm,
      estornadaEm: c.estornadaEm,
      maskedEmail: maskEmail(emailByUser.get(c.userId)),
      plano: c.plano,
      ciclo: c.ciclo,
      tipo: c.tipo,
      valorBaseCentavos: c.valorBaseCentavos,
      valorBruto: centsToBrlNumber(c.valorBaseCentavos),
      percentualAplicado: c.percentualAplicado,
      valorComissaoCentavos: c.valorComissaoCentavos,
      valorComissao: centsToBrlNumber(c.valorComissaoCentavos),
      moeda: "BRL",
      status: c.status,
    })),
    withdrawals: normalizedWithdrawals.map((w) => ({
      id: w.id,
      valorCentavos: w.valorCentavos,
      valorBrl: centsToBrlNumber(w.valorCentavos),
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
    })),
  });
}
