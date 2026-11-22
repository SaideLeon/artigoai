import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient as createSupabaseServerClient } from "@/utils/supabase/server";
import {
  fetchCaktoOrderById,
  findSubscriptionPlan,
  isCaktoApiCredentialsConfigured,
  searchCaktoOrders,
  verifyCaktoAttributionToken,
  type CaktoOrderRecord,
} from "@/lib/cakto";
import {
  fulfillCaktoOrderOrEvent,
  getSupabaseAdminClient,
} from "@/lib/cakto-fulfillment";
import type { BillingCycle } from "@/lib/pricing";

const PAID_STATUSES = new Set([
  "paid",
  "approved",
  "completed",
  "confirmed",
  "active",
  "authorized",
]);

function orderBelongsToUser(
  order: CaktoOrderRecord,
  userId: string,
  userEmail?: string
): boolean {
  const sckRaw =
    order.sck ||
    order.tracking?.sck ||
    (typeof order.metadata?.sck === "string" ? order.metadata.sck : "");
  if (sckRaw) {
    const verified = verifyCaktoAttributionToken(sckRaw);
    if (verified) {
      return verified.userId === userId;
    }
  }

  const orderEmail = order.customer?.email?.trim().toLowerCase();
  if (orderEmail && userEmail) {
    return orderEmail === userEmail.trim().toLowerCase();
  }

  return false;
}

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createSupabaseServerClient(cookieStore);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { erro: "Sessão de utilizador necessária para confirmar o pagamento." },
        { status: 401 }
      );
    }

    const admin = getSupabaseAdminClient();
    if (admin) {
      const { data: currentSub } = await admin
        .from("subscriptions")
        .select("plan, billing_cycle, status")
        .eq("user_id", user.id)
        .maybeSingle();

      if (
        currentSub &&
        typeof currentSub.plan === "string" &&
        currentSub.plan !== "free" &&
        currentSub.status === "active"
      ) {
        const activePlan = findSubscriptionPlan(currentSub.plan);
        if (activePlan) {
          const cycle: BillingCycle =
            currentSub.billing_cycle === "yearly" ? "yearly" : "monthly";
          return NextResponse.json({
            paid: true,
            planId: activePlan.id,
            billingCycle: cycle,
            articlesPerMonth: activePlan.artigosMes,
            alreadyProcessed: true,
            dbUpdated: true,
          });
        }
      }
    }

    const orderId =
      req.nextUrl.searchParams.get("order_id")?.trim() ??
      req.nextUrl.searchParams.get("ref_id")?.trim() ??
      "";

    if (!isCaktoApiCredentialsConfigured()) {
      return NextResponse.json({
        paid: false,
        erro: "Aguardando confirmação automática via webhook da Cakto. Assim que o Pix ou cartão for aprovado, o plano ativa em segundos.",
      });
    }

    let matchedOrder: CaktoOrderRecord | null = null;

    if (orderId) {
      const byId = await fetchCaktoOrderById(orderId);
      if (byId) {
        if (!orderBelongsToUser(byId, user.id, user.email)) {
          return NextResponse.json(
            { erro: "Este pedido da Cakto pertence a outra conta." },
            { status: 403 }
          );
        }
        if (PAID_STATUSES.has((byId.status ?? "").toLowerCase())) {
          matchedOrder = byId;
        }
      }
    }

    if (!matchedOrder && user.email) {
      const orders = await searchCaktoOrders(user.email);
      matchedOrder =
        orders.find(
          (o) =>
            orderBelongsToUser(o, user.id, user.email) &&
            PAID_STATUSES.has((o.status ?? "").toLowerCase())
        ) ?? null;
    }

    if (!matchedOrder) {
      return NextResponse.json({
        paid: false,
        erro: "Pagamento Pix ou Cartão ainda pendente de confirmação na Cakto. Se acabou de pagar o Pix, aguarde alguns segundos e clique novamente.",
      });
    }

    const result = await fulfillCaktoOrderOrEvent({
      rawData: matchedOrder,
      explicitUserId: user.id,
      forceApproved: true,
    });

    if (!result.fulfilled) {
      return NextResponse.json({
        paid: false,
        erro:
          result.error ?? "Não foi possível ativar o plano para este pedido.",
      });
    }

    return NextResponse.json({
      paid: true,
      planId: result.planId,
      billingCycle: result.billingCycle,
      articlesPerMonth: result.articlesPerMonth,
      amountCents: result.amountCents,
      paymentMethod: result.paymentMethod,
      dbUpdated: result.dbUpdated,
      alreadyProcessed: result.alreadyProcessed,
    });
  } catch (err) {
    console.error("Erro ao verificar pagamento na Cakto:", err);
    return NextResponse.json(
      {
        erro:
          err instanceof Error
            ? err.message
            : "Falha ao verificar o pagamento na Cakto.",
      },
      { status: 500 }
    );
  }
}
