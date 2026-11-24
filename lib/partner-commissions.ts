import type { SupabaseClient } from "@supabase/supabase-js";
import {
  BASE_DE_CALCULO,
  calculateCommissionCents,
  centsToBrlNumber,
  COMISSAO_MAX_MESES,
  COMISSAO_RECORRENTE,
  GARANTIA_DIAS,
  getOfficialCommissionPercentForPlan,
  type CommissionType,
} from "@/lib/partners";
import { notifyPartnerNewCommission } from "@/lib/partner-notifications";
import type { BillingCycle } from "@/lib/pricing";

export async function recordPartnerCommissionForPayment(params: {
  admin: SupabaseClient;
  userId: string;
  planId: string;
  billingCycle: BillingCycle;
  grossAmountCents: number;
  netAmountCents?: number;
  transactionId: string | null;
  eventType?: string;
}): Promise<{
  recorded: boolean;
  alreadyExists?: boolean;
  commissionId?: string;
  reason?: string;
}> {
  const {
    admin,
    userId,
    planId,
    billingCycle,
    grossAmountCents,
    netAmountCents,
    eventType,
  } = params;
  const cleanTxId = params.transactionId?.trim();
  if (!cleanTxId || grossAmountCents <= 0) {
    return { recorded: false, reason: "missing_tx_or_zero_amount" };
  }

  const { data: profile, error: profErr } = await admin
    .from("profiles")
    .select("referred_by")
    .eq("id", userId)
    .maybeSingle();

  if (profErr || !profile?.referred_by) {
    return { recorded: false, reason: "user_not_referred" };
  }

  const { data: partner, error: partnerErr } = await admin
    .from("partners")
    .select("id, user_id, percentual_comissao, ativo")
    .eq("id", profile.referred_by)
    .maybeSingle();

  if (partnerErr || !partner) {
    return { recorded: false, reason: "partner_not_found" };
  }

  if (!partner.ativo) {
    return { recorded: false, reason: "partner_inactive" };
  }

  if (partner.user_id === userId) {
    return { recorded: false, reason: "self_referral_blocked" };
  }

  // Verifica histórico de comissões anteriores para classificar primeiro_pagamento vs renovacao
  const { data: priorCommissions } = await admin
    .from("commissions")
    .select("id, criado_em")
    .eq("partner_id", partner.id)
    .eq("user_id", userId)
    .order("criado_em", { ascending: true });

  const priorCount = priorCommissions?.length ?? 0;
  const tipo: CommissionType =
    eventType === "subscription_renewed" || priorCount > 0
      ? "renovacao"
      : "primeiro_pagamento";

  if (tipo === "renovacao" && !COMISSAO_RECORRENTE) {
    return { recorded: false, reason: "recurring_disabled" };
  }

  if (
    tipo === "renovacao" &&
    COMISSAO_MAX_MESES !== null &&
    priorCommissions &&
    priorCommissions.length > 0
  ) {
    const firstMs = new Date(priorCommissions[0].criado_em).getTime();
    const elapsedMonths =
      (Date.now() - firstMs) / (1000 * 60 * 60 * 24 * 30.4375);
    if (elapsedMonths >= COMISSAO_MAX_MESES) {
      return { recorded: false, reason: "max_months_reached" };
    }
  }

  const baseAmountCents =
    BASE_DE_CALCULO === "valor_liquido" &&
    typeof netAmountCents === "number" &&
    netAmountCents > 0
      ? Math.round(netAmountCents)
      : Math.round(grossAmountCents);

  const percentual = getOfficialCommissionPercentForPlan(
    planId,
    Number(partner.percentual_comissao)
  );
  const commissionCents = calculateCommissionCents(baseAmountCents, percentual);

  const baseBrl = centsToBrlNumber(baseAmountCents);
  const commissionBrl = centsToBrlNumber(commissionCents);

  const now = new Date();
  const disponivelEmIso = new Date(
    now.getTime() + GARANTIA_DIAS * 24 * 60 * 60 * 1000
  ).toISOString();

  const fullInsertPayload = {
    partner_id: partner.id,
    user_id: userId,
    id_da_transacao_cakto: cleanTxId,
    plano: planId,
    ciclo: billingCycle,
    valor_bruto: baseBrl,
    valor_base_centavos: baseAmountCents,
    percentual_aplicado: percentual,
    valor_comissao: commissionBrl,
    valor_comissao_centavos: commissionCents,
    base_calculo: BASE_DE_CALCULO,
    moeda: "BRL",
    tipo,
    status: "pendente",
    disponivel_em: disponivelEmIso,
  };

  let { data: inserted, error: insertErr } = await admin
    .from("commissions")
    .insert(fullInsertPayload)
    .select("id")
    .single();

  // Fallback transparente caso o banco ainda não tenha aplicado 08_partners_ledger_and_withdrawals.sql
  if (
    insertErr &&
    (insertErr.message.includes("valor_base_centavos") ||
      insertErr.message.includes("valor_comissao_centavos") ||
      insertErr.message.includes("disponivel_em"))
  ) {
    const legacyResult = await admin
      .from("commissions")
      .insert({
        partner_id: partner.id,
        user_id: userId,
        id_da_transacao_cakto: cleanTxId,
        plano: planId,
        ciclo: billingCycle,
        valor_bruto: baseBrl,
        percentual_aplicado: percentual,
        valor_comissao: commissionBrl,
        moeda: "BRL",
        tipo,
        status: "pendente",
      })
      .select("id")
      .single();
    inserted = legacyResult.data;
    insertErr = legacyResult.error;
  }

  if (insertErr) {
    if (insertErr.code === "23505") {
      return { recorded: false, alreadyExists: true };
    }
    console.error("Erro ao registrar comissão de parceiro:", insertErr.message);
    return { recorded: false, reason: insertErr.message };
  }

  const commissionId = inserted?.id;
  if (commissionId) {
    // Registra lançamento no livro-caixa e log de auditoria sem bloquear o webhook
    await Promise.allSettled([
      admin.from("partner_ledger_entries").insert({
        partner_id: partner.id,
        commission_id: commissionId,
        tipo: "comissao_pendente",
        valor_centavos: commissionCents,
        saldo_afetado: "pendente",
        descricao: `Comissão ${tipo} (${planId} · ${billingCycle}) em garantia de ${GARANTIA_DIAS} dias.`,
      }),
      admin.from("partner_audit_logs").insert({
        entidade: "commission",
        entidade_id: commissionId,
        partner_id: partner.id,
        actor_type: "webhook",
        actor_email: "cakto:webhook",
        acao: "criada",
        estado_anterior: null,
        estado_novo: {
          status: "pendente",
          valor_comissao_centavos: commissionCents,
          valor_base_centavos: baseAmountCents,
          base_calculo: BASE_DE_CALCULO,
          disponivel_em: disponivelEmIso,
        },
        motivo: `Pagamento aprovado Cakto (${eventType ?? "purchase_approved"}).`,
      }),
    ]);

    // Notifica o parceiro por e-mail sobre a nova comissão
    const { data: partnerProfile } = await admin
      .from("profiles")
      .select("email, full_name")
      .eq("id", partner.user_id)
      .maybeSingle();

    if (partnerProfile?.email) {
      await notifyPartnerNewCommission({
        partnerEmail: String(partnerProfile.email),
        partnerName: partnerProfile.full_name
          ? String(partnerProfile.full_name)
          : undefined,
        planId,
        tipo,
        valorComissaoCentavos: commissionCents,
        disponivelEmIso,
      });
    }
  }

  return {
    recorded: true,
    commissionId,
  };
}

export async function reversePartnerCommissionForTransaction(params: {
  admin: SupabaseClient;
  transactionCandidates: string[];
  userId?: string | null;
  motivo?: string;
}): Promise<number> {
  const { admin, userId } = params;
  const motivo =
    params.motivo ?? "Reembolso ou chargeback confirmado pela Cakto.";
  const candidates = Array.from(
    new Set(params.transactionCandidates.map((c) => c.trim()).filter(Boolean))
  );

  let targetIds: string[] = [];

  if (candidates.length > 0) {
    const { data } = await admin
      .from("commissions")
      .select("id")
      .in("id_da_transacao_cakto", candidates)
      .neq("status", "estornada");
    targetIds = (data ?? []).map((r) => String(r.id));
  }

  // Fallback seguro caso o webhook de estorno não traga o id original da transação
  if (userId && targetIds.length === 0) {
    const { data: latest } = await admin
      .from("commissions")
      .select("id")
      .eq("user_id", userId)
      .neq("status", "estornada")
      .order("criado_em", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latest?.id) {
      targetIds = [String(latest.id)];
    }
  }

  let reversedCount = 0;
  for (const commissionId of targetIds) {
    const { data: rpcRes, error: rpcErr } = await admin.rpc(
      "reverse_partner_commission",
      {
        p_commission_id: commissionId,
        p_actor_type: "webhook",
        p_actor_email: "cakto:webhook",
        p_motivo: motivo,
      }
    );

    if (!rpcErr && rpcRes?.ok) {
      reversedCount += 1;
      continue;
    }

    // Fallback caso a RPC da migração 08 ainda não tenha sido aplicada
    if (rpcErr?.message?.includes("reverse_partner_commission")) {
      const { error } = await admin
        .from("commissions")
        .update({ status: "estornada" })
        .eq("id", commissionId)
        .neq("status", "estornada");
      if (!error) reversedCount += 1;
    }
  }

  return reversedCount;
}
