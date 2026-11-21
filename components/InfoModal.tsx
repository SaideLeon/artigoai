"use client";

import { useState } from "react";
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
} from "lucide-react";
import { motion } from "motion/react";
import BrandLogo from "@/components/BrandLogo";
import { useAuth } from "@/components/AuthProvider";
import {
  PRICING_TIERS,
  USD_TO_BRL,
  formatCurrency,
  getPerArticlePrice,
  type CurrencyCode,
} from "@/lib/pricing";
import type { PlanoGeracao } from "@/lib/types";

type InfoModalProps = {
  tipo: "upgrade" | "ajuda" | "sobre" | null;
  onClose: () => void;
  planoGeracao?: PlanoGeracao;
  onSelectPlanoGeracao?: (plano: PlanoGeracao) => void;
  articleCredits?: number;
  highlightPackageId?: string | null;
};

export default function InfoModal({
  tipo,
  onClose,
  planoGeracao = "free",
  onSelectPlanoGeracao,
  articleCredits = 0,
  highlightPackageId = null,
}: InfoModalProps) {
  const { user, signInWithGoogle } = useAuth();
  const [currency, setCurrency] = useState<CurrencyCode>("BRL");
  const [loadingTierId, setLoadingTierId] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [needsAuthPrompt, setNeedsAuthPrompt] = useState(false);
  const [checkoutRedirectUrl, setCheckoutRedirectUrl] = useState<string | null>(
    null
  );

  if (!tipo) return null;

  async function handleCheckoutStripe(packageId: string) {
    setCheckoutError(null);
    setNeedsAuthPrompt(false);
    setCheckoutRedirectUrl(null);

    if (!user) {
      setNeedsAuthPrompt(true);
      return;
    }

    setLoadingTierId(packageId);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId, currency }),
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
            data.erro ?? "Não foi possível iniciar o pagamento na Stripe."
          );
        }
        return;
      }

      setCheckoutRedirectUrl(data.url);
      window.location.assign(data.url);
    } catch {
      setCheckoutError(
        "Falha de ligação ao iniciar o checkout seguro da Stripe."
      );
    } finally {
      setLoadingTierId(null);
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
          tipo === "upgrade" ? "max-w-2xl" : "max-w-lg"
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
                  ? "Créditos por Artigo & Pagamento Stripe"
                  : tipo === "ajuda"
                  ? "Como usar o Gerador de Artigos"
                  : "Sobre o Gerador de Artigos"}
              </h2>
              {tipo === "upgrade" && user && (
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 tabular-nums">
                  Saldo atual: {articleCredits}{" "}
                  {articleCredits === 1 ? "crédito" : "créditos"} ·{" "}
                  {planoGeracao === "paid" ? "Plano Pago ativo" : "Plano Gratuito"}
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
                  Compre 1 artigo avulso ou pacotes com até 32% de desconto via
                  Stripe.
                </p>
                <div className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-800 dark:bg-slate-950">
                  <button
                    type="button"
                    onClick={() => setCurrency("BRL")}
                    className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                      currency === "BRL"
                        ? "bg-indigo-600 text-white"
                        : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                    }`}
                  >
                    R$ (BRL)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrency("USD")}
                    className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                      currency === "USD"
                        ? "bg-indigo-600 text-white"
                        : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                    }`}
                  >
                    US$ (USD)
                  </button>
                </div>
              </div>

              {needsAuthPrompt && !user && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
                  <span>
                    Entre com sua conta Google para vincular os créditos
                    comprados na Stripe ao seu perfil.
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

              {checkoutRedirectUrl && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-indigo-200 bg-indigo-50/80 px-4 py-3 text-xs text-indigo-900 dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-200">
                  <span>
                    Sessão de pagamento criada. Se o redirecionamento não abrir
                    automaticamente:
                  </span>
                  <a
                    href={checkoutRedirectUrl}
                    target="_top"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 font-semibold text-white hover:bg-indigo-700 whitespace-nowrap"
                  >
                    <span>Abrir Checkout Stripe</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                {PRICING_TIERS.map((tier) => {
                  const total =
                    currency === "BRL" ? tier.totalBrl : tier.totalUsd;
                  const perArticle = getPerArticlePrice(tier, currency);
                  const isPopular = tier.destaque === "popular";
                  const isBestValue = tier.destaque === "melhor-valor";
                  const isHighlighted = highlightPackageId === tier.id;
                  const isLoading = loadingTierId === tier.id;

                  return (
                    <div
                      key={tier.id}
                      className={`flex flex-col justify-between rounded-xl border p-3.5 transition-colors ${
                        isHighlighted
                          ? "border-2 border-amber-500 bg-amber-50/40 dark:border-amber-400 dark:bg-amber-950/20"
                          : isPopular
                          ? "border-indigo-400 bg-indigo-50/50 dark:border-indigo-500/60 dark:bg-indigo-950/30"
                          : isBestValue
                          ? "border-blue-300 bg-blue-50/30 dark:border-blue-500/40 dark:bg-blue-950/20"
                          : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950/40"
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-xs font-bold text-slate-900 dark:text-white">
                              {tier.nome}
                            </p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              {tier.artigos === 1
                                ? "Venda avulsa"
                                : `${tier.artigos} créditos de artigo`}
                            </p>
                          </div>
                          {isHighlighted ? (
                            <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                              Selecionado
                            </span>
                          ) : isPopular ? (
                            <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                              Popular
                            </span>
                          ) : isBestValue ? (
                            <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                              -32% off
                            </span>
                          ) : null}
                        </div>

                        <div className="mt-2.5 flex items-baseline justify-between gap-2">
                          <span className="font-mono text-lg font-bold text-slate-950 dark:text-white tabular-nums">
                            {formatCurrency(total, currency)}
                          </span>
                          <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300 tabular-nums">
                            {formatCurrency(perArticle, currency)}/artigo
                            {tier.descontoPct > 0
                              ? ` · ${tier.descontoPct}% off`
                              : ""}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={Boolean(loadingTierId)}
                        onClick={() => void handleCheckoutStripe(tier.id)}
                        className={`mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-60 ${
                          isPopular || isHighlighted
                            ? "bg-gradient-to-r from-[#5B4AF4] to-[#2563EB] text-white hover:brightness-110"
                            : "border border-indigo-200 bg-indigo-50/70 text-indigo-700 hover:bg-indigo-100 dark:border-indigo-800/60 dark:bg-indigo-950/50 dark:text-indigo-300 dark:hover:bg-indigo-900/60"
                        }`}
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            <span>A abrir Stripe…</span>
                          </>
                        ) : (
                          <>
                            <CreditCard className="h-3.5 w-3.5" />
                            <span>Pagar com Stripe</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="rounded-xl border border-slate-200/80 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-300 space-y-1.5">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span>
                    <strong>Checkout Seguro Stripe:</strong> pagamento por cartão
                    em BRL ou USD com liberação automática de créditos no Supabase.
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 shrink-0 text-indigo-600 dark:text-indigo-400" />
                  <span>
                    <strong>Pacotes Pagos:</strong> usam exclusivamente Google
                    Gemini para gerar artigos (~2.500 palavras) e até 7 imagens
                    1K por artigo.
                  </span>
                </div>
                <p className="pl-5.5 text-[11px] text-slate-500 dark:text-slate-400">
                  Cotação de referência: 1 USD = R${" "}
                  {USD_TO_BRL.toLocaleString("pt-BR", {
                    minimumFractionDigits: 4,
                    maximumFractionDigits: 4,
                  })}
                </p>
              </div>

              {onSelectPlanoGeracao && (
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      onSelectPlanoGeracao("free");
                      onClose();
                    }}
                    className={`rounded-xl border px-3.5 py-2 text-xs font-semibold transition-colors ${
                      planoGeracao === "free"
                        ? "border-indigo-600 bg-indigo-50 text-indigo-700 dark:border-indigo-500 dark:bg-indigo-950/50 dark:text-indigo-300"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
                    }`}
                  >
                    Usar Plano Gratuito (OpenRouter + NVIDIA + Groq)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onSelectPlanoGeracao("paid");
                      onClose();
                    }}
                    className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors ${
                      planoGeracao === "paid"
                        ? "bg-indigo-600 text-white"
                        : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
                    }`}
                  >
                    Alternar para Motor Gemini
                  </button>
                </div>
              )}
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
