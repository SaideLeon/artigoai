import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { formatCentsBrl, getSuperAdminEmails } from "@/lib/partners";
import { SITE_NAME, SITE_URL } from "@/lib/seo";

function getEmailAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const VERIFIED_EMAIL_DOMAIN = "artificializar.site";
export const DEFAULT_EMAIL_FROM = `Artigen <contato@${VERIFIED_EMAIL_DOMAIN}>`;
export const DEFAULT_CONTACT_TO_EMAIL = `contato@${VERIFIED_EMAIL_DOMAIN}`;

export type EmailSendResult = {
  sent: boolean;
  provider: "resend" | "unconfigured";
  id?: string;
  error?: string;
};

export type EmailServiceSummary = {
  configured: boolean;
  domain: string;
  from: string;
};

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function sanitizeHeaderField(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

export function isValidEmailAddress(email: string): boolean {
  const clean = email.trim();
  if (!clean || clean.length > 254 || /[\r\n]/.test(clean)) return false;
  return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(clean);
}

export function resolveEmailFrom(
  envFrom = process.env.EMAIL_FROM
): string {
  const cleaned = envFrom ? sanitizeHeaderField(envFrom) : "";
  return cleaned || DEFAULT_EMAIL_FROM;
}

export function resolveSiteOrigin(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL?.trim() || SITE_URL).replace(
    /\/+$/,
    ""
  );
}

export function getResendApiKey(): string | null {
  const key = process.env.RESEND_API_KEY?.trim();
  return key || null;
}

export function isEmailServiceConfigured(): boolean {
  return Boolean(getResendApiKey());
}

export function getEmailServiceSummary(): EmailServiceSummary {
  const from = resolveEmailFrom();
  const domainMatch = from.match(/@([a-z0-9.-]+)/i);
  return {
    configured: isEmailServiceConfigured(),
    domain: domainMatch?.[1]?.toLowerCase() ?? VERIFIED_EMAIL_DOMAIN,
    from,
  };
}

export async function resolveAdminAndSupportRecipients(): Promise<string[]> {
  const recipients = new Set<string>();
  const contactTo = process.env.CONTACT_TO_EMAIL?.trim().toLowerCase();
  if (contactTo && isValidEmailAddress(contactTo)) {
    recipients.add(contactTo);
  } else {
    recipients.add(DEFAULT_CONTACT_TO_EMAIL);
  }

  for (const email of getSuperAdminEmails()) {
    if (isValidEmailAddress(email)) {
      recipients.add(email.toLowerCase());
    }
  }

  const admin = getEmailAdminSupabase();
  if (admin) {
    try {
      const { data: superAdmins } = await admin
        .from("profiles")
        .select("email")
        .eq("role", "superadmin");
      for (const row of superAdmins ?? []) {
        const email = String(row.email ?? "").trim().toLowerCase();
        if (isValidEmailAddress(email)) {
          recipients.add(email);
        }
      }
    } catch {
      // Mantém destinatários padrão mesmo se o lookup falhar
    }
  }

  return Array.from(recipients);
}

export async function sendTransactionalEmail(params: {
  to: string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}): Promise<EmailSendResult> {
  const recipients = Array.from(
    new Set(
      params.to
        .map((e) => sanitizeHeaderField(e).toLowerCase())
        .filter((e) => isValidEmailAddress(e))
    )
  );

  if (recipients.length === 0) {
    return {
      sent: false,
      provider: "unconfigured",
      error: "Sem destinatário válido.",
    };
  }

  const apiKey = getResendApiKey();
  if (!apiKey) {
    console.info(
      `[Artigen][Resend não configurado — defina RESEND_API_KEY] Para: ${recipients.join(", ")} | Assunto: ${sanitizeHeaderField(params.subject)}`
    );
    return { sent: false, provider: "unconfigured" };
  }

  const from = resolveEmailFrom();
  const subject = sanitizeHeaderField(params.subject).slice(0, 200);
  const replyToClean =
    params.replyTo && isValidEmailAddress(params.replyTo)
      ? sanitizeHeaderField(params.replyTo)
      : undefined;

  try {
    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({
      from,
      to: recipients,
      subject,
      html: params.html,
      text: params.text,
      ...(replyToClean ? { replyTo: replyToClean } : {}),
    });

    if (error) {
      console.error(
        `[Artigen] Erro Resend (${error.name ?? "api_error"}): ${error.message}`
      );
      return {
        sent: false,
        provider: "resend",
        error: error.message || "resend_api_error",
      };
    }

    return {
      sent: true,
      provider: "resend",
      id: data?.id,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "network_error";
    console.error("[Artigen] Falha ao enviar e-mail via Resend:", message);
    return {
      sent: false,
      provider: "resend",
      error: message,
    };
  }
}

export function wrapArtigenEmailLayout(params: {
  subtitle: string;
  title: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaPath?: string;
}): string {
  const origin = resolveSiteOrigin();
  const ctaPath = params.ctaPath ?? "/studio";
  const ctaHref = ctaPath.startsWith("http")
    ? ctaPath
    : `${origin}${ctaPath.startsWith("/") ? "" : "/"}${ctaPath}`;
  const ctaLabel = params.ctaLabel ?? "Abrir Artigen";

  return `
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background:#F4F6FB; color:#0F172A; padding:32px 16px;">
    <div style="max-width:580px; margin:0 auto; background:#FFFFFF; border:1px solid #E2E8F0; border-radius:16px; overflow:hidden; box-shadow:0 4px 20px rgba(15,23,42,0.06);">
      <div style="background:linear-gradient(135deg, #0E162E 0%, #1E3A8A 100%); padding:22px 28px;">
        <p style="margin:0; font-size:11px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:#A5B4FC;">
          ${escapeHtml(SITE_NAME)} · ${escapeHtml(params.subtitle)}
        </p>
        <h1 style="margin:8px 0 0; font-size:20px; font-weight:700; color:#FFFFFF; line-height:1.3;">
          ${escapeHtml(params.title)}
        </h1>
      </div>
      <div style="padding:26px 28px; font-size:14px; line-height:1.65; color:#334155;">
        ${params.bodyHtml}
        <div style="margin-top:24px; padding-top:18px; border-top:1px solid #E2E8F0;">
          <a href="${escapeHtml(ctaHref)}" style="display:inline-block; background:#4F46E5; color:#FFFFFF; text-decoration:none; font-weight:600; font-size:13px; padding:11px 20px; border-radius:10px;">
            ${escapeHtml(ctaLabel)}
          </a>
        </div>
      </div>
      <div style="background:#F8FAFC; padding:14px 28px; border-top:1px solid #E2E8F0; font-size:11px; color:#64748B;">
        Enviado por ${escapeHtml(SITE_NAME)} (${escapeHtml(VERIFIED_EMAIL_DOMAIN)}) · ${escapeHtml(origin)}
      </div>
    </div>
  </div>`;
}

export async function sendContactInquiryEmail(params: {
  nome: string;
  email: string;
  assunto: string;
  mensagem: string;
}): Promise<EmailSendResult> {
  const recipients = await resolveAdminAndSupportRecipients();
  const safeNome = sanitizeHeaderField(params.nome).slice(0, 120);
  const safeEmail = sanitizeHeaderField(params.email).toLowerCase().slice(0, 254);
  const safeAssunto = sanitizeHeaderField(params.assunto).slice(0, 120);
  const safeMensagem = params.mensagem.trim().slice(0, 3000);

  const subject = `[Artigen Contato] ${safeAssunto} — ${safeNome}`;
  const bodyHtml = `
    <p>Uma nova mensagem foi enviada pelo formulário de contato do site:</p>
    <table style="width:100%; border-collapse:collapse; margin:14px 0; font-size:13px;">
      <tr>
        <td style="padding:8px 10px; border:1px solid #E2E8F0; background:#F8FAFC; font-weight:600; width:120px;">Nome</td>
        <td style="padding:8px 10px; border:1px solid #E2E8F0;">${escapeHtml(safeNome)}</td>
      </tr>
      <tr>
        <td style="padding:8px 10px; border:1px solid #E2E8F0; background:#F8FAFC; font-weight:600;">E-mail</td>
        <td style="padding:8px 10px; border:1px solid #E2E8F0;">${escapeHtml(safeEmail)}</td>
      </tr>
      <tr>
        <td style="padding:8px 10px; border:1px solid #E2E8F0; background:#F8FAFC; font-weight:600;">Assunto</td>
        <td style="padding:8px 10px; border:1px solid #E2E8F0;">${escapeHtml(safeAssunto)}</td>
      </tr>
    </table>
    <div style="margin-top:14px; padding:14px; border-radius:10px; background:#F8FAFC; border:1px solid #E2E8F0; white-space:pre-wrap;">${escapeHtml(safeMensagem)}</div>
  `;

  const text = `${SITE_NAME} — Contato pelo site\nNome: ${safeNome}\nE-mail: ${safeEmail}\nAssunto: ${safeAssunto}\n\nMensagem:\n${safeMensagem}`;

  return sendTransactionalEmail({
    to: recipients,
    subject,
    html: wrapArtigenEmailLayout({
      subtitle: "Contato do Site",
      title: `Nova mensagem: ${safeAssunto}`,
      bodyHtml,
      ctaLabel: "Responder na Caixa Artigen",
      ctaPath: "/admin/emails",
    }),
    text,
    replyTo: safeEmail,
  });
}

export async function notifySubscriptionConfirmed(params: {
  userEmail: string;
  planName: string;
  planId: string;
  billingCycle: "monthly" | "yearly";
  articlesPerMonth: number;
  imagesPerMonth: number;
  amountCents: number;
  paymentMethod?: string;
}): Promise<EmailSendResult> {
  if (!isValidEmailAddress(params.userEmail)) {
    return { sent: false, provider: "unconfigured", error: "E-mail inválido." };
  }

  const valor = formatCentsBrl(params.amountCents);
  const cicloLabel = params.billingCycle === "yearly" ? "Anual" : "Mensal";
  const subject = `[Artigen] Assinatura ${params.planName} confirmada!`;
  const bodyHtml = `
    <p>Sua assinatura do plano <strong>${escapeHtml(params.planName)} (${escapeHtml(cicloLabel)})</strong> foi confirmada e sua cota já está ativa.</p>
    <ul>
      <li><strong>Plano ativo:</strong> ${escapeHtml(params.planName)} (${escapeHtml(params.planId)})</li>
      <li><strong>Valor processado:</strong> ${escapeHtml(valor)}</li>
      <li><strong>Artigos por mês:</strong> ${escapeHtml(String(params.articlesPerMonth))}</li>
      <li><strong>Imagens por mês:</strong> ${escapeHtml(String(params.imagesPerMonth))} (até 7 por artigo)</li>
      ${params.paymentMethod ? `<li><strong>Método:</strong> ${escapeHtml(params.paymentMethod.toUpperCase())}</li>` : ""}
    </ul>
    <p>Você já pode gerar seus artigos completos no estúdio do Artigen.</p>
  `;
  const text = `${SITE_NAME} — Assinatura ${params.planName} (${cicloLabel}) confirmada! Valor: ${valor}. Cota: ${params.articlesPerMonth} artigos/mês e ${params.imagesPerMonth} imagens/mês.`;

  return sendTransactionalEmail({
    to: [params.userEmail],
    subject,
    html: wrapArtigenEmailLayout({
      subtitle: "Assinatura Confirmada",
      title: `Bem-vindo ao plano ${params.planName}!`,
      bodyHtml,
      ctaLabel: "Abrir Estúdio Artigen",
      ctaPath: "/studio",
    }),
    text,
  });
}

export async function notifyPartnerWelcome(params: {
  partnerEmail: string;
  partnerName?: string;
  partnerCode: string;
}): Promise<EmailSendResult> {
  if (!isValidEmailAddress(params.partnerEmail)) {
    return { sent: false, provider: "unconfigured", error: "E-mail inválido." };
  }

  const origin = resolveSiteOrigin();
  const refUrl = `${origin}/?ref=${encodeURIComponent(params.partnerCode)}`;
  const greeting = params.partnerName
    ? `Olá, ${escapeHtml(params.partnerName)},`
    : "Olá,";

  const subject = `[Artigen] Seu painel de parceiro está ativo (${params.partnerCode})`;
  const bodyHtml = `
    <p>${greeting}</p>
    <p>Sua conta de parceiro oficial do <strong>${escapeHtml(SITE_NAME)}</strong> foi ativada com sucesso!</p>
    <ul>
      <li><strong>Seu código de indicação:</strong> <code>${escapeHtml(params.partnerCode)}</code></li>
      <li><strong>Link exclusivo:</strong> <a href="${escapeHtml(refUrl)}">${escapeHtml(refUrl)}</a></li>
      <li><strong>Comissões oficiais:</strong> Starter 20% · Pro 35% · Agência 35% sobre o valor bruto da assinatura</li>
    </ul>
  `;
  const text = `${SITE_NAME} — Sua conta de parceiro foi ativada! Código: ${params.partnerCode}. Link: ${refUrl}.`;

  return sendTransactionalEmail({
    to: [params.partnerEmail],
    subject,
    html: wrapArtigenEmailLayout({
      subtitle: "Programa de Parceiros",
      title: "Conta de parceiro ativada!",
      bodyHtml,
      ctaLabel: "Abrir Painel do Parceiro",
      ctaPath: "/parceiro",
    }),
    text,
  });
}
