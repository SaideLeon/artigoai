import { NextRequest, NextResponse } from "next/server";
import {
  notifyPartnerWithdrawalPaid,
  notifyPartnerWithdrawalRefused,
} from "@/lib/partner-notifications";
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
      { erro: "Identificador de saque inválido." },
      { status: 400 }
    );
  }

  let body: {
    action?: unknown;
    comprovativoRef?: unknown;
    pagoEm?: unknown;
    motivoRecusa?: unknown;
  } = {};

  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ erro: "JSON inválido." }, { status: 400 });
  }

  const action =
    body.action === "em_analise" ||
    body.action === "pago" ||
    body.action === "recusado"
      ? body.action
      : null;

  if (!action) {
    return NextResponse.json(
      { erro: "Ação inválida. Use em_analise, pago ou recusado." },
      { status: 400 }
    );
  }

  const comprovativoRef =
    typeof body.comprovativoRef === "string"
      ? body.comprovativoRef.trim().slice(0, 300)
      : null;

  let pagoEmIso: string | null = null;
  if (typeof body.pagoEm === "string" && body.pagoEm.trim()) {
    const parsed = new Date(body.pagoEm.trim());
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json(
        { erro: "Data de pagamento inválida." },
        { status: 400 }
      );
    }
    pagoEmIso = parsed.toISOString();
  }

  const motivoRecusa =
    typeof body.motivoRecusa === "string"
      ? body.motivoRecusa.trim().slice(0, 500)
      : null;

  if (action === "recusado" && !motivoRecusa) {
    return NextResponse.json(
      { erro: "Informe o motivo da recusa do pedido de saque." },
      { status: 400 }
    );
  }

  const { data: rpcResult, error: rpcError } = await auth.admin.rpc(
    "admin_update_withdrawal_status",
    {
      p_withdrawal_id: id,
      p_action: action,
      p_admin_user_id: auth.user.id,
      p_admin_email: (auth.user.email ?? "").trim().toLowerCase(),
      p_comprovativo_ref: comprovativoRef,
      p_pago_em: pagoEmIso,
      p_motivo_recusa: motivoRecusa,
    }
  );

  if (rpcError) {
    return NextResponse.json(
      { erro: `Falha ao atualizar pedido de saque: ${rpcError.message}` },
      { status: 500 }
    );
  }

  if (!rpcResult?.ok) {
    const code = String(rpcResult?.code ?? "");
    const status = code === "not_found" ? 404 : code === "already_finalized" ? 409 : 400;
    return NextResponse.json(
      { erro: String(rpcResult?.error ?? "Não foi possível atualizar o saque.") },
      { status }
    );
  }

  const withdrawal = rpcResult.withdrawal as {
    id: string;
    partner_id: string;
    valor_centavos: number;
    comprovativo_ref?: string | null;
    pago_em?: string | null;
    motivo_recusa?: string | null;
  };

  if (action === "pago" || action === "recusado") {
    const { data: partner } = await auth.admin
      .from("partners")
      .select("user_id")
      .eq("id", withdrawal.partner_id)
      .maybeSingle();

    if (partner?.user_id) {
      const { data: prof } = await auth.admin
        .from("profiles")
        .select("email")
        .eq("id", partner.user_id)
        .maybeSingle();

      const partnerEmail = prof?.email ? String(prof.email) : "";
      if (partnerEmail) {
        if (action === "pago") {
          await notifyPartnerWithdrawalPaid({
            partnerEmail,
            valorCentavos: Number(withdrawal.valor_centavos),
            comprovativoRef: withdrawal.comprovativo_ref ?? comprovativoRef,
            pagoEmIso: String(
              withdrawal.pago_em ?? pagoEmIso ?? new Date().toISOString()
            ),
          });
        } else {
          await notifyPartnerWithdrawalRefused({
            partnerEmail,
            valorCentavos: Number(withdrawal.valor_centavos),
            motivo: String(withdrawal.motivo_recusa ?? motivoRecusa ?? ""),
          });
        }
      }
    }
  }

  return NextResponse.json({
    ok: true,
    withdrawal,
  });
}
