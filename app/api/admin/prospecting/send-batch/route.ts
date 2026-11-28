import { NextRequest, NextResponse } from "next/server";
import { sendProspectInviteLead } from "@/lib/admin-prospecting";
import { requireSupremeAdmin } from "@/lib/partners-server";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  const auth = await requireSupremeAdmin();
  if (!auth.ok) {
    return NextResponse.json({ erro: auth.error }, { status: auth.status });
  }

  let body: { leadIds?: unknown } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ erro: "Corpo JSON inválido." }, { status: 400 });
  }

  const rawIds = Array.isArray(body.leadIds) ? body.leadIds : [];
  const leadIds = Array.from(
    new Set(
      rawIds.filter(
        (id): id is string => typeof id === "string" && UUID_REGEX.test(id)
      )
    )
  ).slice(0, 15);

  if (leadIds.length === 0) {
    return NextResponse.json(
      { erro: "Selecione ao menos um lead válido para envio." },
      { status: 400 }
    );
  }

  const adminEmail = auth.user.email ?? "admin@artificializar.site";
  let sentCount = 0;
  let failedCount = 0;
  const updatedLeads = [];

  for (const leadId of leadIds) {
    const res = await sendProspectInviteLead(auth.admin, {
      leadId,
      adminEmail,
    });
    if (res.ok) {
      sentCount += 1;
      updatedLeads.push(res.lead);
    } else {
      failedCount += 1;
      if (res.lead) updatedLeads.push(res.lead);
    }
  }

  return NextResponse.json({
    ok: sentCount > 0,
    sentCount,
    failedCount,
    leads: updatedLeads,
  });
}
