import { NextRequest, NextResponse } from "next/server";
import {
  getAdminEmailThreadDetail,
  getInboxCounts,
  type EmailFolder,
} from "@/lib/admin-inbox";
import { requireSupremeAdmin } from "@/lib/partners-server";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MUTABLE_FOLDERS = new Set<EmailFolder>(["inbox", "archived", "trash"]);

export async function GET(
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

  const peek = new URL(req.url).searchParams.get("peek") === "1";

  try {
    const detail = await getAdminEmailThreadDetail(auth.admin, id, {
      markRead: !peek,
    });
    if (!detail) {
      return NextResponse.json(
        { erro: "Conversa não encontrada." },
        { status: 404 }
      );
    }

    const counts = await getInboxCounts(auth.admin);
    return NextResponse.json({
      ok: true,
      thread: detail.thread,
      messages: detail.messages,
      counts,
    });
  } catch (err) {
    return NextResponse.json(
      {
        erro:
          err instanceof Error ? err.message : "Erro ao abrir conversa.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
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

  let body: {
    is_read?: unknown;
    is_starred?: unknown;
    folder?: unknown;
  } = {};

  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ erro: "Corpo JSON inválido." }, { status: 400 });
  }

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (typeof body.is_read === "boolean") {
    patch.is_read = body.is_read;
  }
  if (typeof body.is_starred === "boolean") {
    patch.is_starred = body.is_starred;
  }
  if (
    typeof body.folder === "string" &&
    MUTABLE_FOLDERS.has(body.folder as EmailFolder)
  ) {
    patch.folder = body.folder;
  }

  if (Object.keys(patch).length === 1) {
    return NextResponse.json(
      { erro: "Nenhuma alteração válida informada." },
      { status: 400 }
    );
  }

  const { data: updated, error } = await auth.admin
    .from("admin_email_threads")
    .update(patch)
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ erro: error.message }, { status: 500 });
  }
  if (!updated) {
    return NextResponse.json(
      { erro: "Conversa não encontrada." },
      { status: 404 }
    );
  }

  const counts = await getInboxCounts(auth.admin);
  return NextResponse.json({ ok: true, thread: updated, counts });
}

export async function DELETE(
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

  const { data: existing } = await auth.admin
    .from("admin_email_threads")
    .select("id, folder")
    .eq("id", id)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json(
      { erro: "Conversa não encontrada." },
      { status: 404 }
    );
  }

  if (existing.folder === "trash") {
    const { error: delErr } = await auth.admin
      .from("admin_email_threads")
      .delete()
      .eq("id", id);
    if (delErr) {
      return NextResponse.json({ erro: delErr.message }, { status: 500 });
    }
  } else {
    const { error: moveErr } = await auth.admin
      .from("admin_email_threads")
      .update({ folder: "trash", updated_at: new Date().toISOString() })
      .eq("id", id);
    if (moveErr) {
      return NextResponse.json({ erro: moveErr.message }, { status: 500 });
    }
  }

  const counts = await getInboxCounts(auth.admin);
  return NextResponse.json({ ok: true, counts });
}
