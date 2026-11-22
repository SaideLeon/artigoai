import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient as createSupabaseServerClient } from "@/utils/supabase/server";
import {
  buildCaktoCheckoutUrl,
  findSubscriptionPlan,
  isCaktoConfigured,
  resolveCaktoOfferId,
} from "@/lib/cakto";
import type { BillingCycle } from "@/lib/pricing";

export async function POST(req: NextRequest) {
  try {
    if (!isCaktoConfigured()) {
      return NextResponse.json(
        {
          erro: "Pagamento via Cakto ainda não configurado no servidor (defina CAKTO_CLIENT_ID / CAKTO_CLIENT_SECRET e os IDs de oferta CAKTO_OFFER_*).",
          caktoConfigured: false,
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
          erro: "Inicie sessão com sua conta Google antes de assinar um plano via Pix ou Cartão na Cakto.",
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

    const offerId = await resolveCaktoOfferId(plan, billingCycle);
    if (!offerId) {
      const envHint = `CAKTO_OFFER_${plan.id.toUpperCase()}_${billingCycle.toUpperCase()}`;
      return NextResponse.json(
        {
          erro: `Oferta da Cakto para o plano ${plan.nome} (${
            billingCycle === "yearly" ? "Anual" : "Mensal"
          }) não configurada. Defina ${envHint} ou crie a oferta correspondente no painel Cakto.`,
        },
        { status: 503 }
      );
    }

    const fullName =
      typeof user.user_metadata?.full_name === "string"
        ? user.user_metadata.full_name
        : typeof user.user_metadata?.name === "string"
        ? user.user_metadata.name
        : user.email?.split("@")[0] ?? null;

    const { url, trackingToken } = buildCaktoCheckoutUrl({
      offerId,
      userId: user.id,
      planId: plan.id,
      billingCycle,
      email: user.email,
      name: fullName,
    });

    return NextResponse.json({
      url,
      offerId,
      trackingToken,
      planId: plan.id,
      billingCycle,
    });
  } catch (err) {
    console.error("Erro ao iniciar checkout na Cakto:", err);
    return NextResponse.json(
      {
        erro:
          err instanceof Error
            ? err.message
            : "Não foi possível iniciar o checkout da Cakto.",
      },
      { status: 500 }
    );
  }
}
