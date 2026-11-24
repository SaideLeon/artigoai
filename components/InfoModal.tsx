"use client";

import { useState } from "react";
import Link from "next/link";
import {
  X,
  Package,
  Check,
  HelpCircle,
  CreditCard,
  Loader2,
  AlertCircle,
  LogIn,
  ExternalLink,
  ShieldCheck,
  Settings2,
  QrCode,
  RefreshCw,
} from "lucide-react";
import { motion } from "motion/react";
import BrandLogo from "@/components/BrandLogo";
import { useAuth } from "@/components/AuthProvider";
import {
  FREE_PLAN,
  SUBSCRIPTION_PLANS,
  formatBrl,
  getPlanDisplayName,
  type BillingCycle,
} from "@/lib/pricing";
import type { PlanoGeracao } from "@/lib/types";

type InfoModalProps = {
  tipo: "upgrade" | "ajuda" | "sobre" | null;
  onClose: () => void;
  planoGeracao?: PlanoGeracao;
  onSelectPlanoGeracao?: (plano: PlanoGeracao) => void;
  activePlanId?: string;
  monthlyLimit?: number;
  monthlyUsed?: number;
  monthlyImagesLimit?: number;
  monthlyImagesUsed?: number;
  hasSubscriptionPortal?: boolean;
  highlightPlanId?: string | null;
  initialBillingCycle?: BillingCycle;
  onPaymentConfirmed?: (payload: {
    planId: string;
    articlesPerMonth: number;
  }) => void;
};

export default function InfoModal({
  tipo,
  onClose,
  planoGeracao = "free",
  onSelectPlanoGeracao,
  activePlanId = "free",
  monthlyLimit = FREE_PLAN.artigosMes,
  monthlyUsed = 0,
  monthlyImagesLimit = FREE_PLAN.imagensMes,
  monthlyImagesUsed = 0,
  hasSubscriptionPortal = false,
  highlightPlanId = null,
  initialBillingCycle = "monthly",
  onPaymentConfirmed,
}: InfoModalProps) {
  const { user, signInWithGoogle } = useAuth();
  const [billingCycle, setBillingCycle] =
    useState<BillingCycle>(initialBillingCycle);
  const [loadingPlanId, setLoadingPlanId] = useState<string | null>(null);
  const [openingPortal, setOpeningPortal] = useState(false);
  const [verifyingPayment, setVerifyingPayment] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [pixInfoMessage, setPixInfoMessage] = useState<string | null>(null);
  const [needsAuthPrompt, setNeedsAuthPrompt] = useState(false);
  const [checkoutRedirectUrl, setCheckoutRedirectUrl] = useState<string | null>(
    null
  );

  if (!tipo) return null;

  async function handleSubscribeCakto(planId: string) {
    setCheckoutError(null);
    setPixInfoMessage(null);
    setNeedsAuthPrompt(false);
    setCheckoutRedirectUrl(null);

    if (!user) {
      setNeedsAuthPrompt(true);
      return;
    }

    setLoadingPlanId(planId);
    try {
      const res = await fetch("/api/cakto/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, billingCycle }),
      });
      const data = (await res.json()) as {
        url?: string;
        erro?: string;
        requiresAuth?: boolean;
      };

      if (!res.ok || !data.url) {
        if (data.requiresAuth) {
          setNeedsAuthPrompt(true);
        } else {
          setCheckoutError(
            data.erro ?? "Não foi possível iniciar o checkout na Cakto."
          );
        }
        return;
      }

      setCheckoutRedirectUrl(data.url);
      window.location.assign(data.url);
    } catch {
      setCheckoutError(
        "Falha de ligação ao iniciar o checkout Pix/Cartão da Cakto."
      );
    } finally {
      setLoadingPlanId(null);
    }
  }

  async function handleVerifyPixOrPayment() {
    setCheckoutError(null);
    setPixInfoMessage(null);
    if (!user) {
      setNeedsAuthPrompt(true);
      return;
    }

    setVerifyingPayment(true);
    try {
      const res = await fetch("/api/cakto/verify-order");
      const data = (await res.json()) as {
        paid?: boolean;
        planId?: string;
        articlesPerMonth?: number;
        erro?: string;
      };
      if (res.ok && data.paid && data.planId) {
        const limit = data.articlesPerMonth ?? FREE_PLAN.artigosMes;
        onPaymentConfirmed?.({ planId: data.planId, articlesPerMonth: limit });
        setPixInfoMessage(
          `Pagamento confirmado! Plano ${getPlanDisplayName(
            data.planId
          )} (${limit} artigos/mês) ativado.`
        );
      } else {
        setPixInfoMessage(
          data.erro ??
            "Pagamento ainda não compensado. Assim que o Pix for concluído, clique novamente ou recarregue a página."
        );
      }
    } catch {
      setCheckoutError("Não foi possível consultar o status do pagamento na Cakto.");
    } finally {
      setVerifyingPayment(false);
    }
  }

  async function handleOpenCustomerPortal() {
    setCheckoutError(null);
    setPixInfoMessage(null);
    setCheckoutRedirectUrl(null);
    if (!user) {
      setNeedsAuthPrompt(true);
      return;
    }

    setOpeningPortal(true);
    try {
      const res = await fetch("/api/cakto/portal", { method: "POST" });
      const data = (await res.json()) as { url?: string; erro?: string };
      if (!res.ok || !data.url) {
        setCheckoutError(
          data.erro ?? "Não foi possível abrir o Portal do Assinante Cakto."
        );
        return;
      }
      setCheckoutRedirectUrl(data.url);
      window.location.assign(data.url);
    } catch {
      setCheckoutError("Falha ao comunicar com o portal de assinaturas da Cakto.");
    } finally {
      setOpeningPortal(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.16 }}
        onClick={(e) => e.stopPropagation()}
        className={`flex max-h-[90vh] w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900 ${
          tipo === "upgrade" ? "max-w-3xl" : "max-w-lg"
        }`}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-6 py-4 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            {tipo === "upgrade" && (
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-950/70 dark:text-amber-400">
                <Package className="h-5 w-5" />
              </span>
            )}
            {tipo === "ajuda" && (
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 dark:bg-indigo-950/70 dark:text-indigo-400">
                <HelpCircle className="h-5 w-5" />
              </span>
            )}
            {tipo === "sobre" && (
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#5B4AF4] to-[#2563EB] text-white shadow-xs">
                <BrandLogo className="size-5" />
              </span>
            )}
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {tipo === "upgrade"
                  ? "Planos e preços"
                  : tipo === "ajuda"
                  ? "Como usar o Gerador de Artigos"
                  : "Sobre o Gerador de Artigos"}
              </h2>
              {tipo === "upgrade" && (
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 tabular-nums">
                  Plano atual: {getPlanDisplayName(activePlanId)} · {monthlyUsed}/
                  {monthlyLimit} artigos · {monthlyImagesUsed}/
                  {monthlyImagesLimit} imagens
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar janela"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="studio-scroll min-h-0 flex-1 overflow-y-auto px-6 py-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          {tipo === "upgrade" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Escolha o plano ideal para o seu ritmo de publicação. Cancele
                  quando quiser.
                </p>
                <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-950">
                  <button
                    type="button"
                    onClick={() => setBillingCycle("monthly")}
                    className={`rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${
                      billingCycle === "monthly"
                        ? "bg-indigo-600 text-white"
                        : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                    }`}
                  >
                    Mensal
                  </button>
                  <button
                    type="button"
                    onClick={() => setBillingCycle("yearly")}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${
                      billingCycle === "yearly"
                        ? "bg-indigo-600 text-white"
                        : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                    }`}
                  >
                    <span>Anual</span>
                    <span
                      className={`text-[10px] font-bold ${
                        billingCycle === "yearly"
                          ? "text-amber-200"
                          : "text-emerald-600 dark:text-emerald-400"
                      }`}
                    >
                      2 meses grátis
                    </span>
                  </button>
                </div>
              </div>

              {needsAuthPrompt && !user && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
                  <span>
                    Entre com sua conta Google para vincular sua assinatura
                    Cakto (Pix ou Cartão) ao seu perfil.
                  </span>
                  <button
                    type="button"
                    onClick={() => void signInWithGoogle()}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 whitespace-nowrap"
                  >
                    <LogIn className="h-3.5 w-3.5" />
                    <span>Entrar com Google</span>
                  </button>
                </div>
              )}

              {checkoutError && (
                <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50/80 px-4 py-3 text-xs text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
                  <span>{checkoutError}</span>
                </div>
              )}

              {pixInfoMessage && (
                <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-xs text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span>{pixInfoMessage}</span>
                </div>
              )}

              {checkoutRedirectUrl && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-indigo-200 bg-indigo-50/80 px-4 py-3 text-xs text-indigo-900 dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-200">
                  <span>
                    Checkout Cakto preparado (Pix, Cartão ou Boleto). Se não abrir automaticamente:
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={checkoutRedirectUrl}
                      target="_top"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 font-semibold text-white hover:bg-indigo-700 whitespace-nowrap"
                    >
                      <span>Abrir Checkout Cakto</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                    <button
                      type="button"
                      disabled={verifyingPayment}
                      onClick={() => void handleVerifyPixOrPayment()}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-300 bg-white px-3 py-1.5 font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-60 dark:border-indigo-700 dark:bg-slate-900 dark:text-indigo-300 whitespace-nowrap"
                    >
                      <RefreshCw
                        className={`h-3.5 w-3.5 ${
                          verifyingPayment ? "animate-spin" : ""
                        }`}
                      />
                      <span>Já paguei via Pix</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Plano Grátis (linha compacta) */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/50">
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white">
                    {FREE_PLAN.nome} · R$ 0 / mês
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {FREE_PLAN.artigosMes} artigos por mês · Até{" "}
                    {FREE_PLAN.imagensPorArtigo} imagens/artigo (
                    {FREE_PLAN.imagensMes}/mês) · Sem cartão de crédito
                  </p>
                </div>
                {onSelectPlanoGeracao && (
                  <button
                    type="button"
                    onClick={() => {
                      onSelectPlanoGeracao("free");
                      onClose();
                    }}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                      planoGeracao === "free"
                        ? "border-indigo-600 bg-indigo-50 text-indigo-700 dark:border-indigo-500 dark:bg-indigo-950/50 dark:text-indigo-300"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                    }`}
                  >
                    {planoGeracao === "free" ? "Plano atual" : "Usar Grátis"}
                  </button>
                )}
              </div>

              {/* 3 Planos pagos */}
              <div className="grid gap-3 sm:grid-cols-3">
                {SUBSCRIPTION_PLANS.map((plan) => {
                  const isPopular = plan.destaque === "popular";
                  const isBestValue = plan.destaque === "melhor-valor";
                  const isHighlighted = highlightPlanId === plan.id;
                  const isLoading = loadingPlanId === plan.id;
                  const priceMain =
                    billingCycle === "yearly"
                      ? plan.equivalenteMensalAnualBrl
                      : plan.precoMensalBrl;

                  return (
                    <div
                      key={plan.id}
                      className={`flex flex-col justify-between rounded-xl border p-4 transition-colors ${
                        isHighlighted
                          ? "border-2 border-amber-500 bg-amber-50/40 dark:border-amber-400 dark:bg-amber-950/20"
                          : isPopular
                          ? "border-2 border-indigo-500 bg-indigo-50/40 dark:border-indigo-500/70 dark:bg-indigo-950/30"
                          : isBestValue
                          ? "border-blue-300 bg-blue-50/20 dark:border-blue-500/40 dark:bg-blue-950/20"
                          : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950/40"
                      }`}
                    >
                      <div>
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                            {plan.nome}
                          </h3>
                          {isHighlighted ? (
                            <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                              Selecionado
                            </span>
                          ) : isPopular ? (
                            <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400">
                              Mais popular
                            </span>
                          ) : isBestValue ? (
                            <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                              Melhor custo-benefício
                            </span>
                          ) : null}
                        </div>

                        <div className="mt-2 flex items-baseline gap-1">
                          <span className="font-mono text-xl font-bold text-slate-950 dark:text-white tabular-nums">
                            {formatBrl(priceMain)}
                          </span>
                          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                            / mês
                          </span>
                        </div>

                        {billingCycle === "yearly" ? (
                          <p className="mt-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400 tabular-nums">
                            cobrado {formatBrl(plan.precoAnualBrl)} por ano
                          </p>
                        ) : (
                          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                            ou {formatBrl(plan.precoAnualBrl)} / ano
                          </p>
                        )}

                        <p className="mt-2 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
                          {plan.descricao}
                        </p>

                        <ul className="mt-3 space-y-1.5 text-[11px] text-slate-700 dark:text-slate-300">
                          <li className="flex items-start gap-1.5">
                            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                            <span>
                              <strong>{plan.artigosMes} artigos por mês</strong>{" "}
                              (~2.500 palavras)
                            </span>
                          </li>
                          <li className="flex items-start gap-1.5">
                            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                            <span>
                              Até {plan.imagensPorArtigo} imagens 1K por artigo (
                              <strong>{plan.imagensMes} imagens/mês</strong>)
                            </span>
                          </li>
                          <li className="flex items-start gap-1.5">
                            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                            <span>Modelos Google Gemini</span>
                          </li>
                        </ul>
                      </div>

                      <button
                        type="button"
                        disabled={Boolean(loadingPlanId)}
                        onClick={() => void handleSubscribeCakto(plan.id)}
                        className={`mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-60 ${
                          isPopular || isHighlighted
                            ? "bg-gradient-to-r from-[#5B4AF4] to-[#2563EB] text-white hover:brightness-110"
                            : "border border-indigo-200 bg-indigo-50/70 text-indigo-700 hover:bg-indigo-100 dark:border-indigo-800/60 dark:bg-indigo-950/50 dark:text-indigo-300 dark:hover:bg-indigo-900/60"
                        }`}
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            <span>A abrir Cakto…</span>
                          </>
                        ) : (
                          <>
                            <CreditCard className="h-3.5 w-3.5" />
                            <span>Assinar (Pix / Cartão)</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/60 px-3.5 py-2.5 text-xs text-slate-700 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-slate-300 space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <QrCode className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <span>
                      <strong>Pagamento via Pix, Cartão ou Boleto (Cakto):</strong>{" "}
                      liberação imediata após aprovação do Pix.
                    </span>
                  </div>
                  {user && (
                    <button
                      type="button"
                      disabled={verifyingPayment}
                      onClick={() => void handleVerifyPixOrPayment()}
                      className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-60 dark:border-emerald-800 dark:bg-slate-900 dark:text-emerald-300 whitespace-nowrap"
                    >
                      <RefreshCw
                        className={`h-3 w-3 ${
                          verifyingPayment ? "animate-spin" : ""
                        }`}
                      />
                      <span>Já paguei / Verificar Pix</span>
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-400">
                  <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span>
                    Cancele quando quiser no Portal do Assinante Cakto. A cota
                    mensal é renovada todo mês (não acumula). Se um artigo
                    precisar de mais de 7 imagens, 1 crédito de artigo ainda não
                    gerado libera mais 7 imagens dentro do teto mensal.
                  </span>
                </div>
              </div>

              {(hasSubscriptionPortal || (user && activePlanId !== "free")) && (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-2.5 text-xs dark:border-slate-800">
                  <span>
                    Já possui assinatura? Altere ou cancele a qualquer momento no
                    Portal Cakto.
                  </span>
                  <button
                    type="button"
                    disabled={openingPortal}
                    onClick={() => void handleOpenCustomerPortal()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 whitespace-nowrap"
                  >
                    {openingPortal ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Settings2 className="h-3.5 w-3.5" />
                    )}
                    <span>Portal do Assinante</span>
                  </button>
                </div>
              )}

              <p className="text-center text-[11px] text-slate-500 dark:text-slate-400">
                Ao assinar, você concorda com nossos{" "}
                <Link
                  href="/termos-de-uso"
                  onClick={onClose}
                  className="underline underline-offset-2 hover:text-indigo-600 dark:hover:text-indigo-400"
                >
                  Termos de Uso
                </Link>
                ,{" "}
                <Link
                  href="/privacidade"
                  onClick={onClose}
                  className="underline underline-offset-2 hover:text-indigo-600 dark:hover:text-indigo-400"
                >
                  Política de Privacidade
                </Link>{" "}
                e{" "}
                <Link
                  href="/reembolso-e-cancelamento"
                  onClick={onClose}
                  className="underline underline-offset-2 hover:text-indigo-600 dark:hover:text-indigo-400"
                >
                  Política de Reembolso (7 dias)
                </Link>
                .
              </p>
            </div>
          )}

          {tipo === "ajuda" && (
            <ol className="space-y-3 list-decimal pl-5">
              <li>
                <strong className="text-slate-800 dark:text-slate-100">
                  Defina o tema:
                </strong>{" "}
                Escreva o assunto principal e, se quiser, adicione palavras-chave
                pressionando Enter ou vírgula.
              </li>
              <li>
                <strong className="text-slate-800 dark:text-slate-100">
                  Personalize tom, idioma e extensão:
                </strong>{" "}
                Escolha entre artigos curtos (800–1.200 palavras) ou guias
                longos (2.000+ palavras) com imagens por secção.
              </li>
              <li>
                <strong className="text-slate-800 dark:text-slate-100">
                  Revise, edite e analise o SEO:
                </strong>{" "}
                Alterne entre os separadores Prévia, Editor e SEO a qualquer
                momento antes de copiar ou descarregar em HTML.
              </li>
            </ol>
          )}

          {tipo === "sobre" && (
            <div className="space-y-3">
              <p>
                O <strong className="dark:text-white">Gerador de Artigos</strong>{" "}
                cria esboços estruturados, redige secção por secção mantendo a
                coerência do texto anterior e gera ilustrações editoriais para
                cada capítulo.
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Os artigos guardados ficam sincronizados na sua conta Supabase e
                disponíveis localmente nas secções Meus Artigos, Favoritos e
                Estatísticas.
              </p>
              <div className="flex flex-wrap gap-3 pt-2 text-xs font-medium text-indigo-600 dark:text-indigo-400">
                <Link href="/sobre" onClick={onClose} className="hover:underline">
                  Sobre nós
                </Link>
                <Link href="/termos-de-uso" onClick={onClose} className="hover:underline">
                  Termos de Uso
                </Link>
                <Link href="/privacidade" onClick={onClose} className="hover:underline">
                  Privacidade (LGPD)
                </Link>
                <Link href="/reembolso-e-cancelamento" onClick={onClose} className="hover:underline">
                  Reembolso e Cancelamento
                </Link>
              </div>
            </div>
          )}
        </div>

        <div className="flex shrink-0 justify-end border-t border-slate-100 px-6 py-3.5 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
          >
            Fechar
          </button>
        </div>
      </motion.div>
    </div>
  );
}
