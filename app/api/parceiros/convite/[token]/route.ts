import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/cakto-fulfillment";
import {
  hashInviteToken,
  isValidInviteTokenFormat,
  PLAN_COMMISSION_RATES,
} from "@/lib/partners";
import { getAuthenticatedServerUser } from "@/lib/partners-server";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;
  if (!isValidInviteTokenFormat(token)) {
    return NextResponse.json(
      { erro: "Link de convite inválido." },
      { status: 400 }
    );
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json(
      { erro: "Serviço de banco indisponível." },
      { status: 503 }
    );
  }

  const tokenHash = hashInviteToken(token);
  const { data: invite, error } = await admin
    .from("partner_invites")
    .select("id, nome_sugerido, percentual_comissao, expira_em, status")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ erro: error.message }, { status: 500 });
  }

  if (!invite) {
    return NextResponse.json(
      { erro: "Convite não encontrado." },
      { status: 404 }
    );
  }

  let effectiveStatus = invite.status as string;
  if (
    effectiveStatus === "pendente" &&
    new Date(invite.expira_em).getTime() <= Date.now()
  ) {
    effectiveStatus = "expirado";
    await admin
      .from("partner_invites")
      .update({ status: "expirado" })
      .eq("id", invite.id)
      .eq("status", "pendente");
  }

  const currentUser = await getAuthenticatedServerUser();
  let alreadyPartner = false;
  let existingPartnerCode: string | null = null;
  if (currentUser) {
    const { data: partner } = await admin
      .from("partners")
      .select("codigo")
      .eq("user_id", currentUser.id)
      .maybeSingle();
    if (partner) {
      alreadyPartner = true;
      existingPartnerCode = partner.codigo;
    }
  }

  return NextResponse.json({
    status: effectiveStatus,
    nomeSugerido: invite.nome_sugerido || "",
    percentualComissao: Number(invite.percentual_comissao),
    expiraEm: invite.expira_em,
    alreadyPartner,
    existingPartnerCode,
    planCommissionRates: PLAN_COMMISSION_RATES,
  });
}
