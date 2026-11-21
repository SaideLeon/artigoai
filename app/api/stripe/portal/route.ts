import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient as createSupabaseServerClient } from "@/utils/supabase/server";
import { getStripeClient, isStripeConfigured } from "@/lib/stripe";
import { getUserStripeCustomerId } from "@/lib/stripe-fulfillment";

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
        { erro: "Stripe não configurada no servidor." },
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
        { erro: "Inicie sessão para acessar o portal do cliente." },
        { status: 401 }
      );
    }

    const stripe = getStripeClient();
    let customerId = await getUserStripeCustomerId(user.id);

    if (!customerId && user.email) {
      const customers = await stripe.customers.list({
        email: user.email,
        limit: 1,
      });
      customerId = customers.data[0]?.id ?? null;
    }

    if (!customerId) {
      return NextResponse.json(
        {
          erro: "Nenhuma assinatura Stripe vinculada à sua conta ainda.",
        },
        { status: 404 }
      );
    }

    const baseUrl = resolveSafeBaseUrl(req);
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${baseUrl}/studio`,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (err) {
    console.error("Erro ao criar sessão do Portal Stripe:", err);
    return NextResponse.json(
      {
        erro:
          err instanceof Error
            ? err.message
            : "Não foi possível abrir o portal de assinaturas da Stripe.",
      },
      { status: 500 }
    );
  }
}
