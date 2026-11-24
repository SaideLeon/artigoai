import crypto from "crypto";
import {
  REFERRAL_COOKIE_MAX_AGE_SECONDS,
  REFERRAL_COOKIE_NAME,
  RESERVED_REF_CODES,
  sanitizeRefCode,
  validateCustomPartnerCode,
} from "@/lib/referral-constants";

export {
  REFERRAL_COOKIE_MAX_AGE_SECONDS,
  REFERRAL_COOKIE_NAME,
  RESERVED_REF_CODES,
  sanitizeRefCode,
  validateCustomPartnerCode,
};

// =============================================================================
// Regras configuráveis do Sistema de Parceiros, Comissões e Saques
// =============================================================================
export type CommissionBaseMode = "valor_bruto" | "valor_liquido";

export const COMISSAO_RECORRENTE = true;
export const COMISSAO_MAX_MESES: number | null = null; // null = ilimitado
export const BASE_DE_CALCULO: CommissionBaseMode = "valor_bruto"; // "valor_bruto" | "valor_liquido"
export const GARANTIA_DIAS = 7; // Período em dias até comissão pendente virar disponível
export const SAQUE_MINIMO_CENTAVOS = 5000; // R$ 50,00 em centavos inteiros

export const DEFAULT_PARTNER_COMMISSION_PERCENT = 35;
export const DEFAULT_INVITE_VALIDITY_DAYS = 14;

/**
 * Taxas oficiais do Programa de Parceiros por plano assinado pelo indicado,
 * incidindo sobre o valor bruto efetivamente recebido pelo Artigen.
 */
export const PLAN_COMMISSION_RATES: Record<"starter" | "pro" | "agencia", number> = {
  starter: 20,
  pro: 35,
  agencia: 35,
};

export function getOfficialCommissionPercentForPlan(
  planId: string | null | undefined,
  fallbackPercent: number = DEFAULT_PARTNER_COMMISSION_PERCENT
): number {
  const normalized = (planId ?? "").trim().toLowerCase();
  if (normalized === "starter") return PLAN_COMMISSION_RATES.starter;
  if (normalized === "pro") return PLAN_COMMISSION_RATES.pro;
  if (normalized === "agencia") return PLAN_COMMISSION_RATES.agencia;
  const parsed = Number(fallbackPercent);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100
    ? parsed
    : DEFAULT_PARTNER_COMMISSION_PERCENT;
}

export type InviteStatus = "pendente" | "aceito" | "expirado" | "cancelado";
export type CommissionType = "primeiro_pagamento" | "renovacao";
export type CommissionStatus =
  | "pendente"
  | "disponivel"
  | "em_saque"
  | "paga"
  | "estornada";

export type WithdrawalStatus =
  | "solicitado"
  | "em_analise"
  | "pago"
  | "recusado";
export type WithdrawalMethod = "pix" | "outro";
export type PixKeyType = "cpf" | "cnpj" | "email" | "telefone" | "aleatoria";

export function brlToCents(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100);
}

export function centsToBrlNumber(cents: number): number {
  if (!Number.isFinite(cents)) return 0;
  return Math.round(cents) / 100;
}

export function roundCurrencyBrl(value: number): number {
  return Math.round(value * 100) / 100;
}

export function calculateCommissionCents(
  baseAmountCents: number,
  percent: number
): number {
  if (!Number.isFinite(baseAmountCents) || baseAmountCents <= 0) return 0;
  if (!Number.isFinite(percent) || percent <= 0) return 0;
  const clampedPercent = Math.min(100, Math.max(0, percent));
  // Multiplica em escala fixa para evitar imprecisão binária de ponto flutuante
  const basisPoints = Math.round(clampedPercent * 100);
  return Math.round((Math.round(baseAmountCents) * basisPoints) / 10000);
}

export function formatBrl(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number.isFinite(value) ? value : 0);
}

export function formatCentsBrl(cents: number): string {
  return formatBrl(centsToBrlNumber(cents));
}

export function slugifyPartnerSeed(rawNameOrEmail: string): string {
  const withoutAccents = rawNameOrEmail
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const baseSource = withoutAccents.includes("@")
    ? withoutAccents.split("@")[0]
    : withoutAccents;
  let slug = baseSource
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 24)
    .replace(/-+$/g, "");

  if (slug.length < 3 || RESERVED_REF_CODES.has(slug)) {
    slug = "parceiro";
  }
  return slug;
}

export function generateInviteToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashInviteToken(token: string): string {
  return crypto.createHash("sha256").update(token.trim()).digest("hex");
}

export function isValidInviteTokenFormat(token: string): boolean {
  return /^[A-Za-z0-9_-]{24,128}$/.test(token.trim());
}

export function maskEmail(email: string | null | undefined): string {
  const trimmed = (email ?? "").trim();
  const atIdx = trimmed.indexOf("@");
  if (atIdx <= 0) return "***";
  const local = trimmed.slice(0, atIdx);
  const domain = trimmed.slice(atIdx + 1);
  if (!domain) return "***";
  const prefix = local.length <= 2 ? local.slice(0, 1) : local.slice(0, 2);
  return `${prefix}***@${domain}`;
}

function parseEmailToken(raw: string | undefined): string | null {
  const cleaned = (raw ?? "")
    .trim()
    .replace(/^["']|["']$/g, "")
    .toLowerCase();
  if (!cleaned) return null;
  if (!/^[^\s,;]+@[^\s,;]+\.[^\s,;]+$/.test(cleaned)) return null;
  return cleaned;
}

function parseEmailList(raw: string | undefined): string[] {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return [];
  return Array.from(
    new Set(
      trimmed
        .split(/[,;\s]+/)
        .map((item) => parseEmailToken(item))
        .filter((item): item is string => Boolean(item))
    )
  );
}

export function getSuperAdminEmails(): string[] {
  const sources = [
    process.env.SUPER_ADMIN_EMAILS,
    process.env.SUPER_ADMIN_EMAIL,
    process.env.ADMIN_EMAIL,
    process.env.PARTNER_ADMIN_EMAILS,
  ];
  for (const src of sources) {
    const parsed = parseEmailList(src);
    if (parsed.length > 0) return parsed;
  }
  return [];
}

export function getSupremeAdminEmail(): string | null {
  return getSuperAdminEmails()[0] ?? null;
}

export function isSupremeAdminEmail(
  email: string | null | undefined
): boolean {
  const normalized = parseEmailToken(email ?? undefined);
  const superAdmins = getSuperAdminEmails();
  if (!normalized || superAdmins.length === 0) return false;

  const hashCandidate = crypto.createHash("sha256").update(normalized).digest();
  return superAdmins.some((allowed) => {
    const hashAllowed = crypto.createHash("sha256").update(allowed).digest();
    return crypto.timingSafeEqual(hashCandidate, hashAllowed);
  });
}

export function getPartnerAdminEmails(): string[] {
  return getSuperAdminEmails();
}

export function isPartnerAdminEmail(email: string | null | undefined): boolean {
  return isSupremeAdminEmail(email);
}

export function escapeCsvCell(value: unknown): string {
  let str = String(value ?? "").replace(/\r?\n/g, " ");
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  if (str.includes(",") || str.includes('"') || str.includes(";")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

const PIX_KEY_TYPES = new Set<PixKeyType>([
  "cpf",
  "cnpj",
  "email",
  "telefone",
  "aleatoria",
]);

export function validateWithdrawalPayload(raw: {
  metodo?: unknown;
  pixTipoChave?: unknown;
  dadosPagamento?: unknown;
  valorCentavos?: unknown;
}):
  | {
      ok: true;
      metodo: WithdrawalMethod;
      pixTipoChave: PixKeyType | null;
      dadosPagamento: string;
      requestedCents: number | null;
    }
  | { ok: false; error: string } {
  const metodo =
    raw.metodo === "pix" || raw.metodo === "outro" ? raw.metodo : null;
  if (!metodo) {
    return {
      ok: false,
      error: "Selecione um método de pagamento válido (Pix ou Outro).",
    };
  }

  let pixTipoChave: PixKeyType | null = null;
  if (metodo === "pix") {
    if (
      typeof raw.pixTipoChave !== "string" ||
      !PIX_KEY_TYPES.has(raw.pixTipoChave as PixKeyType)
    ) {
      return {
        ok: false,
        error:
          "Selecione o tipo da chave Pix (CPF, CNPJ, E-mail, Telefone ou Chave aleatória).",
      };
    }
    pixTipoChave = raw.pixTipoChave as PixKeyType;
  }

  const dados =
    typeof raw.dadosPagamento === "string" ? raw.dadosPagamento.trim() : "";
  if (dados.length < 3 || dados.length > 500) {
    return {
      ok: false,
      error:
        metodo === "pix"
          ? "Informe a chave Pix completa (3 a 500 caracteres)."
          : "Descreva os dados completos de pagamento (3 a 500 caracteres).",
    };
  }

  let requestedCents: number | null = null;
  if (
    raw.valorCentavos !== undefined &&
    raw.valorCentavos !== null &&
    raw.valorCentavos !== ""
  ) {
    const parsed = Number(raw.valorCentavos);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return {
        ok: false,
        error: "Valor de saque inválido (deve ser inteiro em centavos).",
      };
    }
    requestedCents = parsed;
  }

  return {
    ok: true,
    metodo,
    pixTipoChave,
    dadosPagamento: dados,
    requestedCents,
  };
}
