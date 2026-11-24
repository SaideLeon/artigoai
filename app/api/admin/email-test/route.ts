import { NextRequest, NextResponse } from "next/server";
import {
  escapeHtml,
  getEmailServiceSummary,
  isValidEmailAddress,
  sanitizeHeaderField,
  sendTransactionalEmail,
  wrapArtigenEmailLayout,
} from "@/lib/email";
import { requirePartnerAdmin } from "@/lib/partners-server";

export async function GET() {
  const auth = await requirePartnerAdmin();
  if (!auth.ok) {
    return NextResponse.json({ erro: auth.error }, { status: auth.status });
  }

  return NextResponse.json({
    ok: true,
    emailService: getEmailServiceSummary(),
  });
}

export async function POST(req: NextRequest) {
  const auth = await requirePartnerAdmin();
  if (!auth.ok) {
    return NextResponse.json({ erro: auth.error }, { status: auth.status });
  }

  let body: { to?: unknown } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    body = {};
  }

  const requestedTo =
    typeof body.to === "string"
      ? sanitizeHeaderField(body.to).toLowerCase()
      : "";
  const targetEmail = requestedTo || (auth.user.email ?? "").trim().toLowerCase();

  if (!isValidEmailAddress(targetEmail)) {
    return NextResponse.json(
      { erro: "Informe um e-mail de destino válido para o teste." },
      { status: 400 }
    );
  }

  const summary = getEmailServiceSummary();
  const sentAt = new Date().toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
  });

  const result = await sendTransactionalEmail({
    to: [targetEmail],
    subject: `[Artigen] Teste de entrega Resend (${summary.domain})`,
    html: wrapArtigenEmailLayout({
      subtitle: "Diagnóstico de E-mail · Resend",
      title: "Entrega via Resend validada com sucesso!",
      bodyHtml: `
        <p>Este é um e-mail de teste disparado diretamente pelo painel do Administrador Supremo do Artigen.</p>
        <ul>
          <li><strong>Remetente:</strong> ${escapeHtml(summary.from)}</li>
          <li><strong>Domínio:</strong> ${escapeHtml(summary.domain)}</li>
          <li><strong>Destinatário:</strong> ${escapeHtml(targetEmail)}</li>
          <li><strong>Horário (BRT):</strong> ${escapeHtml(sentAt)}</li>
        </ul>
      `,
      ctaLabel: "Voltar ao Painel Admin",
      ctaPath: "/admin/parceiros",
    }),
    text: `Artigen — Teste de entrega Resend validado! Remetente: ${summary.from}. Destinatário: ${targetEmail}. Data/Hora (BRT): ${sentAt}.`,
  });

  if (result.provider === "unconfigured") {
    return NextResponse.json(
      {
        erro: "RESEND_API_KEY não configurada no servidor.",
        emailService: summary,
      },
      { status: 503 }
    );
  }

  if (!result.sent) {
    return NextResponse.json(
      {
        erro: `Falha no envio via Resend: ${result.error || "erro desconhecido"}`,
        emailService: summary,
      },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    id: result.id ?? null,
    to: targetEmail,
    emailService: summary,
  });
}
