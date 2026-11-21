import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripeClient, isStripeConfigured } from "@/lib/stripe";
import {
  fulfillSubscriptionCheckoutSession,
  handleStripeInvoicePaid,
  handleStripeInvoicePaymentFailed,
  handleStripeSubscriptionDeleted,
  handleStripeSubscriptionUpdated,
} from "@/lib/stripe-fulfillment";

export async function POST(req: NextRequest) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { erro: "Stripe não configurada." },
      { status: 503 }
    );
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!webhookSecret) {
    return NextResponse.json(
      { erro: "STRIPE_WEBHOOK_SECRET não configurada no servidor." },
      { status: 503 }
    );
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json(
      { erro: "Cabeçalho stripe-signature ausente." },
      { status: 400 }
    );
  }

  const stripe = getStripeClient();
  let event: Stripe.Event;
  try {
    const rawBody = await req.text();
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error("Assinatura de webhook Stripe inválida:", err);
    return NextResponse.json(
      { erro: "Assinatura Stripe inválida." },
      { status: 400 }
    );
  }

  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object as Stripe.Checkout.Session;
      await fulfillSubscriptionCheckoutSession(session, stripe);
      break;
    }
    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      await handleStripeInvoicePaid(invoice, stripe);
      break;
    }
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      await handleStripeInvoicePaymentFailed(invoice, stripe);
      break;
    }
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      await handleStripeSubscriptionUpdated(sub);
      break;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      await handleStripeSubscriptionDeleted(sub);
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
