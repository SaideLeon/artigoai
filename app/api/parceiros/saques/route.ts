import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/cakto-fulfillment";
import {
  SAQUE_MINIMO_CENTAVOS,
  validateWithdrawalPayload,
} from "@/lib/partners";
import {
  notifyAdminWithdrawalRequested,
  notifyPartnerWithdrawalRequested,
} from "@/lib/partner-notifications";
import { getAuthenticatedServerUser } from "@/lib/partners-server";

export async function GET() {
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

  const { data: partner } = await admin
    .from("partners")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!partner) {
    return NextResponse.json(
      { erro: "Perfil de parceiro não encontrado." },
      { status: 404 }
    );
  }

  const { data, error } = await admin
    .from("withdrawal_requests")
    .select("*")
    .eq("partner_id", partner.id)
    .order("solicitado_em", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ erro: error.message }, { status: 500 });
  }

  return NextResponse.json({ withdrawals: data ?? [] });
}

export async function POST(req: NextRequest) {
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

  let body: {
    metodo?: unknown;
    pixTipoChave?: unknown;
    dadosPagamento?: unknown;
    valorCentavos?: unknown;
  } = {};

  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ erro: "JSON inválido." }, { status: 400 });
  }

  const validation = validateWithdrawalPayload(body);
  if (!validation.ok) {
    return NextResponse.json({ erro: validation.error }, { status: 400 });
  }

  const { data: partner, error: partnerErr } = await admin
    .from("partners")
    .select("id, codigo, ativo")
    .eq("user_id", user.id)
    .maybeSingle();

  if (partnerErr) {
    return NextResponse.json({ erro: partnerErr.message }, { status: 500 });
  }

  if (!partner) {
    return NextResponse.json(
      { erro: "Perfil de parceiro não encontrado." },
      { status: 404 }
    );
  }

  const { data: rpcResult, error: rpcError } = await admin.rpc(
    "create_partner_withdrawal",
    {
      p_partner_id: partner.id,
      p_actor_user_id: user.id,
      p_actor_email: (user.email ?? "").trim().toLowerCase(),
      p_requested_cents: validation.requestedCents ?? 0,
      p_min_saque_cents: SAQUE_MINIMO_CENTAVOS,
      p_metodo: validation.metodo,
      p_pix_tipo_chave: validation.pixTipoChave,
      p_dados_pagamento: validation.dadosPagamento,
    }
  );

  if (rpcError) {
    return NextResponse.json(
      { erro: `Falha ao registrar pedido de saque: ${rpcError.message}` },
      { status: 500 }
    );
  }

  if (!rpcResult?.ok) {
    const code = String(rpcResult?.code ?? "");
    const status =
      code === "open_exists"
        ? 409
        : code === "inactive"
        ? 403
        : code === "not_found"
        ? 404
        : 400;
    return NextResponse.json(
      { erro: String(rpcResult?.error ?? "Não foi possível criar o saque.") },
      { status }
    );
  }

  const withdrawal = rpcResult.withdrawal as {
    id: string;
    valor_centavos: number;
    metodo: string;
    dados_pagamento: string;
  };

  const { data: prof } = await admin
    .from("profiles")
    .select("email, full_name")
    .eq("id", user.id)
    .maybeSingle();

  const partnerEmail = String(prof?.email ?? user.email ?? "");
  const partnerName = String(prof?.full_name ?? "Parceiro Artigen");

  await Promise.allSettled([
    partnerEmail
      ? notifyPartnerWithdrawalRequested({
          partnerEmail,
          valorCentavos: Number(withdrawal.valor_centavos),
          metodo: validation.metodo,
        })
      : Promise.resolve(),
    notifyAdminWithdrawalRequested({
      partnerName,
      partnerEmail,
      partnerCode: String(partner.codigo),
      valorCentavos: Number(withdrawal.valor_centavos),
      metodo: validation.metodo,
      dadosPagamento: validation.dadosPagamento,
    }),
  ]);

  return NextResponse.json(
    {
      ok: true,
      withdrawal,
      movedCommissions: Number(rpcResult.movedCommissions ?? 0),
    },
    { status: 201 }
  );
}
