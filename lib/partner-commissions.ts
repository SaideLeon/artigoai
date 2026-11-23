import type { SupabaseClient } from "@supabase/supabase-js";
import {
  BASE_DE_CALCULO,
  COMISSAO_MAX_MESES,
  COMISSAO_RECORRENTE,
  roundCurrencyBrl,
  type CommissionType,
} from "@/lib/partners";
import type { BillingCycle } from "@/lib/pricing";

export async function recordPartnerCommissionForPayment(params: {
  admin: SupabaseClient;
  userId: string;
  planId: string;
  billingCycle: BillingCycle;
  amountCents: number;
  transactionId: string | null;
  eventType?: string;
}): Promise<{
  recorded: boolean;
  alreadyExists?: boolean;
  commissionId?: string;
  reason?: string;
}> {
  const { admin, userId, planId, billingCycle, amountCents, eventType } =
    params;
  const cleanTxId = params.transactionId?.trim();
  if (!cleanTxId || amountCents <= 0) {
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

  const baseValueBrl =
    BASE_DE_CALCULO === "valor_bruto"
      ? roundCurrencyBrl(amountCents / 100)
      : roundCurrencyBrl(amountCents / 100);

  const percentual = Number(partner.percentual_comissao);
  const valorComissao = roundCurrencyBrl(baseValueBrl * (percentual / 100));

  const { data: inserted, error: insertErr } = await admin
    .from("commissions")
    .insert({
      partner_id: partner.id,
      user_id: userId,
      id_da_transacao_cakto: cleanTxId,
      plano: planId,
      ciclo: billingCycle,
      valor_bruto: baseValueBrl,
      percentual_aplicado: percentual,
      valor_comissao: valorComissao,
      moeda: "BRL",
      tipo,
      status: "pendente",
    })
    .select("id")
    .single();

  if (insertErr) {
    if (insertErr.code === "23505") {
      return { recorded: false, alreadyExists: true };
    }
    console.error("Erro ao registrar comissão de parceiro:", insertErr.message);
    return { recorded: false, reason: insertErr.message };
  }

  return {
    recorded: true,
    commissionId: inserted?.id,
  };
}

export async function reversePartnerCommissionForTransaction(params: {
  admin: SupabaseClient;
  transactionCandidates: string[];
  userId?: string | null;
}): Promise<number> {
  const { admin, userId } = params;
  const candidates = Array.from(
    new Set(
      params.transactionCandidates.map((c) => c.trim()).filter(Boolean)
    )
  );

  if (candidates.length > 0) {
    const { data, error } = await admin
      .from("commissions")
      .update({ status: "estornada" })
      .in("id_da_transacao_cakto", candidates)
      .neq("status", "estornada")
      .select("id");

    if (!error && data && data.length > 0) {
      return data.length;
    }
  }

  // Fallback seguro caso o webhook de estorno não traga o id original da transação
  if (userId && candidates.length === 0) {
    const { data: latest } = await admin
      .from("commissions")
      .select("id")
      .eq("user_id", userId)
      .neq("status", "estornada")
      .order("criado_em", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latest?.id) {
      const { error } = await admin
        .from("commissions")
        .update({ status: "estornada" })
        .eq("id", latest.id);
      if (!error) return 1;
    }
  }

  return 0;
}
