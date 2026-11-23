import { NextRequest, NextResponse } from "next/server";
import {
  DEFAULT_INVITE_VALIDITY_DAYS,
  DEFAULT_PARTNER_COMMISSION_PERCENT,
  generateInviteToken,
  hashInviteToken,
} from "@/lib/partners";
import {
  getPublicSiteOrigin,
  requirePartnerAdmin,
  type PartnerInviteRow,
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
  if (!Number.isFinite(rawPercent) || rawPercent < 0 || rawPercent > 100) {
    return NextResponse.json(
      { erro: "Percentual de comissão inválido (0 a 100%)." },
      { status: 400 }
    );
  }
  const percentualComissao = Math.round(rawPercent * 100) / 100;

  const rawDays = Number(body.validadeDias ?? DEFAULT_INVITE_VALIDITY_DAYS);
  const validadeDias =
    Number.isFinite(rawDays) && rawDays >= 1 && rawDays <= 365
      ? Math.round(rawDays)
      : DEFAULT_INVITE_VALIDITY_DAYS;

  const rawToken = generateInviteToken();
  const tokenHash = hashInviteToken(rawToken);
  const expiraEm = new Date(
    Date.now() + validadeDias * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data, error } = await auth.admin
    .from("partner_invites")
    .insert({
      token_hash: tokenHash,
      nome_sugerido: nomeSugerido,
      percentual_comissao: percentualComissao,
      expira_em: expiraEm,
      status: "pendente",
      criado_por_email: (auth.user.email ?? "").trim().toLowerCase(),
    })
    .select(
      "id, nome_sugerido, percentual_comissao, expira_em, status, criado_em, aceito_em, aceito_por_user_id, criado_por_email"
    )
    .single<Omit<PartnerInviteRow, "token_hash">>();

  if (error || !data) {
    return NextResponse.json(
      { erro: error?.message || "Falha ao criar convite de parceiro." },
      { status: 500 }
    );
  }

  const origin = getPublicSiteOrigin(req.nextUrl.origin);
  const inviteUrl = `${origin}/parceiro/convite/${rawToken}`;

  return NextResponse.json({
    invite: data,
    inviteUrl,
  });
}
