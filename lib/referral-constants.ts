export const REFERRAL_COOKIE_NAME = "artigen_ref";
export const REFERRAL_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 60; // 60 dias

export const RESERVED_REF_CODES = new Set<string>([
  "admin",
  "administrador",
  "api",
  "app",
  "artigen",
  "artigoai",
  "artificializar",
  "assinatura",
  "auth",
  "blog",
  "cakto",
  "callback",
  "checkout",
  "comissao",
  "comissoes",
  "config",
  "contato",
  "convite",
  "cookies",
  "criador",
  "dashboard",
  "docs",
  "dpo",
  "equipe",
  "estudo",
  "estudio",
  "faq",
  "favicon",
  "financeiro",
  "gratis",
  "home",
  "index",
  "inicio",
  "legal",
  "lgpd",
  "login",
  "logout",
  "manifest",
  "mascote",
  "mulebi",
  "null",
  "oauth",
  "oficial",
  "pagamento",
  "pagamentos",
  "painel",
  "parceiro",
  "parceiros",
  "planos",
  "politica",
  "politica-de-cookies",
  "portal",
  "pricing",
  "privacidade",
  "pro",
  "reembolso",
  "reembolso-e-cancelamento",
  "robots",
  "root",
  "saas",
  "signin",
  "signup",
  "sitemap",
  "sobre",
  "starter",
  "static",
  "status",
  "stripe",
  "studio",
  "supabase",
  "suporte",
  "system",
  "termos",
  "termos-de-uso",
  "termos-parceiros",
  "teste",
  "undefined",
  "user",
  "users",
  "webhook",
  "webhooks",
  "www",
]);

export function sanitizeRefCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const cleaned = raw.trim().toLowerCase();
  if (cleaned.length < 3 || cleaned.length > 30) return null;
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(cleaned)) return null;
  if (cleaned.includes("--")) return null;
  if (RESERVED_REF_CODES.has(cleaned)) return null;
  return cleaned;
}

export function validateCustomPartnerCode(
  raw: unknown
): { valid: true; code: string } | { valid: false; error: string } {
  if (typeof raw !== "string") {
    return { valid: false, error: "Informe um código válido." };
  }
  const cleaned = raw.trim().toLowerCase();
  if (cleaned.length < 3 || cleaned.length > 30) {
    return {
      valid: false,
      error: "O código deve ter entre 3 e 30 caracteres.",
    };
  }
  if (!/^[a-z0-9-]+$/.test(cleaned)) {
    return {
      valid: false,
      error: "Use apenas letras minúsculas, números e hífen (-).",
    };
  }
  if (cleaned.startsWith("-") || cleaned.endsWith("-") || cleaned.includes("--")) {
    return {
      valid: false,
      error: "O código não pode começar, terminar ou repetir hífen (--).",
    };
  }
  if (RESERVED_REF_CODES.has(cleaned)) {
    return {
      valid: false,
      error: "Este código é reservado pelo sistema. Escolha outro.",
    };
  }
  return { valid: true, code: cleaned };
}
