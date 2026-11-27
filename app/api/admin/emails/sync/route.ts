import { NextResponse } from "next/server";
import {
  getInboxCounts,
  syncResendReceivingEmails,
} from "@/lib/admin-inbox";
import { requireSupremeAdmin } from "@/lib/partners-server";

export async function POST() {
  const auth = await requireSupremeAdmin();
  if (!auth.ok) {
    return NextResponse.json({ erro: auth.error }, { status: auth.status });
  }

  const syncStats = await syncResendReceivingEmails(auth.admin);
  let counts = null;
  try {
    counts = await getInboxCounts(auth.admin);
  } catch {
    counts = null;
  }

  return NextResponse.json({
    ok: true,
    syncStats,
    ...(counts ? { counts } : {}),
  });
}
