import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/cakto-fulfillment";
import { getAdminInboxSummary, syncResendReceivingEmails } from "@/lib/admin-inbox";
import { getAuthenticatedServerContext, isUserSuperAdmin } from "@/lib/partners-server";

export async function GET() {
  const ctx = await getAuthenticatedServerContext();
  if (!ctx) {
    return NextResponse.json({
      isAdmin: false,
      unreadInboxCount: 0,
      recentUnread: [],
    });
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({
      isAdmin: false,
      unreadInboxCount: 0,
      recentUnread: [],
    });
  }

  const isAdmin = await isUserSuperAdmin(admin, ctx.user, ctx.supabase);
  if (!isAdmin) {
    return NextResponse.json({
      isAdmin: false,
      unreadInboxCount: 0,
      recentUnread: [],
    });
  }

  try {
    await syncResendReceivingEmails(admin).catch(() => null);
    const summary = await getAdminInboxSummary(admin);
    return NextResponse.json({
      isAdmin: true,
      adminEmail: ctx.user.email ?? null,
      unreadInboxCount: summary.unreadCount,
      inboxCount: summary.inboxCount,
      recentUnread: summary.recentUnread,
      migrationPending: summary.migrationPending,
    });
  } catch {
    return NextResponse.json({
      isAdmin: true,
      adminEmail: ctx.user.email ?? null,
      unreadInboxCount: 0,
      inboxCount: 0,
      recentUnread: [],
      migrationPending: false,
    });
  }
}
