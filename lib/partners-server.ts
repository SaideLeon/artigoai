import { cookies } from "next/headers";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient as createSupabaseServerClient } from "@/utils/supabase/server";
import { getSupabaseAdminClient } from "@/lib/cakto-fulfillment";
import {
  getSuperAdminEmails,
  isSupremeAdminEmail,
  RESERVED_REF_CODES,
  slugifyPartnerSeed,
} from "@/lib/partners";
import { SITE_URL } from "@/lib/seo";

export type PartnerRow = {
  id: string;
  user_id: string;
  codigo: string;
  percentual_comissao: number;
  ativo: boolean;
  codigo_personalizado: boolean;
  criado_em: string;
};

export type PartnerInviteRow = {
  id: string;
  token_hash: string;
  nome_sugerido: string;
  percentual_comissao: number;
  expira_em: string;
  status: "pendente" | "aceito" | "expirado" | "cancelado";
  criado_em: string;
  aceito_em: string | null;
  aceito_por_user_id: string | null;
  criado_por_email: string;
};

export type SuperAdminDiag = {
  supabaseProjectRef: string;
  userIdPrefix: string;
  userProfileRole: string | null;
  adminProfileRole: string | null;
  userQueryError: string | null;
  adminQueryError: string | null;
  serviceRoleBypassOk: boolean;
  envSuperAdminConfigured: boolean;
};

function extractSupabaseProjectRef(): string {
  try {
    const raw = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    if (!raw) return "nao-configurado";
    return new URL(raw).hostname.split(".")[0] || "desconhecido";
  } catch {
    return "url-invalida";
  }
}

export async function getAuthenticatedServerContext(): Promise<{
  user: User;
  supabase: ReturnType<typeof createSupabaseServerClient>;
} | null> {
  try {
    const cookieStore = await cookies();
    const supabase = createSupabaseServerClient(cookieStore);
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user) return null;
    return { user, supabase };
  } catch {
    return null;
  }
}

export async function getAuthenticatedServerUser(): Promise<User | null> {
  const ctx = await getAuthenticatedServerContext();
  return ctx?.user ?? null;
}

function hasVerifiedEmailForEnv(user: User): boolean {
  const provider =
    typeof user.app_metadata?.provider === "string"
      ? user.app_metadata.provider
      : "email";
  return Boolean(
    user.email &&
      (user.email_confirmed_at ||
        user.confirmed_at ||
        provider !== "email")
  );
}

export async function isUserSuperAdmin(
  admin: SupabaseClient,
  user: User,
  userClient?: SupabaseClient
): Promise<boolean> {
  const { data: adminProfile, error: adminErr } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!adminErr && adminProfile?.role === "superadmin") {
    return true;
  }

  if (userClient) {
    const { data: userProfile, error: userErr } = await userClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (!userErr && userProfile?.role === "superadmin") {
      return true;
    }
  }

  if (!hasVerifiedEmailForEnv(user)) return false;
  return isSupremeAdminEmail(user.email);
}

export async function requireSupremeAdmin(): Promise<
  | { ok: true; user: User; admin: SupabaseClient }
  | { ok: false; status: number; error: string; diag?: SuperAdminDiag }
> {
  const ctx = await getAuthenticatedServerContext();
  if (!ctx) {
    return {
      ok: false,
      status: 401,
      error: "Autenticação necessária.",
    };
  }

  const { user, supabase } = ctx;
  const admin = getSupabaseAdminClient();
  if (!admin) {
    return {
      ok: false,
      status: 503,
      error: "Supabase service_role não configurado no servidor.",
    };
  }

  const [
    { data: userProfile, error: userProfileErr },
    { data: adminProfile, error: adminProfileErr },
  ] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
    admin.from("profiles").select("role").eq("id", user.id).maybeSingle(),
  ]);

  const serviceRoleInvalid =
    Boolean(
      adminProfileErr &&
        /invalid api key|jwt|unauthorized|permission denied/i.test(
          adminProfileErr.message
        )
    ) || Boolean(userProfile && !adminProfile && !adminProfileErr);

  const diag: SuperAdminDiag = {
    supabaseProjectRef: extractSupabaseProjectRef(),
    userIdPrefix: user.id.slice(0, 8),
    userProfileRole: userProfile?.role ? String(userProfile.role) : null,
    adminProfileRole: adminProfile?.role ? String(adminProfile.role) : null,
    userQueryError: userProfileErr?.message ?? null,
    adminQueryError: adminProfileErr?.message ?? null,
    serviceRoleBypassOk: !serviceRoleInvalid,
    envSuperAdminConfigured: getSuperAdminEmails().length > 0,
  };

  if (serviceRoleInvalid) {
    console.error("[Artigen SuperAdmin] Erro com SUPABASE_SERVICE_ROLE_KEY:", diag);
    return {
      ok: false,
      status: 503,
      error:
        "Chave SUPABASE_SERVICE_ROLE_KEY inválida ou sem permissão service_role na Vercel (não use a chave anon/publishable).",
      diag,
    };
  }

  const isRoleSuperAdmin =
    (!adminProfileErr && adminProfile?.role === "superadmin") ||
    (!userProfileErr && userProfile?.role === "superadmin");

  const isEnvSuperAdmin =
    hasVerifiedEmailForEnv(user) && isSupremeAdminEmail(user.email);

  if (!isRoleSuperAdmin && !isEnvSuperAdmin) {
    return {
      ok: false,
      status: 403,
      error: "Acesso restrito exclusivamente ao administrador supremo.",
      diag,
    };
  }

  return { ok: true, user, admin };
}

export const requirePartnerAdmin = requireSupremeAdmin;

export function getPublicSiteOrigin(requestOrigin?: string): string {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (envUrl) return envUrl.replace(/\/+$/, "");
  if (requestOrigin && /^https?:\/\//i.test(requestOrigin)) {
    return requestOrigin.replace(/\/+$/, "");
  }
  return SITE_URL;
}

export async function generateUniquePartnerCode(
  admin: SupabaseClient,
  nameOrEmail: string
): Promise<string> {
  const base = slugifyPartnerSeed(nameOrEmail);

  // Tenta código base sem sufixo primeiro (se não estiver reservado)
  if (!RESERVED_REF_CODES.has(base) && base !== "parceiro") {
    const { data: existing } = await admin
      .from("partners")
      .select("id")
      .eq("codigo", base)
      .maybeSingle();
    if (!existing) {
      return base;
    }
  }

  // Tenta sufixos numéricos determinísticos e aleatórios curtos
  for (let i = 2; i <= 30; i++) {
    const candidate = `${base.slice(0, 24)}-${i}`;
    if (RESERVED_REF_CODES.has(candidate)) continue;
    const { data: existing } = await admin
      .from("partners")
      .select("id")
      .eq("codigo", candidate)
      .maybeSingle();
    if (!existing) {
      return candidate;
    }
  }

  const fallbackSuffix = Math.floor(1000 + Math.random() * 9000);
  return `${base.slice(0, 20)}-${fallbackSuffix}`;
}
