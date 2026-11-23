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
// Regras configuráveis do Sistema de Parceiros e Comissões
// =============================================================================
export const COMISSAO_RECORRENTE = true;
export const COMISSAO_MAX_MESES: number | null = null; // null = ilimitado
export const BASE_DE_CALCULO = "valor_bruto" as const;

export const DEFAULT_PARTNER_COMMISSION_PERCENT = 45;
export const DEFAULT_INVITE_VALIDITY_DAYS = 14;

export type InviteStatus = "pendente" | "aceito" | "expirado" | "cancelado";
export type CommissionType = "primeiro_pagamento" | "renovacao";
export type CommissionStatus = "pendente" | "paga" | "estornada";

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

export function isPartnerAdminEmail(email: string | null | undefined): boolean {
  const normalized = (email ?? "").trim().toLowerCase();
  if (!normalized) return false;
  const rawList =
    process.env.PARTNER_ADMIN_EMAILS?.trim() ||
    process.env.ADMIN_EMAIL?.trim() ||
    "";
  if (!rawList) return false;
  const allowed = rawList
    .split(/[,;\s]+/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(normalized);
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

export function roundCurrencyBrl(value: number): number {
  return Math.round(value * 100) / 100;
}

export function formatBrl(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number.isFinite(value) ? value : 0);
}
