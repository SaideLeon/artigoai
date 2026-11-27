import { NextRequest, NextResponse } from "next/server";
import { composeAdminEmail, getInboxCounts } from "@/lib/admin-inbox";
import { requireSupremeAdmin } from "@/lib/partners-server";

export async function POST(req: NextRequest) {
  const auth = await requireSupremeAdmin();
  if (!auth.ok) {
    return NextResponse.json({ erro: auth.error }, { status: auth.status });
  }

  let body: {
    toEmail?: unknown;
    toName?: unknown;
    subject?: unknown;
    bodyText?: unknown;
  } = {};

  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ erro: "Corpo JSON inválido." }, { status: 400 });
  }

  const toEmail = typeof body.toEmail === "string" ? body.toEmail.trim() : "";
  const toName = typeof body.toName === "string" ? body.toName.trim() : "";
  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const bodyText =
    typeof body.bodyText === "string" ? body.bodyText.trim() : "";

  if (!toEmail || !subject || bodyText.length < 2) {
    return NextResponse.json(
      { erro: "Preencha destinatário, assunto e mensagem." },
      { status: 400 }
    );
  }

  const result = await composeAdminEmail(auth.admin, {
    toEmail,
    toName,
    subject,
    bodyText,
    adminEmail: auth.user.email ?? "admin@artificializar.site",
  });

  if (!result.ok) {
    return NextResponse.json(
      { erro: result.error },
      { status: result.status }
    );
  }

  const counts = await getInboxCounts(auth.admin);
  return NextResponse.json({
    ok: true,
    thread: result.thread,
    message: result.message,
    resendId: result.resendId,
    counts,
  });
}
