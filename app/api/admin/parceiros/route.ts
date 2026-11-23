import { NextRequest, NextResponse } from "next/server";
import { roundCurrencyBrl } from "@/lib/partners";
import { requirePartnerAdmin } from "@/lib/partners-server";

export async function GET(req: NextRequest) {
  const auth = await requirePartnerAdmin();
  if (!auth.ok) {
    return NextResponse.json({ erro: auth.error }, { status: auth.status });
  }

  const partnerIdFilter = req.nextUrl.searchParams.get("partnerId")?.trim();
  const statusFilter = req.nextUrl.searchParams.get("status")?.trim();

  // Atualiza convites expirados
  const nowIso = new Date().toISOString();
  await auth.admin
    .from("partner_invites")
    .update({ status: "expirado" })
    .eq("status", "pendente")
    .lt("expira_em", nowIso);

  let commissionsQuery = auth.admin
    .from("commissions")
    .select(
      "id, partner_id, user_id, id_da_transacao_cakto, plano, ciclo, valor_bruto, percentual_aplicado, valor_comissao, moeda, tipo, status, criado_em, paga_em"
    )
    .order("criado_em", { ascending: false })
    .limit(200);

  if (partnerIdFilter && /^[0-9a-fA-F-]{36}$/.test(partnerIdFilter)) {
    commissionsQuery = commissionsQuery.eq("partner_id", partnerIdFilter);
  }
  if (
    statusFilter &&
    (statusFilter === "pendente" ||
      statusFilter === "paga" ||
      statusFilter === "estornada")
  ) {
    commissionsQuery = commissionsQuery.eq("status", statusFilter);
  }

  const [
    { data: invites, error: invErr },
    { data: partners, error: partErr },
    { data: clickRows },
    { data: referredProfiles },
    { data: paidSubs },
    { data: allCommissions },
    { data: filteredCommissions, error: commErr },
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
    auth.admin
      .from("commissions")
      .select("partner_id, valor_comissao, status"),
    commissionsQuery,
  ]);

  if (invErr || partErr || commErr) {
    return NextResponse.json(
      {
        erro:
          invErr?.message ||
          partErr?.message ||
          commErr?.message ||
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

  const moneyByPartner = new Map<
    string,
    { pendente: number; paga: number; estornada: number }
  >();
  let totalPendenteBrl = 0;
  let totalPagaBrl = 0;

  for (const c of allCommissions ?? []) {
    const pid = String(c.partner_id);
    const cur = moneyByPartner.get(pid) ?? {
      pendente: 0,
      paga: 0,
      estornada: 0,
    };
    const val = Number(c.valor_comissao ?? 0);
    if (c.status === "pendente") {
      cur.pendente += val;
      totalPendenteBrl += val;
    } else if (c.status === "paga") {
      cur.paga += val;
      totalPagaBrl += val;
    } else if (c.status === "estornada") {
      cur.estornada += val;
    }
    moneyByPartner.set(pid, cur);
  }

  const partnerCodeMap = new Map<string, string>();
  const enrichedPartners = (partners ?? []).map((p) => {
    const pid = String(p.id);
    partnerCodeMap.set(pid, String(p.codigo));
    const prof = profileMap.get(String(p.user_id));
    const money = moneyByPartner.get(pid) ?? {
      pendente: 0,
      paga: 0,
      estornada: 0,
    };
    return {
      id: pid,
      userId: String(p.user_id),
      nome: prof?.full_name || "Parceiro Artigen",
      email: prof?.email || "",
      codigo: p.codigo,
      percentualComissao: Number(p.percentual_comissao),
      ativo: Boolean(p.ativo),
      codigoPersonalizado: Boolean(p.codigo_personalizado),
      criadoEm: p.criado_em,
      cliques: clicksByPartner.get(pid) ?? 0,
      cadastros: referralsByPartner.get(pid) ?? 0,
      assinantesAtivos: activeSubsByPartner.get(pid) ?? 0,
      pendenteBrl: roundCurrencyBrl(money.pendente),
      pagaBrl: roundCurrencyBrl(money.paga),
      estornadaBrl: roundCurrencyBrl(money.estornada),
    };
  });

  const enrichedCommissions = (filteredCommissions ?? []).map((c) => {
    const customerProf = profileMap.get(String(c.user_id));
    return {
      id: c.id,
      partnerId: c.partner_id,
      partnerCodigo: partnerCodeMap.get(String(c.partner_id)) ?? "—",
      userId: c.user_id,
      customerEmail: customerProf?.email || String(c.user_id),
      transacaoCakto: c.id_da_transacao_cakto,
      plano: c.plano,
      ciclo: c.ciclo,
      tipo: c.tipo,
      valorBruto: Number(c.valor_bruto),
      percentualAplicado: Number(c.percentual_aplicado),
      valorComissao: Number(c.valor_comissao),
      moeda: c.moeda,
      status: c.status,
      criadoEm: c.criado_em,
      pagaEm: c.paga_em,
    };
  });

  const totalCliques = Array.from(clicksByPartner.values()).reduce(
    (a, b) => a + b,
    0
  );

  return NextResponse.json({
    adminEmail: auth.user.email ?? "",
    summary: {
      totalParceiros: enrichedPartners.length,
      parceirosAtivos: enrichedPartners.filter((p) => p.ativo).length,
      totalCliques,
      totalCadastros: (referredProfiles ?? []).length,
      totalPendenteBrl: roundCurrencyBrl(totalPendenteBrl),
      totalPagaBrl: roundCurrencyBrl(totalPagaBrl),
    },
    invites: invites ?? [],
    partners: enrichedPartners,
    commissions: enrichedCommissions,
  });
}
