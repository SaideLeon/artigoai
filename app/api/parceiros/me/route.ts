import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/cakto-fulfillment";
import { maskEmail, roundCurrencyBrl } from "@/lib/partners";
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
    .select("id, user_id, codigo, percentual_comissao, ativo, codigo_personalizado, criado_em")
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
      .select(
        "id, user_id, plano, ciclo, valor_bruto, percentual_aplicado, valor_comissao, moeda, tipo, status, criado_em, paga_em"
      )
      .eq("partner_id", partner.id)
      .order("criado_em", { ascending: false })
      .limit(100),
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

  // Contagem real de assinantes ativos entre todos os indicados
  let assinantesAtivos = 0;
  for (const sub of subByUser.values()) {
    if (sub.plan !== "free" && sub.status === "active") {
      assinantesAtivos += 1;
    }
  }

  // Caso haja mais de 50 indicados, busca e-mails mascarados para comissões faltantes
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

  let comissoesPendentesBrl = 0;
  let comissoesPagasBrl = 0;
  let comissoesEstornadasBrl = 0;

  for (const c of commissionList) {
    const val = Number(c.valor_comissao ?? 0);
    if (c.status === "pendente") comissoesPendentesBrl += val;
    else if (c.status === "paga") comissoesPagasBrl += val;
    else if (c.status === "estornada") comissoesEstornadasBrl += val;
  }

  const origin = getPublicSiteOrigin(req.nextUrl.origin);

  return NextResponse.json({
    isPartner: true,
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
      comissoesPendentesBrl: roundCurrencyBrl(comissoesPendentesBrl),
      comissoesPagasBrl: roundCurrencyBrl(comissoesPagasBrl),
      comissoesEstornadasBrl: roundCurrencyBrl(comissoesEstornadasBrl),
      totalGanhoBrl: roundCurrencyBrl(comissoesPendentesBrl + comissoesPagasBrl),
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
    commissions: commissionList.slice(0, 40).map((c) => ({
      id: c.id,
      criadoEm: c.criado_em,
      pagaEm: c.paga_em,
      maskedEmail: maskEmail(emailByUser.get(String(c.user_id))),
      plano: c.plano,
      ciclo: c.ciclo,
      tipo: c.tipo,
      valorBruto: Number(c.valor_bruto),
      percentualAplicado: Number(c.percentual_aplicado),
      valorComissao: Number(c.valor_comissao),
      moeda: c.moeda,
      status: c.status,
    })),
  });
}
