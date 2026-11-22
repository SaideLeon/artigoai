import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient as createSupabaseServerClient } from "@/utils/supabase/server";
import {
  CAKTO_BUYER_PORTAL_URL,
  cancelCaktoSubscription,
  isCaktoApiCredentialsConfigured,
} from "@/lib/cakto";
import {
  getUserCaktoSubscriptionInfo,
  handleCaktoSubscriptionCanceledOrRefunded,
} from "@/lib/cakto-fulfillment";

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createSupabaseServerClient(cookieStore);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { erro: "Inicie sessão para gerir ou cancelar a sua assinatura." },
        { status: 401 }
      );
    }

    let action: "portal" | "cancel" = "portal";
    try {
      const body = (await req.json()) as { action?: unknown };
      if (body?.action === "cancel") {
        action = "cancel";
      }
    } catch {
      // Corpo vazio significa ação padrão "portal"
    }

    const subInfo = await getUserCaktoSubscriptionInfo(user.id);

    if (action === "cancel") {
      if (
        subInfo.caktoSubscriptionId &&
        !subInfo.caktoSubscriptionId.startsWith("cakto_ord:") &&
        isCaktoApiCredentialsConfigured()
      ) {
        try {
          await cancelCaktoSubscription(subInfo.caktoSubscriptionId);
          await handleCaktoSubscriptionCanceledOrRefunded({
            customer: { email: user.email ?? subInfo.customerEmail ?? "" },
          });
          return NextResponse.json({
            canceled: true,
            url: CAKTO_BUYER_PORTAL_URL,
            message:
              "Assinatura cancelada na Cakto e plano revertido para o Grátis.",
          });
        } catch (apiErr) {
          console.error("Erro ao cancelar assinatura via API Cakto:", apiErr);
        }
      }

      return NextResponse.json({
        canceled: false,
        url: CAKTO_BUYER_PORTAL_URL,
        customerEmail: user.email ?? subInfo.customerEmail,
        message:
          "Acesse o Portal do Assinante Cakto com o seu e-mail de compra para cancelar diretamente.",
      });
    }

    return NextResponse.json({
      url: CAKTO_BUYER_PORTAL_URL,
      customerEmail: user.email ?? subInfo.customerEmail,
      hasPaidPlan: subInfo.plan !== "free" && subInfo.status === "active",
    });
  } catch (err) {
    console.error("Erro ao abrir portal de assinaturas Cakto:", err);
    return NextResponse.json(
      {
        erro:
          err instanceof Error
            ? err.message
            : "Não foi possível abrir o portal de assinaturas da Cakto.",
      },
      { status: 500 }
    );
  }
}
