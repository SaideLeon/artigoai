import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient as createSupabaseServerClient } from "@/utils/supabase/server";
import {
  findPricingTier,
  getStripeAmountCents,
  getStripeClient,
  isStripeConfigured,
} from "@/lib/stripe";
import type { CurrencyCode } from "@/lib/pricing";

function resolveSafeBaseUrl(req: NextRequest): string {
  const forwardedHost = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || req.headers.get("host")?.split(",")[0]?.trim();
  const protoHeader = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const proto = protoHeader === "http" ? "http" : "https";

  if (host && /^[a-zA-Z0-9.-]+(:\d{1,5})?$/.test(host)) {
    const scheme = host.startsWith("localhost") || host.startsWith("127.0.0.1")
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
          erro: "Inicie sessão com sua conta Google antes de concluir o pagamento na Stripe.",
          requiresAuth: true,
        },
        { status: 401 }
      );
    }

    const body = (await req.json()) as {
      packageId?: unknown;
      currency?: unknown;
    };

    const packageId = typeof body.packageId === "string" ? body.packageId.trim() : "";
    const tier = findPricingTier(packageId);
    if (!tier) {
      return NextResponse.json(
        { erro: "Pacote selecionado inválido." },
        { status: 400 }
      );
    }

    const currency: CurrencyCode = body.currency === "USD" ? "USD" : "BRL";
    const unitAmount = getStripeAmountCents(tier, currency);
    const baseUrl = resolveSafeBaseUrl(req);
    const stripe = getStripeClient();

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: user.email ?? undefined,
      client_reference_id: user.id,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: currency.toLowerCase(),
            unit_amount: unitAmount,
            product_data: {
              name: `Artigen — ${tier.nome}`,
              description: `${tier.artigos} ${
                tier.artigos === 1 ? "crédito de artigo" : "créditos de artigo"
              } com geração Google Gemini (~2.500 palavras e até 7 imagens 1K)`,
            },
          },
        },
      ],
      metadata: {
        user_id: user.id,
        package_id: tier.id,
        articles_granted: String(tier.artigos),
        currency,
      },
      success_url: `${baseUrl}/studio?stripe=success&session_id={CHECKOUT_SESSION_ID}&pacote=${encodeURIComponent(
        tier.id
      )}`,
      cancel_url: `${baseUrl}/studio?stripe=cancel&pacote=${encodeURIComponent(
        tier.id
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
    console.error("Erro ao criar sessão Stripe Checkout:", err);
    return NextResponse.json(
      {
        erro:
          err instanceof Error
            ? err.message
            : "Não foi possível iniciar o checkout da Stripe.",
      },
      { status: 500 }
    );
  }
}
