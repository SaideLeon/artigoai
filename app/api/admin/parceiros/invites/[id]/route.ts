import { NextRequest, NextResponse } from "next/server";
import { requirePartnerAdmin } from "@/lib/partners-server";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requirePartnerAdmin();
  if (!auth.ok) {
    return NextResponse.json({ erro: auth.error }, { status: auth.status });
  }

  const { id } = await context.params;
  if (!/^[0-9a-fA-F-]{36}$/.test(id)) {
    return NextResponse.json(
      { erro: "Identificador de convite inválido." },
      { status: 400 }
    );
  }

  let body: { action?: unknown } = {};
  try {
    body = (await req.json()) as { action?: unknown };
  } catch {
    body = {};
  }

  if (body.action !== "cancel") {
    return NextResponse.json(
      { erro: "Ação não suportada para convite." },
      { status: 400 }
    );
  }

  const { data, error } = await auth.admin
    .from("partner_invites")
    .update({ status: "cancelado" })
    .eq("id", id)
    .eq("status", "pendente")
    .select(
      "id, nome_sugerido, percentual_comissao, expira_em, status, criado_em, aceito_em, aceito_por_user_id"
    )
    .maybeSingle();

  if (error) {
    return NextResponse.json({ erro: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json(
      { erro: "Apenas convites pendentes podem ser cancelados." },
      { status: 409 }
    );
  }

  return NextResponse.json({ invite: data });
}
