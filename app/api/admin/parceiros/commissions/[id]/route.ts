import { NextRequest, NextResponse } from "next/server";
import type { CommissionStatus } from "@/lib/partners";
import { requirePartnerAdmin } from "@/lib/partners-server";

const ALLOWED_STATUSES = new Set<CommissionStatus>([
  "pendente",
  "disponivel",
  "em_saque",
  "paga",
  "estornada",
]);

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

  let body: { status?: unknown; motivo?: unknown } = {};
  try {
    body = (await req.json()) as { status?: unknown; motivo?: unknown };
  } catch {
    return NextResponse.json({ erro: "JSON inválido." }, { status: 400 });
  }

  const nextStatus =
    typeof body.status === "string" &&
    ALLOWED_STATUSES.has(body.status as CommissionStatus)
      ? (body.status as CommissionStatus)
      : null;

  if (!nextStatus) {
    return NextResponse.json(
      {
        erro: "Status inválido. Use pendente, disponivel, em_saque, paga ou estornada.",
      },
      { status: 400 }
    );
  }

  const motivo =
    typeof body.motivo === "string" && body.motivo.trim()
      ? body.motivo.trim().slice(0, 300)
      : "Alteração administrativa manual.";

  if (nextStatus === "estornada") {
    const { data: rpcRes, error: rpcErr } = await auth.admin.rpc(
      "reverse_partner_commission",
      {
        p_commission_id: id,
        p_actor_type: "admin",
        p_actor_email: (auth.user.email ?? "").trim().toLowerCase(),
        p_motivo: motivo,
      }
    );

    if (rpcErr) {
      return NextResponse.json({ erro: rpcErr.message }, { status: 500 });
    }
    if (!rpcRes?.ok) {
      return NextResponse.json(
        { erro: String(rpcRes?.error ?? "Comissão não encontrada.") },
        { status: 404 }
      );
    }

    const { data: updated } = await auth.admin
      .from("commissions")
      .select("id, status, paga_em, estornada_em")
      .eq("id", id)
      .maybeSingle();

    return NextResponse.json({ commission: updated });
  }

  const { data: current } = await auth.admin
    .from("commissions")
    .select("id, partner_id, status, paga_em")
    .eq("id", id)
    .maybeSingle();

  if (!current) {
    return NextResponse.json(
      { erro: "Comissão não encontrada." },
      { status: 404 }
    );
  }

  const pagaEm = nextStatus === "paga" ? new Date().toISOString() : null;

  const { data, error } = await auth.admin
    .from("commissions")
    .update({
      status: nextStatus,
      paga_em: pagaEm,
    })
    .eq("id", id)
    .select("id, status, paga_em")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ erro: error.message }, { status: 500 });
  }

  await auth.admin.from("partner_audit_logs").insert({
    entidade: "commission",
    entidade_id: id,
    partner_id: current.partner_id,
    actor_type: "admin",
    actor_id: auth.user.id,
    actor_email: (auth.user.email ?? "").trim().toLowerCase(),
    acao: `status_${nextStatus}`,
    estado_anterior: { status: current.status, paga_em: current.paga_em },
    estado_novo: { status: nextStatus, paga_em: pagaEm },
    motivo,
  });

  return NextResponse.json({ commission: data });
}
