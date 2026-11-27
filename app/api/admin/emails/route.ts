import { NextRequest, NextResponse } from "next/server";
import {
  listAdminEmailThreads,
  syncResendReceivingEmails,
  type EmailFolder,
} from "@/lib/admin-inbox";
import { getEmailServiceSummary } from "@/lib/email";
import { requireSupremeAdmin } from "@/lib/partners-server";

const ALLOWED_FOLDERS = new Set<EmailFolder>([
  "inbox",
  "sent",
  "starred",
  "archived",
  "trash",
]);

export async function GET(req: NextRequest) {
  const auth = await requireSupremeAdmin();
  if (!auth.ok) {
    return NextResponse.json(
      { erro: auth.error, ...(auth.diag ? { diag: auth.diag } : {}) },
      { status: auth.status }
    );
  }

  const { searchParams } = new URL(req.url);
  const rawFolder = (searchParams.get("folder") || "inbox").toLowerCase();
  const folder: EmailFolder = ALLOWED_FOLDERS.has(rawFolder as EmailFolder)
    ? (rawFolder as EmailFolder)
    : "inbox";
  const search = searchParams.get("search") || "";
  const unreadOnly = searchParams.get("unread") === "1";
  const shouldSync = searchParams.get("sync") === "1";

  let syncStats = null;
  if (shouldSync) {
    syncStats = await syncResendReceivingEmails(auth.admin);
  }

  try {
    const result = await listAdminEmailThreads(auth.admin, {
      folder,
      search,
      unreadOnly,
    });

    return NextResponse.json({
      ok: true,
      folder,
      threads: result.threads,
      counts: result.counts,
      migrationPending: result.migrationPending,
      emailService: getEmailServiceSummary(),
      ...(syncStats ? { syncStats } : {}),
    });
  } catch (err) {
    return NextResponse.json(
      {
        erro:
          err instanceof Error
            ? err.message
            : "Erro ao carregar caixa de e-mail.",
      },
      { status: 500 }
    );
  }
}
