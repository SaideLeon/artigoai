import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { ingestInboundResendEmail } from "@/lib/admin-inbox";
import { getSupabaseAdminClient } from "@/lib/cakto-fulfillment";
import { getResendApiKey } from "@/lib/email";

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET?.trim();
  if (!webhookSecret) {
    return NextResponse.json(
      { erro: "RESEND_WEBHOOK_SECRET não configurado no servidor." },
      { status: 503 }
    );
  }

  const rawBody = await req.text();
  const svixId = req.headers.get("svix-id") ?? "";
  const svixTimestamp = req.headers.get("svix-timestamp") ?? "";
  const svixSignature = req.headers.get("svix-signature") ?? "";

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json(
      { erro: "Cabeçalhos de assinatura do webhook ausentes." },
      { status: 400 }
    );
  }

  const apiKey = getResendApiKey() ?? "re_webhook_verify";
  const resend = new Resend(apiKey);

  let event: ReturnType<typeof resend.webhooks.verify>;
  try {
    event = resend.webhooks.verify({
      payload: rawBody,
      headers: {
        id: svixId,
        timestamp: svixTimestamp,
        signature: svixSignature,
      },
      webhookSecret,
    });
  } catch {
    return NextResponse.json(
      { erro: "Assinatura do webhook Resend inválida." },
      { status: 400 }
    );
  }

  if (event.type !== "email.received") {
    return NextResponse.json({ ok: true, ignored: event.type });
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json(
      { erro: "Supabase admin não configurado." },
      { status: 503 }
    );
  }

  const data = event.data;
  const emailId = data.email_id;
  let fullEmail: Parameters<typeof ingestInboundResendEmail>[1] = {
    id: emailId,
    from: data.from,
    to: data.to,
    cc: data.cc,
    subject: data.subject,
    created_at: data.created_at,
    message_id: data.message_id,
    attachments: data.attachments,
  };

  if (getResendApiKey()) {
    try {
      const detail = await resend.emails.receiving.get(emailId);
      if (detail.data) {
        fullEmail = {
          id: detail.data.id,
          from: detail.data.from,
          to: detail.data.to,
          cc: detail.data.cc,
          reply_to: detail.data.reply_to,
          subject: detail.data.subject,
          text: detail.data.text,
          html: detail.data.html,
          created_at: detail.data.created_at,
          message_id: detail.data.message_id,
          headers: detail.data.headers,
          attachments: detail.data.attachments,
        };
      }
    } catch {
      // Mantém metadados do evento se o fetch detalhado falhar temporariamente
    }
  }

  try {
    const result = await ingestInboundResendEmail(admin, fullEmail);
    return NextResponse.json({
      ok: true,
      inserted: result.inserted,
      threadId: result.threadId ?? null,
    });
  } catch (err) {
    return NextResponse.json(
      {
        erro:
          err instanceof Error
            ? err.message
            : "Erro ao armazenar e-mail recebido.",
      },
      { status: 500 }
    );
  }
}
