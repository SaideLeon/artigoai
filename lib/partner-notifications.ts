import { getSupabaseAdminClient } from "@/lib/cakto-fulfillment";
import { formatCentsBrl, getSupremeAdminEmail } from "@/lib/partners";
import { SITE_NAME, SITE_URL } from "@/lib/seo";

export type NotificationResult = {
  sent: boolean;
  provider: "resend" | "unconfigured";
  error?: string;
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getEmailConfig(): { apiKey: string; from: string } | null {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  if (!apiKey || !from) return null;
  return { apiKey, from };
}

export function isEmailServiceConfigured(): boolean {
  return Boolean(getEmailConfig());
}

async function sendTransactionalEmail(params: {
  to: string[];
  subject: string;
  html: string;
  text: string;
}): Promise<NotificationResult> {
  const recipients = Array.from(
    new Set(params.to.map((e) => e.trim()).filter((e) => e.includes("@")))
  );
  if (recipients.length === 0) {
    return { sent: false, provider: "unconfigured", error: "Sem destinatário." };
  }

  const config = getEmailConfig();
  if (!config) {
    console.info(
      `[Artigen Parceiros][E-mail pronto para envio — configure RESEND_API_KEY e EMAIL_FROM] Para: ${recipients.join(", ")} | Assunto: ${params.subject}`
    );
    return { sent: false, provider: "unconfigured" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: config.from,
        to: recipients,
        subject: params.subject,
        html: params.html,
        text: params.text,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error(
        `[Artigen Parceiros] Falha ao enviar e-mail via Resend (${res.status}): ${errText.slice(0, 200)}`
      );
      return {
        sent: false,
        provider: "resend",
        error: `HTTP ${res.status}`,
      };
    }

    return { sent: true, provider: "resend" };
  } catch (err) {
    console.error("[Artigen Parceiros] Erro de rede ao enviar e-mail:", err);
    return {
      sent: false,
      provider: "resend",
      error: "network_error",
    };
  }
}

function wrapEmailLayout(title: string, bodyHtml: string): string {
  const origin = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || SITE_URL).replace(
    /\/+$/,
    ""
  );
  return `
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background:#070B16; color:#E2E8F0; padding:32px 16px;">
    <div style="max-width:560px; margin:0 auto; background:#0F172A; border:1px solid #1E293B; border-radius:16px; padding:28px;">
      <p style="margin:0 0 8px; font-size:12px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:#818CF8;">
        ${escapeHtml(SITE_NAME)} · Programa de Parceiros
      </p>
      <h1 style="margin:0 0 16px; font-size:20px; font-weight:700; color:#FFFFFF;">
        ${escapeHtml(title)}
      </h1>
      <div style="font-size:14px; line-height:1.6; color:#CBD5E1;">
        ${bodyHtml}
      </div>
      <div style="margin-top:24px; padding-top:18px; border-top:1px solid #1E293B;">
        <a href="${escapeHtml(origin)}/parceiro" style="display:inline-block; background:#4F46E5; color:#FFFFFF; text-decoration:none; font-weight:600; font-size:13px; padding:10px 18px; border-radius:10px;">
          Abrir Painel do Parceiro
        </a>
      </div>
    </div>
  </div>`;
}

export async function notifyPartnerNewCommission(params: {
  partnerEmail: string;
  partnerName?: string;
  planId: string;
  tipo: "primeiro_pagamento" | "renovacao";
  valorComissaoCentavos: number;
  disponivelEmIso: string;
}): Promise<NotificationResult> {
  const valor = formatCentsBrl(params.valorComissaoCentavos);
  const tipoLabel =
    params.tipo === "renovacao" ? "Renovação de assinatura" : "Nova assinatura";
  const subject = `[Artigen] Nova comissão de ${valor} gerada`;
  const greeting = params.partnerName
    ? `Olá, ${escapeHtml(params.partnerName)},`
    : "Olá,";
  const bodyHtml = `
    <p>${greeting}</p>
    <p>Uma nova comissão foi registrada no seu painel de parceiro:</p>
    <ul>
      <li><strong>Evento:</strong> ${escapeHtml(tipoLabel)} (${escapeHtml(params.planId)})</li>
      <li><strong>Valor da comissão:</strong> ${escapeHtml(valor)}</li>
      <li><strong>Status inicial:</strong> Pendente (período de garantia até ${escapeHtml(new Date(params.disponivelEmIso).toLocaleDateString("pt-BR"))})</li>
    </ul>
  `;
  const text = `${SITE_NAME} — Nova comissão de ${valor} (${tipoLabel} - ${params.planId}). Fica disponível após o período de garantia em ${new Date(params.disponivelEmIso).toLocaleDateString("pt-BR")}.`;

  return sendTransactionalEmail({
    to: [params.partnerEmail],
    subject,
    html: wrapEmailLayout("Nova comissão registrada!", bodyHtml),
    text,
  });
}

export async function notifyPartnerWithdrawalRequested(params: {
  partnerEmail: string;
  valorCentavos: number;
  metodo: string;
}): Promise<NotificationResult> {
  const valor = formatCentsBrl(params.valorCentavos);
  const subject = `[Artigen] Pedido de saque de ${valor} recebido`;
  const bodyHtml = `
    <p>Recebemos sua solicitação de saque no valor de <strong>${escapeHtml(valor)}</strong> via <strong>${escapeHtml(params.metodo.toUpperCase())}</strong>.</p>
    <p>Seu pedido está com status <strong>Solicitado</strong> e passará pela conferência administrativa.</p>
  `;
  const text = `${SITE_NAME} — Seu pedido de saque de ${valor} (${params.metodo.toUpperCase()}) foi registrado e aguarda análise.`;

  return sendTransactionalEmail({
    to: [params.partnerEmail],
    subject,
    html: wrapEmailLayout("Pedido de saque solicitado", bodyHtml),
    text,
  });
}

export async function notifyAdminWithdrawalRequested(params: {
  partnerName: string;
  partnerEmail: string;
  partnerCode: string;
  valorCentavos: number;
  metodo: string;
  dadosPagamento: string;
}): Promise<NotificationResult> {
  const recipients = new Set<string>();
  const envSupremeAdmin = getSupremeAdminEmail();
  if (envSupremeAdmin) {
    recipients.add(envSupremeAdmin);
  }

  const admin = getSupabaseAdminClient();
  if (admin) {
    const { data: superAdmins } = await admin
      .from("profiles")
      .select("email")
      .eq("role", "superadmin");
    for (const row of superAdmins ?? []) {
      const email = String(row.email ?? "").trim().toLowerCase();
      if (email.includes("@")) {
        recipients.add(email);
      }
    }
  }

  const recipientList = Array.from(recipients);
  if (recipientList.length === 0) {
    return {
      sent: false,
      provider: "unconfigured",
      error: "Nenhum superadmin configurado.",
    };
  }
  const valor = formatCentsBrl(params.valorCentavos);
  const subject = `[Artigen Admin] Novo pedido de saque: ${valor} (${params.partnerCode})`;
  const bodyHtml = `
    <p>Um parceiro solicitou um novo saque:</p>
    <ul>
      <li><strong>Parceiro:</strong> ${escapeHtml(params.partnerName)} (${escapeHtml(params.partnerEmail)}) — código <code>${escapeHtml(params.partnerCode)}</code></li>
      <li><strong>Valor:</strong> ${escapeHtml(valor)}</li>
      <li><strong>Método:</strong> ${escapeHtml(params.metodo.toUpperCase())}</li>
      <li><strong>Dados informados:</strong> ${escapeHtml(params.dadosPagamento)}</li>
    </ul>
  `;
  const text = `${SITE_NAME} Admin — Novo saque de ${valor} solicitado por ${params.partnerName} (${params.partnerCode}).`;

  return sendTransactionalEmail({
    to: recipientList,
    subject,
    html: wrapEmailLayout("Novo pedido de saque para análise", bodyHtml),
    text,
  });
}

export async function notifyPartnerWithdrawalPaid(params: {
  partnerEmail: string;
  valorCentavos: number;
  comprovativoRef?: string | null;
  pagoEmIso: string;
}): Promise<NotificationResult> {
  const valor = formatCentsBrl(params.valorCentavos);
  const subject = `[Artigen] Saque de ${valor} pago!`;
  const refLine = params.comprovativoRef
    ? `<li><strong>Referência / Comprovativo:</strong> ${escapeHtml(params.comprovativoRef)}</li>`
    : "";
  const bodyHtml = `
    <p>O pagamento do seu saque foi concluído:</p>
    <ul>
      <li><strong>Valor pago:</strong> ${escapeHtml(valor)}</li>
      <li><strong>Data do pagamento:</strong> ${escapeHtml(new Date(params.pagoEmIso).toLocaleDateString("pt-BR"))}</li>
      ${refLine}
    </ul>
  `;
  const text = `${SITE_NAME} — Seu saque de ${valor} foi marcado como pago em ${new Date(params.pagoEmIso).toLocaleDateString("pt-BR")}.`;

  return sendTransactionalEmail({
    to: [params.partnerEmail],
    subject,
    html: wrapEmailLayout("Saque pago com sucesso!", bodyHtml),
    text,
  });
}

export async function notifyPartnerWithdrawalRefused(params: {
  partnerEmail: string;
  valorCentavos: number;
  motivo: string;
}): Promise<NotificationResult> {
  const valor = formatCentsBrl(params.valorCentavos);
  const subject = `[Artigen] Pedido de saque de ${valor} recusado`;
  const bodyHtml = `
    <p>Seu pedido de saque no valor de <strong>${escapeHtml(params.valorCentavos ? valor : "")}</strong> foi recusado pela administração.</p>
    <p><strong>Motivo informado:</strong> ${escapeHtml(params.motivo)}</p>
    <p>As comissões correspondentes voltaram automaticamente para o seu <strong>Saldo disponível</strong> para nova solicitação.</p>
  `;
  const text = `${SITE_NAME} — Pedido de saque de ${valor} recusado. Motivo: ${params.motivo}. O valor voltou para seu saldo disponível.`;

  return sendTransactionalEmail({
    to: [params.partnerEmail],
    subject,
    html: wrapEmailLayout("Pedido de saque recusado", bodyHtml),
    text,
  });
}
