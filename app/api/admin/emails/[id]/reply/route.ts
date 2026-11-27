import { NextRequest, NextResponse } from "next/server";
import { getInboxCounts, replyToAdminEmailThread } from "@/lib/admin-inbox";
import { requireSupremeAdmin } from "@/lib/partners-server";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  req: NextRequest,
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

  let body: { bodyText?: unknown; subject?: unknown } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ erro: "Corpo JSON inválido." }, { status: 400 });
  }

  const bodyText =
    typeof body.bodyText === "string" ? body.bodyText.trim() : "";
  if (bodyText.length < 2 || bodyText.length > 20000) {
    return NextResponse.json(
      { erro: "Escreva uma resposta entre 2 e 20.000 caracteres." },
      { status: 400 }
    );
  }

  const subjectOverride =
    typeof body.subject === "string" ? body.subject.trim() : undefined;

  const result = await replyToAdminEmailThread(auth.admin, {
    threadId: id,
    bodyText,
    subjectOverride,
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
    message: result.message,
    thread: result.thread,
    resendId: result.resendId,
    counts,
  });
}
