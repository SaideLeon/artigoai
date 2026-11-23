import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { constantTimeCompare } from "@/lib/cakto";
import { getSupabaseAdminClient } from "@/lib/cakto-fulfillment";
import {
  getAuthenticatedServerUser,
  isUserSuperAdmin,
} from "@/lib/partners-server";

async function authorizeCronOrAdmin(
  req: NextRequest,
  admin: SupabaseClient
): Promise<{
  ok: boolean;
  status: number;
  error?: string;
}> {
  const authHeader = req.headers.get("authorization") ?? "";
  const bearerToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : "";
  const configuredSecret = process.env.CRON_SECRET?.trim() ?? "";

  if (
    configuredSecret &&
    bearerToken &&
    constantTimeCompare(bearerToken, configuredSecret)
  ) {
    return { ok: true, status: 200 };
  }

  const user = await getAuthenticatedServerUser();
  if (!user) {
    return { ok: false, status: 401, error: "Autorização necessária." };
  }

  const isSuperAdmin = await isUserSuperAdmin(admin, user);
  if (!isSuperAdmin) {
    return {
      ok: false,
      status: 403,
      error:
        "Acesso restrito ao cron autenticado ou administrador supremo.",
    };
  }

  return { ok: true, status: 200 };
}

async function handleMaturation(req: NextRequest) {
  const admin = getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json(
      { erro: "Supabase service_role não configurado no servidor." },
      { status: 503 }
    );
  }

  const auth = await authorizeCronOrAdmin(req, admin);
  if (!auth.ok) {
    return NextResponse.json({ erro: auth.error }, { status: auth.status });
  }

  const { data: maturedCount, error } = await admin.rpc(
    "maturar_comissoes_pendentes",
    {
      p_now: new Date().toISOString(),
    }
  );

  if (error) {
    return NextResponse.json(
      { erro: `Falha ao maturar comissões: ${error.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    maturedCount: Number(maturedCount ?? 0),
    executedAt: new Date().toISOString(),
  });
}

export async function GET(req: NextRequest) {
  return handleMaturation(req);
}

export async function POST(req: NextRequest) {
  return handleMaturation(req);
}
