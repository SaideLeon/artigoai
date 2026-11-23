import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/cakto-fulfillment";
import { validateCustomPartnerCode } from "@/lib/partners";
import {
  getAuthenticatedServerUser,
  getPublicSiteOrigin,
} from "@/lib/partners-server";

export async function PATCH(req: NextRequest) {
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

  let body: { codigo?: unknown } = {};
  try {
    body = (await req.json()) as { codigo?: unknown };
  } catch {
    return NextResponse.json({ erro: "JSON inválido." }, { status: 400 });
  }

  const validation = validateCustomPartnerCode(body.codigo);
  if (!validation.valid) {
    return NextResponse.json({ erro: validation.error }, { status: 400 });
  }

  const { data: partner, error: partnerErr } = await admin
    .from("partners")
    .select("id, codigo, codigo_personalizado, ativo")
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

  if (partner.codigo_personalizado) {
    return NextResponse.json(
      {
        erro: "Você já personalizou seu código uma vez. Essa alteração é única.",
      },
      { status: 409 }
    );
  }

  if (partner.codigo === validation.code) {
    return NextResponse.json(
      { erro: "Informe um código diferente do seu código atual." },
      { status: 400 }
    );
  }

  const { data: conflict } = await admin
    .from("partners")
    .select("id")
    .eq("codigo", validation.code)
    .maybeSingle();

  if (conflict) {
    return NextResponse.json(
      { erro: "Este código já está sendo usado por outro parceiro." },
      { status: 409 }
    );
  }

  const { data: updated, error: updateErr } = await admin
    .from("partners")
    .update({
      codigo: validation.code,
      codigo_personalizado: true,
    })
    .eq("id", partner.id)
    .eq("codigo_personalizado", false)
    .select("id, codigo, codigo_personalizado")
    .maybeSingle();

  if (updateErr) {
    if (updateErr.code === "23505") {
      return NextResponse.json(
        { erro: "Este código já está em uso por outro parceiro." },
        { status: 409 }
      );
    }
    return NextResponse.json({ erro: updateErr.message }, { status: 500 });
  }

  if (!updated) {
    return NextResponse.json(
      { erro: "Não foi possível personalizar o código." },
      { status: 409 }
    );
  }

  const origin = getPublicSiteOrigin(req.nextUrl.origin);

  return NextResponse.json({
    ok: true,
    codigo: updated.codigo,
    codigoPersonalizado: Boolean(updated.codigo_personalizado),
    referralUrl: `${origin}/?ref=${updated.codigo}`,
  });
}
