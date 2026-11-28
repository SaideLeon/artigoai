import { NextRequest, NextResponse } from "next/server";
import {
  DEFAULT_INVITE_VALIDITY_DAYS,
  DEFAULT_PARTNER_COMMISSION_PERCENT,
} from "@/lib/partners";
import {
  createPartnerInviteRecord,
  getPublicSiteOrigin,
  requirePartnerAdmin,
} from "@/lib/partners-server";

export async function GET() {
  const auth = await requirePartnerAdmin();
  if (!auth.ok) {
    return NextResponse.json({ erro: auth.error }, { status: auth.status });
  }

  // Atualiza convites pendentes expirados no banco antes de listar
  const nowIso = new Date().toISOString();
  await auth.admin
    .from("partner_invites")
    .update({ status: "expirado" })
    .eq("status", "pendente")
    .lt("expira_em", nowIso);

  const { data, error } = await auth.admin
    .from("partner_invites")
    .select(
      "id, nome_sugerido, percentual_comissao, expira_em, status, criado_em, aceito_em, aceito_por_user_id, criado_por_email"
    )
    .order("criado_em", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json(
      { erro: `Falha ao carregar convites: ${error.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ invites: data ?? [] });
}

export async function POST(req: NextRequest) {
  const auth = await requirePartnerAdmin();
  if (!auth.ok) {
    return NextResponse.json({ erro: auth.error }, { status: auth.status });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  const nomeSugerido =
    typeof body.nomeSugerido === "string"
      ? body.nomeSugerido.trim().slice(0, 100)
      : "";

  const rawPercent = Number(
    body.percentualComissao ?? DEFAULT_PARTNER_COMMISSION_PERCENT
  );
  const rawDays = Number(body.validadeDias ?? DEFAULT_INVITE_VALIDITY_DAYS);

  const created = await createPartnerInviteRecord(auth.admin, {
    origin: getPublicSiteOrigin(req.nextUrl.origin),
    adminEmail: auth.user.email ?? "",
    nomeSugerido,
    percentualComissao: rawPercent,
    validadeDias: rawDays,
  });

  if (!created.ok) {
    return NextResponse.json(
      { erro: created.error },
      { status: created.status }
    );
  }

  return NextResponse.json({
    invite: created.invite,
    inviteUrl: created.inviteUrl,
  });
}
