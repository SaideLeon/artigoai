import {
  escapeHtml,
  isEmailServiceConfigured as isResendConfigured,
  resolveAdminAndSupportRecipients,
  sendTransactionalEmail,
  wrapArtigenEmailLayout,
  type EmailSendResult,
} from "@/lib/email";
import { formatCentsBrl } from "@/lib/partners";
import { SITE_NAME } from "@/lib/seo";

export type NotificationResult = EmailSendResult;

export function isEmailServiceConfigured(): boolean {
  return isResendConfigured();
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
    html: wrapArtigenEmailLayout({
      subtitle: "Programa de Parceiros",
      title: "Nova comissão registrada!",
      bodyHtml,
      ctaLabel: "Abrir Painel do Parceiro",
      ctaPath: "/parceiro",
    }),
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
    html: wrapArtigenEmailLayout({
      subtitle: "Programa de Parceiros",
      title: "Pedido de saque solicitado",
      bodyHtml,
      ctaLabel: "Acompanhar no Painel",
      ctaPath: "/parceiro",
    }),
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
  const recipientList = await resolveAdminAndSupportRecipients();
  if (recipientList.length === 0) {
    return {
      sent: false,
      provider: "unconfigured",
      error: "Nenhum destinatário administrativo configurado.",
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
    html: wrapArtigenEmailLayout({
      subtitle: "Administração de Parceiros",
      title: "Novo pedido de saque para análise",
      bodyHtml,
      ctaLabel: "Abrir Painel Admin",
      ctaPath: "/admin/parceiros",
    }),
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
    html: wrapArtigenEmailLayout({
      subtitle: "Programa de Parceiros",
      title: "Saque pago com sucesso!",
      bodyHtml,
      ctaLabel: "Ver Histórico de Saques",
      ctaPath: "/parceiro",
    }),
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
    html: wrapArtigenEmailLayout({
      subtitle: "Programa de Parceiros",
      title: "Pedido de saque recusado",
      bodyHtml,
      ctaLabel: "Abrir Painel do Parceiro",
      ctaPath: "/parceiro",
    }),
    text,
  });
}
