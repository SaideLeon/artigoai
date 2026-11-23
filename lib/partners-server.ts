import { cookies } from "next/headers";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient as createSupabaseServerClient } from "@/utils/supabase/server";
import { getSupabaseAdminClient } from "@/lib/cakto-fulfillment";
import {
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

export async function getAuthenticatedServerUser(): Promise<User | null> {
  try {
    const cookieStore = await cookies();
    const supabase = createSupabaseServerClient(cookieStore);
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user) return null;
    return user;
  } catch {
    return null;
  }
}

export async function isUserSuperAdmin(
  admin: SupabaseClient,
  user: User
): Promise<boolean> {
  const { data: profile, error: profErr } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profErr && profile?.role === "superadmin") {
    return true;
  }

  const provider =
    typeof user.app_metadata?.provider === "string"
      ? user.app_metadata.provider
      : "email";
  const hasVerifiedEmail = Boolean(
    user.email &&
      (user.email_confirmed_at ||
        user.confirmed_at ||
        provider !== "email")
  );
  if (!hasVerifiedEmail) return false;

  return isSupremeAdminEmail(user.email);
}

export async function requireSupremeAdmin(): Promise<
  | { ok: true; user: User; admin: SupabaseClient }
  | { ok: false; status: number; error: string }
> {
  const user = await getAuthenticatedServerUser();
  if (!user) {
    return {
      ok: false,
      status: 401,
      error: "Autenticação necessária.",
    };
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    return {
      ok: false,
      status: 503,
      error: "Supabase service_role não configurado no servidor.",
    };
  }

  const isSuperAdmin = await isUserSuperAdmin(admin, user);
  if (!isSuperAdmin) {
    return {
      ok: false,
      status: 403,
      error: "Acesso restrito exclusivamente ao administrador supremo.",
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
