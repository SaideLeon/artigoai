import { NextRequest, NextResponse } from "next/server";
import {
  centsToBrlNumber,
  escapeCsvCell,
  type CommissionStatus,
} from "@/lib/partners";
import { requirePartnerAdmin } from "@/lib/partners-server";

const ALLOWED_STATUSES = new Set<CommissionStatus>([
  "pendente",
  "disponivel",
  "em_saque",
  "paga",
  "estornada",
]);

export async function GET(req: NextRequest) {
  const auth = await requirePartnerAdmin();
  if (!auth.ok) {
    return NextResponse.json({ erro: auth.error }, { status: auth.status });
  }

  const partnerIdFilter = req.nextUrl.searchParams.get("partnerId")?.trim();
  const statusFilter = req.nextUrl.searchParams.get("status")?.trim();

  let query = auth.admin
    .from("commissions")
    .select("*")
    .order("criado_em", { ascending: false })
    .limit(5000);

  if (partnerIdFilter && /^[0-9a-fA-F-]{36}$/.test(partnerIdFilter)) {
    query = query.eq("partner_id", partnerIdFilter);
  }
  if (
    statusFilter &&
    ALLOWED_STATUSES.has(statusFilter as CommissionStatus)
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

  const userIds = Array.from(
    new Set([
      ...(partners ?? []).map((p) => String(p.user_id)),
      ...(rows ?? []).map((r) => String(r.user_id)),
    ])
  );

  const emailByUserId = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: profiles } = await auth.admin
      .from("profiles")
      .select("id, email")
      .in("id", userIds);
    for (const p of profiles ?? []) {
      emailByUserId.set(String(p.id), String(p.email ?? ""));
    }
  }

  const partnerMap = new Map<string, { codigo: string; email: string }>();
  for (const p of partners ?? []) {
    partnerMap.set(String(p.id), {
      codigo: String(p.codigo),
      email: emailByUserId.get(String(p.user_id)) ?? "",
    });
  }

  const header = [
    "id_comissao",
    "codigo_parceiro",
    "email_parceiro",
    "email_indicado",
    "id_transacao_cakto",
    "plano",
    "ciclo",
    "tipo",
    "base_calculo",
    "valor_base_brl",
    "percentual_comissao",
    "valor_comissao_brl",
    "moeda",
    "status",
    "criado_em",
    "disponivel_em",
    "paga_em",
    "estornada_em",
  ];

  const csvLines = [header.join(",")];
  for (const r of rows ?? []) {
    const partner = partnerMap.get(String(r.partner_id));
    const baseBrl =
      typeof r.valor_base_centavos === "number"
        ? centsToBrlNumber(r.valor_base_centavos)
        : Number(r.valor_bruto ?? 0);
    const commBrl =
      typeof r.valor_comissao_centavos === "number"
        ? centsToBrlNumber(r.valor_comissao_centavos)
        : Number(r.valor_comissao ?? 0);

    const line = [
      r.id,
      partner?.codigo ?? "",
      partner?.email ?? "",
      emailByUserId.get(String(r.user_id)) ?? r.user_id,
      r.id_da_transacao_cakto,
      r.plano,
      r.ciclo,
      r.tipo,
      r.base_calculo ?? "valor_bruto",
      baseBrl.toFixed(2),
      Number(r.percentual_aplicado).toFixed(2),
      commBrl.toFixed(2),
      r.moeda,
      r.status,
      r.criado_em,
      r.disponivel_em ?? "",
      r.paga_em ?? "",
      r.estornada_em ?? "",
    ].map(escapeCsvCell);

    csvLines.push(line.join(","));
  }

  const csvBody = `\uFEFF${csvLines.join("\r\n")}`;
  const dateStamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(csvBody, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="comissoes-artigen-${dateStamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
