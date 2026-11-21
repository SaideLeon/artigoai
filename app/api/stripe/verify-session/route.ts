import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient as createSupabaseServerClient } from "@/utils/supabase/server";
import { getStripeClient, isStripeConfigured } from "@/lib/stripe";
import { fulfillSubscriptionCheckoutSession } from "@/lib/stripe-fulfillment";

export async function GET(req: NextRequest) {
  try {
    if (!isStripeConfigured()) {
      return NextResponse.json(
        { erro: "Stripe não configurada no servidor." },
        { status: 503 }
      );
    }

    const sessionId = req.nextUrl.searchParams.get("session_id")?.trim() ?? "";
    if (!/^cs_(test|live)_[a-zA-Z0-9]+$/.test(sessionId)) {
      return NextResponse.json(
        { erro: "Identificador de sessão Stripe inválido." },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const supabase = createSupabaseServerClient(cookieStore);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { erro: "Sessão de utilizador necessária para confirmar a assinatura." },
        { status: 401 }
      );
    }

    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.metadata?.user_id && session.metadata.user_id !== user.id) {
      return NextResponse.json(
        { erro: "Esta sessão de assinatura pertence a outra conta." },
        { status: 403 }
      );
    }

    if (session.payment_status !== "paid" && session.status !== "complete") {
      return NextResponse.json({
        paid: false,
        status: session.payment_status,
        erro: "Assinatura ainda pendente de confirmação.",
      });
    }

    const result = await fulfillSubscriptionCheckoutSession(session, stripe);

    return NextResponse.json({
      paid: true,
      planId: result.planId,
      billingCycle: result.billingCycle,
      articlesPerMonth: result.articlesPerMonth,
      amountCents: result.amountCents,
      dbUpdated: result.dbUpdated,
      alreadyProcessed: result.alreadyProcessed,
    });
  } catch (err) {
    console.error("Erro ao verificar assinatura Stripe:", err);
    return NextResponse.json(
      {
        erro:
          err instanceof Error
            ? err.message
            : "Falha ao verificar a assinatura na Stripe.",
      },
      { status: 500 }
    );
  }
}
