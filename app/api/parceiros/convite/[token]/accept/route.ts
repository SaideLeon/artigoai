import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/cakto-fulfillment";
import { hashInviteToken, isValidInviteTokenFormat } from "@/lib/partners";
import {
  generateUniquePartnerCode,
  getAuthenticatedServerUser,
} from "@/lib/partners-server";
import { notifyPartnerWelcome } from "@/lib/email";

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  const user = await getAuthenticatedServerUser();
  if (!user) {
    return NextResponse.json(
      { erro: "Faça login ou crie sua conta antes de aceitar o convite." },
      { status: 401 }
    );
  }

  const { token } = await context.params;
  if (!isValidInviteTokenFormat(token)) {
    return NextResponse.json(
      { erro: "Token de convite inválido." },
      { status: 400 }
    );
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json(
      { erro: "Supabase service_role não configurado no servidor." },
      { status: 503 }
    );
  }

  // Impede duplicação de perfil de parceiro antes de consumir o convite
  const { data: existingPartner } = await admin
    .from("partners")
    .select("id, codigo")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingPartner) {
    return NextResponse.json(
      {
        erro: "Sua conta já possui um perfil de parceiro cadastrado.",
        existingCode: existingPartner.codigo,
      },
      { status: 409 }
    );
  }

  const tokenHash = hashInviteToken(token);
  const { data: invite, error: fetchErr } = await admin
    .from("partner_invites")
    .select("id, nome_sugerido, percentual_comissao, expira_em, status")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (fetchErr) {
    return NextResponse.json({ erro: fetchErr.message }, { status: 500 });
  }

  if (!invite) {
    return NextResponse.json(
      { erro: "Convite não encontrado." },
      { status: 404 }
    );
  }

  if (invite.status !== "pendente") {
    return NextResponse.json(
      { erro: "Este convite já foi utilizado, expirado ou cancelado." },
      { status: 409 }
    );
  }

  if (new Date(invite.expira_em).getTime() <= Date.now()) {
    await admin
      .from("partner_invites")
      .update({ status: "expirado" })
      .eq("id", invite.id)
      .eq("status", "pendente");

    return NextResponse.json(
      { erro: "Este convite expirou. Peça um novo link ao administrador." },
      { status: 410 }
    );
  }

  const nowIso = new Date().toISOString();

  // Trava atómica para impedir dupla aceitação simultânea do mesmo token
  const { data: claimedInvite, error: claimErr } = await admin
    .from("partner_invites")
    .update({
      status: "aceito",
      aceito_em: nowIso,
      aceito_por_user_id: user.id,
    })
    .eq("id", invite.id)
    .eq("status", "pendente")
    .gt("expira_em", nowIso)
    .select("id, nome_sugerido, percentual_comissao")
    .maybeSingle();

  if (claimErr || !claimedInvite) {
    return NextResponse.json(
      { erro: "Este convite não está mais disponível para aceite." },
      { status: 409 }
    );
  }

  const seed =
    claimedInvite.nome_sugerido ||
    (user.user_metadata?.full_name as string | undefined) ||
    (user.user_metadata?.name as string | undefined) ||
    user.email ||
    "parceiro";

  const generatedCode = await generateUniquePartnerCode(admin, seed);

  const { data: createdPartner, error: partnerErr } = await admin
    .from("partners")
    .insert({
      user_id: user.id,
      codigo: generatedCode,
      percentual_comissao: Number(claimedInvite.percentual_comissao),
      ativo: true,
      codigo_personalizado: false,
    })
    .select("id, codigo, percentual_comissao, ativo, codigo_personalizado, criado_em")
    .single();

  if (partnerErr || !createdPartner) {
    // Reverte convite caso a criação do perfil de parceiro falhe
    await admin
      .from("partner_invites")
      .update({
        status: "pendente",
        aceito_em: null,
        aceito_por_user_id: null,
      })
      .eq("id", invite.id);

    return NextResponse.json(
      {
        erro:
          partnerErr?.message ||
          "Não foi possível criar seu perfil de parceiro.",
      },
      { status: 500 }
    );
  }

  if (user.email) {
    try {
      await notifyPartnerWelcome({
        partnerEmail: user.email,
        partnerName:
          (user.user_metadata?.full_name as string | undefined) ||
          (user.user_metadata?.name as string | undefined),
        partnerCode: String(createdPartner.codigo),
      });
    } catch {
      // Falha de e-mail não bloqueia aceite do convite
    }
  }

  return NextResponse.json({
    ok: true,
    partner: createdPartner,
  });
}
