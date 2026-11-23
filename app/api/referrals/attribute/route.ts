import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSupabaseAdminClient } from "@/lib/cakto-fulfillment";
import { REFERRAL_COOKIE_NAME, sanitizeRefCode } from "@/lib/partners";
import { getAuthenticatedServerUser } from "@/lib/partners-server";

const NEW_ACCOUNT_WINDOW_MS = 30 * 60 * 1000;

export async function POST() {
  const user = await getAuthenticatedServerUser();
  if (!user) {
    return NextResponse.json(
      { attributed: false, reason: "unauthenticated" },
      { status: 401 }
    );
  }

  const cookieStore = await cookies();
  const rawCookie = cookieStore.get(REFERRAL_COOKIE_NAME)?.value;
  const refCode = sanitizeRefCode(rawCookie);

  if (!refCode) {
    return NextResponse.json({
      attributed: false,
      reason: "no_referral_cookie",
    });
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json(
      { attributed: false, reason: "db_unavailable" },
      { status: 503 }
    );
  }

  const { data: partner } = await admin
    .from("partners")
    .select("id, user_id, codigo, ativo")
    .eq("codigo", refCode)
    .maybeSingle();

  if (!partner || !partner.ativo) {
    return NextResponse.json({
      attributed: false,
      reason: "partner_inactive_or_missing",
    });
  }

  // Bloqueia autoindicação
  if (partner.user_id === user.id) {
    return NextResponse.json({
      attributed: false,
      reason: "self_referral_blocked",
    });
  }

  // Verifica se o utilizador já possui indicador gravado (imutável)
  const { data: profile } = await admin
    .from("profiles")
    .select("id, referred_by, created_at")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.referred_by) {
    return NextResponse.json({
      attributed: false,
      reason: "already_attributed",
    });
  }

  // Contas existentes antigas não são associadas retroativamente
  const authCreatedMs = user.created_at
    ? new Date(user.created_at).getTime()
    : Date.now();
  const isRecentlyCreated =
    Number.isFinite(authCreatedMs) &&
    Date.now() - authCreatedMs <= NEW_ACCOUNT_WINDOW_MS;

  if (!isRecentlyCreated) {
    return NextResponse.json({
      attributed: false,
      reason: "existing_account_not_retroactive",
    });
  }

  const [{ count: articlesCount }, { count: paymentsCount }] =
    await Promise.all([
      admin
        .from("articles")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id),
      admin
        .from("payments")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id),
    ]);

  if ((articlesCount ?? 0) > 0 || (paymentsCount ?? 0) > 0) {
    return NextResponse.json({
      attributed: false,
      reason: "existing_account_with_history",
    });
  }

  const nowIso = new Date().toISOString();

  if (!profile) {
    const { error: upsertErr } = await admin.from("profiles").insert({
      id: user.id,
      email: (user.email ?? "").trim(),
      full_name:
        (user.user_metadata?.full_name as string | undefined) ||
        (user.user_metadata?.name as string | undefined) ||
        "Usuário Artigen",
      avatar_url:
        (user.user_metadata?.avatar_url as string | undefined) ||
        (user.user_metadata?.picture as string | undefined) ||
        "",
      referred_by: partner.id,
      referred_at: nowIso,
    });
    if (upsertErr) {
      return NextResponse.json(
        { attributed: false, reason: upsertErr.message },
        { status: 500 }
      );
    }
    return NextResponse.json({
      attributed: true,
      partnerCode: partner.codigo,
    });
  }

  const { data: updated, error: updateErr } = await admin
    .from("profiles")
    .update({
      referred_by: partner.id,
      referred_at: nowIso,
    })
    .eq("id", user.id)
    .is("referred_by", null)
    .select("referred_by")
    .maybeSingle();

  if (updateErr) {
    return NextResponse.json(
      { attributed: false, reason: updateErr.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    attributed: Boolean(updated?.referred_by),
    partnerCode: partner.codigo,
  });
}
