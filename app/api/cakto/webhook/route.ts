import { NextRequest, NextResponse } from "next/server";
import { constantTimeCompare } from "@/lib/cakto";
import {
  fulfillCaktoOrderOrEvent,
  handleCaktoSubscriptionCanceledOrRefunded,
  handleCaktoSubscriptionLate,
  type CaktoWebhookPayload,
} from "@/lib/cakto-fulfillment";

export async function POST(req: NextRequest) {
  const expectedSecret = process.env.CAKTO_WEBHOOK_SECRET?.trim();
  if (!expectedSecret) {
    return NextResponse.json(
      { erro: "CAKTO_WEBHOOK_SECRET não configurada no servidor." },
      { status: 503 }
    );
  }

  let payload: CaktoWebhookPayload;
  try {
    payload = (await req.json()) as CaktoWebhookPayload;
  } catch {
    return NextResponse.json(
      { erro: "Corpo JSON do webhook Cakto inválido." },
      { status: 400 }
    );
  }

  const incomingSecret =
    typeof payload?.secret === "string"
      ? payload.secret.trim()
      : req.headers.get("x-cakto-secret")?.trim() ?? "";

  if (!incomingSecret || !constantTimeCompare(incomingSecret, expectedSecret)) {
    return NextResponse.json(
      { erro: "Segredo de webhook Cakto inválido." },
      { status: 401 }
    );
  }

  const eventType =
    typeof payload.event === "string" ? payload.event.trim().toLowerCase() : "";
  const data =
    payload.data && typeof payload.data === "object" && !Array.isArray(payload.data)
      ? payload.data
      : null;

  if (!data) {
    return NextResponse.json({ received: true });
  }

  let fulfilled = false;
  let alreadyProcessed = false;
  let reason: string | undefined;

  try {
    switch (eventType) {
      case "purchase_approved":
      case "subscription_renewed": {
        const result = await fulfillCaktoOrderOrEvent({
          rawData: data,
          eventType,
        });
        fulfilled = result.fulfilled;
        alreadyProcessed = result.alreadyProcessed;
        reason = result.error;
        break;
      }
      case "subscription_late": {
        await handleCaktoSubscriptionLate(data);
        break;
      }
      case "subscription_canceled":
      case "refund":
      case "chargeback": {
        await handleCaktoSubscriptionCanceledOrRefunded(data);
        break;
      }
      case "pix_gerado":
      case "boleto_gerado":
      case "purchase_refused":
      default:
        break;
    }
  } catch (err) {
    console.error("Erro ao processar evento de webhook Cakto:", err);
  }

  // Cakto recomenda responder 200 rapidamente (<= 8s) para evitar retentativas desnecessárias
  return NextResponse.json({
    received: true,
    event: eventType,
    fulfilled,
    alreadyProcessed,
    ...(reason ? { reason } : {}),
  });
}
