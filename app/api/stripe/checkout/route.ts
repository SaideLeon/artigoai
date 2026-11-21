import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient as createSupabaseServerClient } from "@/utils/supabase/server";
import {
  findSubscriptionPlan,
  getStripeClient,
  getSubscriptionAmountCents,
  isStripeConfigured,
} from "@/lib/stripe";
import { getUserStripeCustomerId } from "@/lib/stripe-fulfillment";
import type { BillingCycle } from "@/lib/pricing";

function resolveSafeBaseUrl(req: NextRequest): string {
  const forwardedHost = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || req.headers.get("host")?.split(",")[0]?.trim();
  const protoHeader = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const proto = protoHeader === "http" ? "http" : "https";

  if (host && /^[a-zA-Z0-9.-]+(:\d{1,5})?$/.test(host)) {
    const scheme =
      host.startsWith("localhost") || host.startsWith("127.0.0.1")
        ? protoHeader || "http"
        : proto;
    return `${scheme}://${host}`;
  }

  return new URL(req.url).origin;
}

export async function POST(req: NextRequest) {
  try {
    if (!isStripeConfigured()) {
      return NextResponse.json(
        {
          erro: "Pagamento Stripe ainda não configurado no servidor (defina STRIPE_SECRET_KEY).",
          stripeConfigured: false,
        },
        { status: 503 }
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
        {
          erro: "Inicie sessão com sua conta Google antes de assinar um plano na Stripe.",
          requiresAuth: true,
        },
        { status: 401 }
      );
    }

    const body = (await req.json()) as {
      planId?: unknown;
      billingCycle?: unknown;
    };

    const planId = typeof body.planId === "string" ? body.planId.trim() : "";
    const plan = findSubscriptionPlan(planId);
    if (!plan) {
      return NextResponse.json(
        { erro: "Plano selecionado inválido." },
        { status: 400 }
      );
    }

    const billingCycle: BillingCycle =
      body.billingCycle === "yearly" ? "yearly" : "monthly";
    const unitAmount = getSubscriptionAmountCents(plan, billingCycle);
    const interval = billingCycle === "yearly" ? "year" : "month";
    const baseUrl = resolveSafeBaseUrl(req);
    const stripe = getStripeClient();

    const existingCustomerId = await getUserStripeCustomerId(user.id);

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      ...(existingCustomerId
        ? { customer: existingCustomerId }
        : { customer_email: user.email ?? undefined }),
      client_reference_id: user.id,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "brl",
            unit_amount: unitAmount,
            recurring: {
              interval,
            },
            product_data: {
              name: `Artigen — Plano ${plan.nome} (${
                billingCycle === "yearly" ? "Anual" : "Mensal"
              })`,
              description: `${plan.artigosMes} artigos por mês (~2.500 palavras cada), até 7 imagens 1K com Google Gemini, pesquisa web e HTML. Cancele quando quiser.`,
            },
          },
        },
      ],
      subscription_data: {
        metadata: {
          user_id: user.id,
          plan_id: plan.id,
          billing_cycle: billingCycle,
          monthly_limit: String(plan.artigosMes),
        },
      },
      metadata: {
        user_id: user.id,
        plan_id: plan.id,
        billing_cycle: billingCycle,
        monthly_limit: String(plan.artigosMes),
      },
      success_url: `${baseUrl}/studio?stripe=success&session_id={CHECKOUT_SESSION_ID}&plano=${encodeURIComponent(
        plan.id
      )}`,
      cancel_url: `${baseUrl}/studio?stripe=cancel&plano=${encodeURIComponent(
        plan.id
      )}`,
    });

    if (!session.url) {
      return NextResponse.json(
        { erro: "A Stripe não retornou uma URL de checkout." },
        { status: 502 }
      );
    }

    return NextResponse.json({
      url: session.url,
      sessionId: session.id,
    });
  } catch (err) {
    console.error("Erro ao criar assinatura Stripe Checkout:", err);
    return NextResponse.json(
      {
        erro:
          err instanceof Error
            ? err.message
            : "Não foi possível iniciar o checkout de assinatura na Stripe.",
      },
      { status: 500 }
    );
  }
}
