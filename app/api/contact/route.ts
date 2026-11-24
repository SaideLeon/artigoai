import { NextRequest, NextResponse } from "next/server";
import {
  DEFAULT_CONTACT_TO_EMAIL,
  isValidEmailAddress,
  sanitizeHeaderField,
  sendContactInquiryEmail,
} from "@/lib/email";

export async function POST(req: NextRequest) {
  let body: {
    nome?: unknown;
    email?: unknown;
    assunto?: unknown;
    mensagem?: unknown;
  } = {};

  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { erro: "Corpo JSON inválido." },
      { status: 400 }
    );
  }

  const nome =
    typeof body.nome === "string" ? sanitizeHeaderField(body.nome) : "";
  const email =
    typeof body.email === "string"
      ? sanitizeHeaderField(body.email).toLowerCase()
      : "";
  const assunto =
    typeof body.assunto === "string"
      ? sanitizeHeaderField(body.assunto)
      : "Dúvida geral";
  const mensagem =
    typeof body.mensagem === "string" ? body.mensagem.trim() : "";

  if (nome.length < 2 || nome.length > 120) {
    return NextResponse.json(
      { erro: "Informe seu nome completo (entre 2 e 120 caracteres)." },
      { status: 400 }
    );
  }

  if (!isValidEmailAddress(email)) {
    return NextResponse.json(
      { erro: "Informe um endereço de e-mail válido." },
      { status: 400 }
    );
  }

  if (assunto.length < 2 || assunto.length > 120) {
    return NextResponse.json(
      { erro: "Selecione ou informe um assunto válido." },
      { status: 400 }
    );
  }

  if (mensagem.length < 10 || mensagem.length > 3000) {
    return NextResponse.json(
      { erro: "Escreva uma mensagem entre 10 e 3000 caracteres." },
      { status: 400 }
    );
  }

  const result = await sendContactInquiryEmail({
    nome,
    email,
    assunto,
    mensagem,
  });

  if (result.provider === "unconfigured") {
    return NextResponse.json(
      {
        erro: `O envio automático de e-mails está pendente de configuração (RESEND_API_KEY). Enquanto isso, escreva para ${DEFAULT_CONTACT_TO_EMAIL}.`,
      },
      { status: 503 }
    );
  }

  if (!result.sent) {
    return NextResponse.json(
      {
        erro: `Não foi possível enviar sua mensagem agora (${result.error || "falha no serviço de e-mail"}). Tente novamente ou escreva para ${DEFAULT_CONTACT_TO_EMAIL}.`,
      },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    id: result.id ?? null,
    mensagem: "Mensagem enviada com sucesso! Responderemos em breve.",
  });
}
