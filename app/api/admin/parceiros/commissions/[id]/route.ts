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
      { erro: "Identificador de comissão inválido." },
      { status: 400 }
    );
  }

  let body: { status?: unknown } = {};
  try {
    body = (await req.json()) as { status?: unknown };
  } catch {
    return NextResponse.json({ erro: "JSON inválido." }, { status: 400 });
  }

  if (
    body.status !== "pendente" &&
    body.status !== "paga" &&
    body.status !== "estornada"
  ) {
    return NextResponse.json(
      { erro: "Status inválido. Use pendente, paga ou estornada." },
      { status: 400 }
    );
  }

  const pagaEm = body.status === "paga" ? new Date().toISOString() : null;

  const { data, error } = await auth.admin
    .from("commissions")
    .update({
      status: body.status,
      paga_em: pagaEm,
    })
    .eq("id", id)
    .select("id, status, paga_em")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ erro: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json(
      { erro: "Comissão não encontrada." },
      { status: 404 }
    );
  }

  return NextResponse.json({ commission: data });
}
