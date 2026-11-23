import { NextRequest, NextResponse } from "next/server";
import {
  centsToBrlNumber,
  escapeCsvCell,
  type WithdrawalStatus,
} from "@/lib/partners";
import { requirePartnerAdmin } from "@/lib/partners-server";

const VALID_WD_STATUSES = new Set<WithdrawalStatus>([
  "solicitado",
  "em_analise",
  "pago",
  "recusado",
]);

export async function GET(req: NextRequest) {
  const auth = await requirePartnerAdmin();
  if (!auth.ok) {
    return NextResponse.json({ erro: auth.error }, { status: auth.status });
  }

  const partnerIdFilter = req.nextUrl.searchParams.get("partnerId")?.trim();
  const statusFilter = req.nextUrl.searchParams.get("withdrawalStatus")?.trim();

  let query = auth.admin
    .from("withdrawal_requests")
    .select("*")
    .order("solicitado_em", { ascending: false })
    .limit(5000);

  if (partnerIdFilter && /^[0-9a-fA-F-]{36}$/.test(partnerIdFilter)) {
    query = query.eq("partner_id", partnerIdFilter);
  }
  if (
    statusFilter &&
    VALID_WD_STATUSES.has(statusFilter as WithdrawalStatus)
  ) {
    query = query.eq("status", statusFilter);
  }

  const [{ data: rows, error }, { data: partners }] = await Promise.all([
    query,
    auth.admin.from("partners").select("id, codigo, user_id"),
  ]);

  if (error) {
    return NextResponse.json({ erro: error.message }, { status: 500 });
  }

  const partnerUserIds = (partners ?? []).map((p) => String(p.user_id));
  const emailByUser = new Map<string, string>();
  if (partnerUserIds.length > 0) {
    const { data: profiles } = await auth.admin
      .from("profiles")
      .select("id, email")
      .in("id", partnerUserIds);
    for (const p of profiles ?? []) {
      emailByUser.set(String(p.id), String(p.email ?? ""));
    }
  }

  const partnerMap = new Map<string, { codigo: string; email: string }>();
  for (const p of partners ?? []) {
    partnerMap.set(String(p.id), {
      codigo: String(p.codigo),
      email: emailByUser.get(String(p.user_id)) ?? "",
    });
  }

  const header = [
    "id_saque",
    "codigo_parceiro",
    "email_parceiro",
    "valor_solicitado_brl",
    "saldo_no_momento_brl",
    "metodo",
    "pix_tipo_chave",
    "dados_pagamento",
    "status",
    "comprovativo_ref",
    "motivo_recusa",
    "solicitado_em",
    "pago_em",
    "recusado_em",
  ];

  const csvLines = [header.join(",")];
  for (const r of rows ?? []) {
    const partner = partnerMap.get(String(r.partner_id));
    const line = [
      r.id,
      partner?.codigo ?? "",
      partner?.email ?? "",
      centsToBrlNumber(Number(r.valor_centavos ?? 0)).toFixed(2),
      centsToBrlNumber(Number(r.saldo_no_momento_centavos ?? 0)).toFixed(2),
      r.metodo,
      r.pix_tipo_chave ?? "",
      r.dados_pagamento,
      r.status,
      r.comprovativo_ref ?? "",
      r.motivo_recusa ?? "",
      r.solicitado_em,
      r.pago_em ?? "",
      r.recusado_em ?? "",
    ].map(escapeCsvCell);

    csvLines.push(line.join(","));
  }

  const csvBody = `\uFEFF${csvLines.join("\r\n")}`;
  const dateStamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(csvBody, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="saques-parceiros-${dateStamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
