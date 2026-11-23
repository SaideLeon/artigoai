import { NextRequest, NextResponse } from "next/server";
import { requirePartnerAdmin } from "@/lib/partners-server";

export async function POST(req: NextRequest) {
  const auth = await requirePartnerAdmin();
  if (!auth.ok) {
    return NextResponse.json({ erro: auth.error }, { status: auth.status });
  }

  let body: { partnerId?: unknown } = {};
  try {
    body = (await req.json()) as { partnerId?: unknown };
  } catch {
    return NextResponse.json({ erro: "JSON inválido." }, { status: 400 });
  }

  if (
    typeof body.partnerId !== "string" ||
    !/^[0-9a-fA-F-]{36}$/.test(body.partnerId)
  ) {
    return NextResponse.json(
      { erro: "Selecione um parceiro válido para pagamento em lote." },
      { status: 400 }
    );
  }

  const nowIso = new Date().toISOString();
  const { data, error } = await auth.admin
    .from("commissions")
    .update({ status: "paga", paga_em: nowIso })
    .eq("partner_id", body.partnerId)
    .eq("status", "pendente")
    .select("id");

  if (error) {
    return NextResponse.json({ erro: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    updatedCount: data?.length ?? 0,
  });
}
