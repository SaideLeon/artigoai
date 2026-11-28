import { NextRequest, NextResponse } from "next/server";
import { sendProspectInviteLead } from "@/lib/admin-prospecting";
import { requireSupremeAdmin } from "@/lib/partners-server";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireSupremeAdmin();
  if (!auth.ok) {
    return NextResponse.json({ erro: auth.error }, { status: auth.status });
  }

  const { id } = await context.params;
  if (!UUID_REGEX.test(id)) {
    return NextResponse.json({ erro: "ID inválido." }, { status: 400 });
  }

  const result = await sendProspectInviteLead(auth.admin, {
    leadId: id,
    adminEmail: auth.user.email ?? "admin@artificializar.site",
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        erro: result.error,
        ...(result.lead ? { lead: result.lead } : {}),
      },
      { status: result.status }
    );
  }

  return NextResponse.json({
    ok: true,
    lead: result.lead,
    threadId: result.threadId,
  });
}
