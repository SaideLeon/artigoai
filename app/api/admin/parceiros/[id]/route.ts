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
      { erro: "Identificador de parceiro inválido." },
      { status: 400 }
    );
  }

  let body: { percentualComissao?: unknown; ativo?: unknown } = {};
  try {
    body = (await req.json()) as {
      percentualComissao?: unknown;
      ativo?: unknown;
    };
  } catch {
    return NextResponse.json({ erro: "JSON inválido." }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};

  if (body.percentualComissao !== undefined) {
    const pct = Number(body.percentualComissao);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      return NextResponse.json(
        { erro: "Percentual de comissão deve estar entre 0 e 100." },
        { status: 400 }
      );
    }
    updates.percentual_comissao = Math.round(pct * 100) / 100;
  }

  if (body.ativo !== undefined) {
    if (typeof body.ativo !== "boolean") {
      return NextResponse.json(
        { erro: "Campo ativo deve ser booleano." },
        { status: 400 }
      );
    }
    updates.ativo = body.ativo;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { erro: "Nenhuma alteração válida enviada." },
      { status: 400 }
    );
  }

  const { data, error } = await auth.admin
    .from("partners")
    .update(updates)
    .eq("id", id)
    .select("id, codigo, percentual_comissao, ativo")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ erro: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json(
      { erro: "Parceiro não encontrado." },
      { status: 404 }
    );
  }

  return NextResponse.json({ partner: data });
}
