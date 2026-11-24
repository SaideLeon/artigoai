"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Ban,
  Banknote,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  ExternalLink,
  Hourglass,
  Loader2,
  Lock,
  LogIn,
  LogOut,
  MousePointerClick,
  QrCode,
  Sparkles,
  TrendingUp,
  UserCheck,
  Users,
  Wallet,
  X,
} from "lucide-react";
import BrandLogo from "@/components/BrandLogo";
import ThemeToggleButton from "@/components/ThemeToggleButton";
import { useAuth } from "@/components/AuthProvider";

type CommissionStatus =
  | "pendente"
  | "disponivel"
  | "em_saque"
  | "paga"
  | "estornada";

type WithdrawalStatus = "solicitado" | "em_analise" | "pago" | "recusado";
type WithdrawalMethod = "pix" | "outro";
type PixKeyType = "cpf" | "cnpj" | "email" | "telefone" | "aleatoria";

type PartnerDashboardData =
  | { isPartner: false }
  | {
      isPartner: true;
      config: {
        baseCalculo: "valor_bruto" | "valor_liquido";
        garantiaDias: number;
        saqueMinimoCentavos: number;
        saqueMinimoBrl: number;
        planCommissionRates?: {
          starter: number;
          pro: number;
          agencia: number;
        };
      };
      partner: {
        id: string;
        codigo: string;
        percentualComissao: number;
        ativo: boolean;
        codigoPersonalizado: boolean;
        criadoEm: string;
        referralUrl: string;
      };
      metrics: {
        cliquesTotais: number;
        cliquesUltimos30Dias: number;
        cadastrosTotais: number;
        assinantesAtivos: number;
        saldoPendenteCentavos: number;
        saldoDisponivelCentavos: number;
        saldoEmSaqueCentavos: number;
        totalGanhoCentavos: number;
        totalRecebidoCentavos: number;
        ajustesEmAbertoCentavos: number;
        saldoPendenteBrl: number;
        saldoDisponivelBrl: number;
        saldoEmSaqueBrl: number;
        totalGanhoBrl: number;
        totalRecebidoBrl: number;
        comissoesEstornadasBrl: number;
        hasOpenWithdrawal: boolean;
        podeSolicitarSaque: boolean;
      };
      clicksByDay: { data: string; total: number }[];
      referrals: {
        maskedEmail: string;
        referredAt: string | null;
        plan: string;
        subscriptionStatus: string;
      }[];
      commissions: {
        id: string;
        criadoEm: string;
        disponivelEm: string;
        pagaEm: string | null;
        estornadaEm: string | null;
        maskedEmail: string;
        plano: string;
        ciclo: string;
        tipo: string;
        valorBruto: number;
        percentualAplicado: number;
        valorComissao: number;
        moeda: string;
        status: CommissionStatus;
      }[];
      withdrawals: {
        id: string;
        valorCentavos: number;
        valorBrl: number;
        metodo: WithdrawalMethod;
        pixTipoChave: PixKeyType | null;
        dadosPagamento: string;
        status: WithdrawalStatus;
        comprovativoRef: string | null;
        motivoRecusa: string | null;
        solicitadoEm: string;
        analisadoEm: string | null;
        pagoEm: string | null;
        recusadoEm: string | null;
      }[];
    };

function fmtBrl(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number.isFinite(value) ? value : 0);
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return "—";
  }
}

function fmtShortDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
    }).format(new Date(iso));
  } catch {
    return "—";
  }
}

function fmtShortDay(ymd: string): string {
  const parts = ymd.split("-");
  if (parts.length !== 3) return ymd;
  return `${parts[2]}/${parts[1]}`;
}

function formatPlanLabel(plan: string): string {
  switch (plan) {
    case "starter":
      return "Starter";
    case "pro":
      return "Pro";
    case "agencia":
      return "Agência";
    case "free":
      return "Gratuito";
    default:
      return plan;
  }
}

function formatPixType(type: PixKeyType | null): string {
  switch (type) {
    case "cpf":
      return "CPF";
    case "cnpj":
      return "CNPJ";
    case "email":
      return "E-mail";
    case "telefone":
      return "Telefone";
    case "aleatoria":
      return "Aleatória";
    default:
      return "Pix";
  }
}

function renderCommissionStatus(status: CommissionStatus) {
  switch (status) {
    case "disponivel":
      return (
        <span className="inline-flex items-center gap-1 font-semibold text-cyan-700 dark:text-cyan-300">
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span>Disponível</span>
        </span>
      );
    case "em_saque":
      return (
        <span className="inline-flex items-center gap-1 font-semibold text-indigo-700 dark:text-indigo-300">
          <Hourglass className="h-3.5 w-3.5" />
          <span>Em saque</span>
        </span>
      );
    case "paga":
      return (
        <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span>Paga</span>
        </span>
      );
    case "estornada":
      return (
        <span className="inline-flex items-center gap-1 font-semibold text-rose-600 dark:text-rose-400">
          <Ban className="h-3.5 w-3.5" />
          <span>Estornada</span>
        </span>
      );
    case "pendente":
    default:
      return (
        <span className="inline-flex items-center gap-1 font-semibold text-amber-700 dark:text-amber-300">
          <Clock className="h-3.5 w-3.5" />
          <span>Pendente</span>
        </span>
      );
  }
}

function renderWithdrawalStatus(status: WithdrawalStatus) {
  switch (status) {
    case "solicitado":
      return (
        <span className="inline-flex items-center gap-1 font-semibold text-amber-700 dark:text-amber-300">
          <Clock className="h-3.5 w-3.5" />
          <span>Solicitado</span>
        </span>
      );
    case "em_analise":
      return (
        <span className="inline-flex items-center gap-1 font-semibold text-indigo-700 dark:text-indigo-300">
          <Hourglass className="h-3.5 w-3.5" />
          <span>Em análise</span>
        </span>
      );
    case "pago":
      return (
        <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span>Pago</span>
        </span>
      );
    case "recusado":
      return (
        <span className="inline-flex items-center gap-1 font-semibold text-rose-600 dark:text-rose-400">
          <Ban className="h-3.5 w-3.5" />
          <span>Recusado</span>
        </span>
      );
  }
}

export default function PartnerDashboardClient() {
  const { user, loading: authLoading, signInWithGoogle, signOutUser } = useAuth();

  const [data, setData] = useState<PartnerDashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  const [customCodeInput, setCustomCodeInput] = useState("");
  const [savingCode, setSavingCode] = useState(false);
  const [codeMessage, setCodeMessage] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);

  // Estado do formulário / modal de Solicitar Saque
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
  const [withdrawMethod, setWithdrawMethod] = useState<WithdrawalMethod>("pix");
  const [pixKeyType, setPixKeyType] = useState<PixKeyType>("cpf");
  const [paymentDetails, setPaymentDetails] = useState("");
  const [withdrawAmountBrl, setWithdrawAmountBrl] = useState("");
  const [submittingWithdraw, setSubmittingWithdraw] = useState(false);
  const [withdrawFeedback, setWithdrawFeedback] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/parceiros/me", { cache: "no-store" });
      const json = (await res.json()) as PartnerDashboardData & { erro?: string };
      if (!res.ok) {
        setError(json.erro || "Falha ao carregar painel de parceiro.");
        setData(null);
      } else {
        setData(json);
        if (json.isPartner) {
          setCustomCodeInput(json.partner.codigo);
          setWithdrawAmountBrl(json.metrics.saldoDisponivelBrl.toFixed(2));
        }
      }
    } catch {
      setError("Erro de conexão ao buscar métricas de parceria.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (!active) return;
      if (!authLoading && user) {
        void loadDashboard();
      } else if (!authLoading && !user) {
        setData(null);
      }
    });
    return () => {
      active = false;
    };
  }, [authLoading, user, loadDashboard]);

  const referralUrl =
    data && data.isPartner ? data.partner.referralUrl : "";

  useEffect(() => {
    if (!showQr || !referralUrl) return;
    let active = true;
    QRCode.toDataURL(referralUrl, {
      width: 240,
      margin: 2,
      color: {
        dark: "#0B1124",
        light: "#FFFFFF",
      },
    })
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch(() => {
        if (active) setQrDataUrl(null);
      });
    return () => {
      active = false;
    };
  }, [showQr, referralUrl]);

  const handleCopyUrl = async () => {
    if (!referralUrl) return;
    try {
      await navigator.clipboard.writeText(referralUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // Fallback silencioso
    }
  };

  const handleSaveCustomCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data || !data.isPartner || savingCode) return;

    setSavingCode(true);
    setCodeMessage(null);
    try {
      const res = await fetch("/api/parceiros/codigo", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo: customCodeInput }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        erro?: string;
        codigo?: string;
      };
      if (!res.ok) {
        setCodeMessage({
          type: "err",
          text: json.erro || "Não foi possível atualizar o código.",
        });
      } else {
        setCodeMessage({
          type: "ok",
          text: `Código personalizado para "${json.codigo}" com sucesso!`,
        });
        await loadDashboard();
      }
    } catch {
      setCodeMessage({
        type: "err",
        text: "Falha de rede ao salvar código personalizado.",
      });
    } finally {
      setSavingCode(false);
    }
  };

  const handleOpenWithdrawModal = () => {
    if (!data || !data.isPartner) return;
    setWithdrawFeedback(null);
    setWithdrawAmountBrl(data.metrics.saldoDisponivelBrl.toFixed(2));
    setWithdrawModalOpen(true);
  };

  const handleSubmitWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data || !data.isPartner || submittingWithdraw) return;

    const normalizedAmount = Number(withdrawAmountBrl.replace(",", ".").trim());
    if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
      setWithdrawFeedback({
        type: "err",
        text: "Informe um valor válido para o saque.",
      });
      return;
    }

    const valorCentavos = Math.round(normalizedAmount * 100);
    setSubmittingWithdraw(true);
    setWithdrawFeedback(null);

    try {
      const res = await fetch("/api/parceiros/saques", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          metodo: withdrawMethod,
          pixTipoChave: withdrawMethod === "pix" ? pixKeyType : null,
          dadosPagamento: paymentDetails.trim(),
          valorCentavos,
        }),
      });
      const json = (await res.json()) as { ok?: boolean; erro?: string };
      if (!res.ok) {
        setWithdrawFeedback({
          type: "err",
          text: json.erro || "Não foi possível solicitar o saque.",
        });
      } else {
        setWithdrawFeedback({
          type: "ok",
          text: "Pedido de saque registrado! Você receberá atualizações por e-mail.",
        });
        setPaymentDetails("");
        await loadDashboard();
        setTimeout(() => {
          setWithdrawModalOpen(false);
          setWithdrawFeedback(null);
        }, 1200);
      }
    } catch {
      setWithdrawFeedback({
        type: "err",
        text: "Erro de rede ao registrar solicitação de saque.",
      });
    } finally {
      setSubmittingWithdraw(false);
    }
  };

  const maxDayClicks =
    data && data.isPartner
      ? Math.max(1, ...data.clicksByDay.map((d) => d.total))
      : 1;

  const rates =
    data && data.isPartner && data.config.planCommissionRates
      ? data.config.planCommissionRates
      : { starter: 20, pro: 35, agencia: 35 };

  return (
    <div className="min-h-screen bg-[#F4F6FB] text-slate-900 dark:bg-[#070B16] dark:text-slate-100 flex flex-col transition-colors duration-150">
      {/* 3-zone top bar */}
      <header className="sticky top-0 z-30 border-b border-slate-200/90 bg-white/90 dark:border-slate-800/80 dark:bg-[#0B1124]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-6 px-4 py-3.5 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="flex items-center gap-2.5 whitespace-nowrap shrink-0"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#5B4AF4] to-[#2563EB] text-white">
              <BrandLogo className="size-5 text-white" />
            </span>
            <span className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
              Artigen Parceiros
            </span>
          </Link>

          <nav
            aria-label="Navegação do parceiro"
            className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300"
          >
            <Link
              href="/studio"
              className="hover:text-slate-950 dark:hover:text-white hover:underline underline-offset-4 whitespace-nowrap shrink-0"
            >
              Estúdio
            </Link>
            <Link
              href="/termos-parceiros"
              className="hover:text-slate-950 dark:hover:text-white hover:underline underline-offset-4 whitespace-nowrap shrink-0"
            >
              Regras
            </Link>
            <Link
              href="/privacidade"
              className="hover:text-slate-950 dark:hover:text-white hover:underline underline-offset-4 whitespace-nowrap shrink-0"
            >
              Privacidade
            </Link>
            <Link
              href="/"
              className="hover:text-slate-950 dark:hover:text-white hover:underline underline-offset-4 whitespace-nowrap shrink-0"
            >
              Início
            </Link>
          </nav>

          <div className="flex items-center gap-2.5 shrink-0">
            <ThemeToggleButton />
            {user ? (
              <button
                type="button"
                onClick={() => void signOutUser()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Sair</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void signInWithGoogle("/parceiro")}
                className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#5B4AF4] to-[#2563EB] px-4 py-2 text-xs font-semibold text-white hover:brightness-110 whitespace-nowrap shrink-0"
              >
                <LogIn className="h-3.5 w-3.5" />
                <span>Entrar</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        {authLoading || (user && loading && !data) ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-xs dark:border-slate-800 dark:bg-[#0F172A] dark:shadow-none">
            <Loader2 className="mx-auto h-7 w-7 animate-spin text-indigo-600 dark:text-indigo-400" />
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
              A carregar seu painel de parceiro…
            </p>
          </div>
        ) : !user ? (
          <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center space-y-5 shadow-xs dark:border-slate-800 dark:bg-[#0F172A] dark:shadow-none">
            <Sparkles className="mx-auto h-9 w-9 text-indigo-600 dark:text-indigo-400" />
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                Painel do Parceiro Artigen
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Faça login com a conta Google vinculada à sua parceria para
                acessar seu link de indicação, saldo e pedidos de saque.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void signInWithGoogle("/parceiro")}
              className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#5B4AF4] to-[#2563EB] px-5 py-3 text-sm font-semibold text-white hover:brightness-110"
            >
              <LogIn className="h-4 w-4" />
              <span>Entrar com Google</span>
            </button>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700 dark:border-rose-800/70 dark:bg-rose-950/30 dark:text-rose-200">
            {error}
          </div>
        ) : data && !data.isPartner ? (
          <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-8 space-y-4 shadow-xs dark:border-slate-800 dark:bg-[#0F172A] dark:shadow-none">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              Conta ainda não habilitada como parceira
            </h1>
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              Você está conectado como{" "}
              <strong className="text-slate-900 dark:text-white">
                {user.email}
              </strong>
              , porém esta conta ainda não aceitou um convite de parceiro. O
              programa de parceiros Artigen funciona mediante convite exclusivo
              gerado pelo administrador.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link
                href="/termos-parceiros"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-xs font-semibold text-slate-900 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
              >
                <span>Ler Termos do Programa</span>
              </Link>
              <Link
                href="/studio"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#5B4AF4] to-[#2563EB] px-4 py-2.5 text-xs font-semibold text-white hover:brightness-110"
              >
                <span>Ir para o Estúdio</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        ) : data && data.isPartner ? (
          <>
            {/* Cabeçalho do Painel + Botão Principal de Saque */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  Programa de Afiliados e Parceiros
                </p>
                <h1 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white text-balance">
                  Saldo e Desempenho das Indicações
                </h1>
                <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                  Comissões oficiais:{" "}
                  <strong className="text-emerald-700 dark:text-emerald-400 tabular-nums">
                    Starter {rates.starter}% (R$ 6,98)
                  </strong>{" "}
                  ·{" "}
                  <strong className="text-emerald-700 dark:text-emerald-400 tabular-nums">
                    Pro {rates.pro}% (R$ 33,22)
                  </strong>{" "}
                  ·{" "}
                  <strong className="text-emerald-700 dark:text-emerald-400 tabular-nums">
                    Agência {rates.agencia}% (R$ 52,47)
                  </strong>{" "}
                  sobre o{" "}
                  {data.config.baseCalculo === "valor_liquido"
                    ? "valor líquido"
                    : "valor bruto"}{" "}
                  · Garantia de {data.config.garantiaDias} dias · Saque mínimo{" "}
                  {fmtBrl(data.config.saqueMinimoBrl)}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                    data.partner.ativo
                      ? "text-emerald-700 dark:text-emerald-400"
                      : "text-amber-700 dark:text-amber-300"
                  }`}
                >
                  {data.partner.ativo ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <AlertTriangle className="h-4 w-4" />
                  )}
                  <span>
                    {data.partner.ativo
                      ? "Parceiro Ativo"
                      : "Parceiro Desativado"}
                  </span>
                </span>

                <button
                  type="button"
                  disabled={!data.metrics.podeSolicitarSaque}
                  onClick={handleOpenWithdrawModal}
                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#5B4AF4] to-[#2563EB] px-5 py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45 whitespace-nowrap shrink-0"
                >
                  <Banknote className="h-4 w-4" />
                  <span>Solicitar saque</span>
                </button>
              </div>
            </div>

            {!data.partner.ativo ? (
              <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs sm:text-sm text-amber-800 dark:border-amber-800/70 dark:bg-amber-950/30 dark:text-amber-200">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
                <div>
                  Sua conta de parceiro está desativada temporariamente pelo
                  administrador. Novos cadastros pelo seu link não são
                  rastreados enquanto estiver pausada, mas todas as comissões
                  já geradas permanecem preservadas.
                </div>
              </div>
            ) : null}

            {data.metrics.saldoDisponivelCentavos < 0 ? (
              <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs sm:text-sm text-rose-800 dark:border-rose-800/70 dark:bg-rose-950/30 dark:text-rose-200">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" />
                <div>
                  Você possui um saldo negativo de{" "}
                  <strong className="font-mono tabular-nums">
                    {fmtBrl(data.metrics.saldoDisponivelBrl)}
                  </strong>{" "}
                  referente ao estorno de uma comissão que já havia sido paga.
                  Esse valor será compensado automaticamente nos seus próximos
                  ganhos disponíveis.
                </div>
              </div>
            ) : null}

            {/* 4 KPIs Financeiros em Destaque + Métricas de Aquisição */}
            <section
              aria-label="Resumo financeiro do parceiro"
              className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
            >
              <div className="rounded-2xl border border-cyan-200 bg-white p-5 space-y-2 shadow-xs dark:border-cyan-800/60 dark:bg-[#0F172A] dark:shadow-none">
                <div className="flex items-center justify-between text-xs font-medium text-cyan-700 dark:text-cyan-300">
                  <span>Saldo disponível</span>
                  <Banknote className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                </div>
                <p className="text-3xl font-bold text-slate-900 dark:text-white font-mono tabular-nums">
                  {fmtBrl(data.metrics.saldoDisponivelBrl)}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {data.metrics.hasOpenWithdrawal
                    ? `Saque em andamento de ${fmtBrl(data.metrics.saldoEmSaqueBrl)}`
                    : data.metrics.saldoDisponivelCentavos >=
                      data.config.saqueMinimoCentavos
                    ? "Liberado para solicitação imediata"
                    : `Mínimo de ${fmtBrl(data.config.saqueMinimoBrl)} para sacar`}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-2 shadow-xs dark:border-slate-800 dark:bg-[#0F172A] dark:shadow-none">
                <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
                  <span>Saldo pendente</span>
                  <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                </div>
                <p className="text-3xl font-bold text-amber-600 dark:text-amber-300 font-mono tabular-nums">
                  {fmtBrl(data.metrics.saldoPendenteBrl)}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Em período de garantia ({data.config.garantiaDias} dias)
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-2 shadow-xs dark:border-slate-800 dark:bg-[#0F172A] dark:shadow-none">
                <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
                  <span>Total ganho</span>
                  <TrendingUp className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                </div>
                <p className="text-3xl font-bold text-slate-900 dark:text-white font-mono tabular-nums">
                  {fmtBrl(data.metrics.totalGanhoBrl)}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Acumulado válido no programa
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-2 shadow-xs dark:border-slate-800 dark:bg-[#0F172A] dark:shadow-none">
                <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
                  <span>Total já recebido</span>
                  <Wallet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 font-mono tabular-nums">
                  {fmtBrl(data.metrics.totalRecebidoBrl)}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Saques concluídos e pagos
                </p>
              </div>
            </section>

            {/* Faixa de Funil Operacional */}
            <section
              aria-label="Métricas de aquisição"
              className="grid grid-cols-2 gap-3.5 sm:grid-cols-4"
            >
              <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-1 shadow-xs dark:border-slate-800 dark:bg-[#0F172A] dark:shadow-none">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>Cliques Totais</span>
                  <MousePointerClick className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                </div>
                <p className="text-xl font-bold text-slate-900 dark:text-white font-mono tabular-nums">
                  {data.metrics.cliquesTotais}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                  {data.metrics.cliquesUltimos30Dias} nos últimos 30d
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-1 shadow-xs dark:border-slate-800 dark:bg-[#0F172A] dark:shadow-none">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>Cadastros</span>
                  <Users className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                </div>
                <p className="text-xl font-bold text-slate-900 dark:text-white font-mono tabular-nums">
                  {data.metrics.cadastrosTotais}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Contas novas atribuídas
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-1 shadow-xs dark:border-slate-800 dark:bg-[#0F172A] dark:shadow-none">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>Assinantes Ativos</span>
                  <UserCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <p className="text-xl font-bold text-slate-900 dark:text-white font-mono tabular-nums">
                  {data.metrics.assinantesAtivos}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Planos pagos ativos
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-1 shadow-xs dark:border-slate-800 dark:bg-[#0F172A] dark:shadow-none">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>Em Saque / Análise</span>
                  <Hourglass className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                </div>
                <p className="text-xl font-bold text-indigo-700 dark:text-indigo-300 font-mono tabular-nums">
                  {fmtBrl(data.metrics.saldoEmSaqueBrl)}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Aguardando pagamento
                </p>
              </div>
            </section>

            {/* Link de Divulgação + QR Code + Personalização Única */}
            <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-5 shadow-xs dark:border-slate-800 dark:bg-[#0F172A] dark:shadow-none">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
                <div className="lg:col-span-7 space-y-3">
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                    Seu Link Exclusivo de Divulgação
                  </h2>
                  <div className="flex flex-col sm:flex-row gap-2.5">
                    <div className="flex-1 overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-xs sm:text-sm text-indigo-700 dark:border-slate-700 dark:bg-[#070B16] dark:text-indigo-300 select-all">
                      {data.partner.referralUrl}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => void handleCopyUrl()}
                        className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#5B4AF4] to-[#2563EB] px-4 py-2 text-xs font-semibold text-white hover:brightness-110 whitespace-nowrap"
                      >
                        {copied ? (
                          <>
                            <Check className="h-4 w-4" />
                            <span>Copiado!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-4 w-4" />
                            <span>Copiar link</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowQr((prev) => !prev)}
                        className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 whitespace-nowrap"
                      >
                        <QrCode className="h-4 w-4" />
                        <span>{showQr ? "Ocultar QR" : "QR Code"}</span>
                      </button>
                    </div>
                  </div>

                  {showQr && qrDataUrl ? (
                    <div className="flex flex-col sm:flex-row items-center gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-[#0B1124]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={qrDataUrl}
                        alt={`QR Code do link de indicação ${data.partner.codigo}`}
                        className="h-32 w-32 rounded-lg border border-slate-200 bg-white p-1.5"
                      />
                      <div className="space-y-2 text-center sm:text-left">
                        <p className="text-xs font-semibold text-slate-900 dark:text-white">
                          QR Code para vídeos, YouTube, stories ou slides
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Aponta diretamente para{" "}
                          <code className="text-indigo-700 dark:text-indigo-300">
                            ?ref={data.partner.codigo}
                          </code>
                        </p>
                        <a
                          href={qrDataUrl}
                          download={`artigen-qr-${data.partner.codigo}.png`}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
                        >
                          <Download className="h-3.5 w-3.5" />
                          <span>Baixar PNG</span>
                        </a>
                      </div>
                    </div>
                  ) : null}
                </div>

                {/* Personalização única do código */}
                <div className="lg:col-span-5 rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3 dark:border-slate-800 dark:bg-[#0B1124]">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      Personalizar Código
                    </h3>
                    {data.partner.codigoPersonalizado ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                        <Lock className="h-3 w-3" />
                        <span>Já personalizado</span>
                      </span>
                    ) : (
                      <span className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400">
                        1 alteração disponível
                      </span>
                    )}
                  </div>

                  {data.partner.codigoPersonalizado ? (
                    <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                      Seu código personalizado{" "}
                      <code className="font-mono text-slate-900 dark:text-white">
                        {data.partner.codigo}
                      </code>{" "}
                      está travado para proteger seus links já compartilhados.
                    </p>
                  ) : (
                    <form onSubmit={handleSaveCustomCode} className="space-y-2.5">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={customCodeInput}
                          onChange={(e) =>
                            setCustomCodeInput(e.target.value.toLowerCase())
                          }
                          minLength={3}
                          maxLength={30}
                          placeholder="ex: kildary"
                          aria-label="Novo código de indicação"
                          className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-[#070B16] dark:text-white dark:placeholder:text-slate-500"
                        />
                        <button
                          type="submit"
                          disabled={savingCode}
                          className="inline-flex items-center justify-center rounded-xl border border-indigo-500/50 bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 whitespace-nowrap shrink-0"
                        >
                          {savingCode ? "Salvando…" : "Salvar código"}
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Use 3 a 30 caracteres: letras minúsculas, números e
                        hífen. Essa personalização só pode ser feita uma vez.
                      </p>
                      {codeMessage ? (
                        <p
                          className={`text-xs font-medium ${
                            codeMessage.type === "ok"
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-rose-600 dark:text-rose-400"
                          }`}
                        >
                          {codeMessage.text}
                        </p>
                      ) : null}
                    </form>
                  )}
                </div>
              </div>
            </section>

            {/* Histórico de Saques */}
            <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs dark:border-slate-800 dark:bg-[#0F172A] dark:shadow-none">
              <div className="flex flex-col gap-2 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                    Histórico de Saques
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Mínimo de {fmtBrl(data.config.saqueMinimoBrl)} · Máximo de 1
                    pedido em aberto por vez
                  </p>
                </div>
                <button
                  type="button"
                  disabled={!data.metrics.podeSolicitarSaque}
                  onClick={handleOpenWithdrawModal}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-45 dark:border-indigo-500/40 dark:bg-indigo-600/20 dark:text-indigo-200 dark:hover:bg-indigo-600/35 whitespace-nowrap shrink-0"
                >
                  <ArrowUpRight className="h-3.5 w-3.5" />
                  <span>Novo saque</span>
                </button>
              </div>

              {data.withdrawals.length === 0 ? (
                <div className="p-8 text-center text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                  Você ainda não realizou nenhum pedido de saque. Assim que seu{" "}
                  <strong className="text-slate-900 dark:text-white">
                    Saldo disponível
                  </strong>{" "}
                  atingir{" "}
                  <strong className="text-slate-900 dark:text-white">
                    {fmtBrl(data.config.saqueMinimoBrl)}
                  </strong>
                  , você poderá solicitar a transferência aqui.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-[#0B1124] dark:text-slate-400">
                        <th className="px-4 py-3 font-semibold">Data</th>
                        <th className="px-4 py-3 font-semibold text-right">
                          Valor
                        </th>
                        <th className="px-4 py-3 font-semibold">Método</th>
                        <th className="px-4 py-3 font-semibold">Estado</th>
                        <th className="px-4 py-3 font-semibold">
                          Comprovativo / Observação
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/80 dark:divide-slate-800/80">
                      {data.withdrawals.map((w) => (
                        <tr
                          key={w.id}
                          className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                        >
                          <td className="px-4 py-3 text-slate-700 dark:text-slate-300 whitespace-nowrap tabular-nums">
                            {fmtDate(w.solicitadoEm)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 dark:text-white tabular-nums whitespace-nowrap">
                            {fmtBrl(w.valorBrl)}
                          </td>
                          <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                            <span className="font-semibold text-slate-900 dark:text-white">
                              {w.metodo === "pix"
                                ? `Pix (${formatPixType(w.pixTipoChave)})`
                                : "Outro método"}
                            </span>
                            <span className="mx-1.5 text-slate-400 dark:text-slate-600">
                              ·
                            </span>
                            <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 break-all">
                              {w.dadosPagamento}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {renderWithdrawalStatus(w.status)}
                          </td>
                          <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                            {w.status === "pago" ? (
                              <span>
                                Pago em {fmtShortDate(w.pagoEm)}
                                {w.comprovativoRef
                                  ? ` · Ref: ${w.comprovativoRef}`
                                  : ""}
                              </span>
                            ) : w.status === "recusado" ? (
                              <span className="text-rose-600 dark:text-rose-300">
                                {w.motivoRecusa || "Recusado"}
                              </span>
                            ) : (
                              <span className="text-slate-500 dark:text-slate-400">
                                Aguardando conferência
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Cliques Diários (últimos 14 registros) */}
            {data.clicksByDay.length > 0 ? (
              <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-4 shadow-xs dark:border-slate-800 dark:bg-[#0F172A] dark:shadow-none">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                    Cliques Agregados por Dia
                  </h2>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Contagem anônima (sem dados pessoais)
                  </span>
                </div>
                <div className="grid grid-cols-7 sm:grid-cols-14 gap-2 items-end h-28 pt-2">
                  {data.clicksByDay.map((day) => {
                    const heightPct = Math.max(
                      12,
                      Math.round((day.total / maxDayClicks) * 100)
                    );
                    return (
                      <div
                        key={day.data}
                        className="flex flex-col items-center justify-end gap-1.5 h-full"
                      >
                        <span className="text-[10px] font-mono text-slate-600 dark:text-slate-300 tabular-nums">
                          {day.total}
                        </span>
                        <div
                          className="w-full max-w-[24px] rounded-t-md bg-gradient-to-t from-[#5B4AF4] to-[#2563EB]"
                          style={{ height: `${heightPct}%` }}
                          title={`${fmtShortDay(day.data)}: ${day.total} cliques`}
                        />
                        <span className="text-[10px] font-mono text-slate-500 tabular-nums">
                          {fmtShortDay(day.data)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>
            ) : null}

            {/* Tabelas de Comissões + Últimos Indicados */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              <section className="lg:col-span-8 rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs dark:border-slate-800 dark:bg-[#0F172A] dark:shadow-none">
                <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                    Histórico de Comissões
                  </h2>
                  <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    {data.commissions.length} registro(s)
                  </span>
                </div>

                {data.commissions.length === 0 ? (
                  <div className="p-8 text-center text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                    Nenhuma comissão registrada ainda. Compartilhe seu link{" "}
                    <code className="text-indigo-600 dark:text-indigo-300">
                      ?ref={data.partner.codigo}
                    </code>{" "}
                    para começar a pontuar.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-[#0B1124] dark:text-slate-400">
                          <th className="px-4 py-3 font-semibold">Data</th>
                          <th className="px-4 py-3 font-semibold">Indicado</th>
                          <th className="px-4 py-3 font-semibold">Plano</th>
                          <th className="px-4 py-3 font-semibold text-right">
                            Valor Comissão
                          </th>
                          <th className="px-4 py-3 font-semibold">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/80 dark:divide-slate-800/80">
                        {data.commissions.map((c) => (
                          <tr
                            key={c.id}
                            className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                          >
                            <td className="px-4 py-3 text-slate-700 dark:text-slate-300 whitespace-nowrap tabular-nums">
                              <div>{fmtDate(c.criadoEm)}</div>
                              {c.status === "pendente" ? (
                                <div className="text-[11px] text-slate-500">
                                  Libera em {fmtShortDate(c.disponivelEm)}
                                </div>
                              ) : null}
                            </td>
                            <td className="px-4 py-3 font-mono text-slate-700 dark:text-slate-300">
                              {c.maskedEmail}
                            </td>
                            <td className="px-4 py-3 text-slate-800 dark:text-slate-200 whitespace-nowrap">
                              <span>{formatPlanLabel(c.plano)}</span>
                              <span className="mx-1.5 text-slate-400 dark:text-slate-600">
                                ·
                              </span>
                              <span className="text-slate-500 dark:text-slate-400">
                                {c.tipo === "renovacao"
                                  ? "Renovação"
                                  : "1º pgto"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 dark:text-white tabular-nums whitespace-nowrap">
                              <div>{fmtBrl(c.valorComissao)}</div>
                              <div className="text-[11px] font-normal text-slate-500 dark:text-slate-400">
                                {c.percentualAplicado}% de {fmtBrl(c.valorBruto)}
                              </div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              {renderCommissionStatus(c.status)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <section className="lg:col-span-4 rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs dark:border-slate-800 dark:bg-[#0F172A] dark:shadow-none">
                <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                    Cadastros Recentes
                  </h2>
                  <Link
                    href="/termos-parceiros"
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    <span>Regras</span>
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>

                {data.referrals.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
                    Nenhum cadastro atribuído ao seu código ainda.
                  </div>
                ) : (
                  <ul className="divide-y divide-slate-200/80 dark:divide-slate-800/80">
                    {data.referrals.map((ref, i) => (
                      <li
                        key={`${ref.maskedEmail}-${i}`}
                        className="flex items-center justify-between gap-3 px-5 py-3 text-xs"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-mono text-slate-800 dark:text-slate-200">
                            {ref.maskedEmail}
                          </p>
                          <p className="text-[11px] text-slate-500 tabular-nums">
                            {fmtDate(ref.referredAt)}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 font-semibold ${
                            ref.plan !== "free" &&
                            ref.subscriptionStatus === "active"
                              ? "text-emerald-700 dark:text-emerald-400"
                              : "text-slate-500 dark:text-slate-400"
                          }`}
                        >
                          {formatPlanLabel(ref.plan)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </>
        ) : null}
      </main>

      {/* Modal de Solicitar Saque */}
      {withdrawModalOpen && data && data.isPartner ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-saque-titulo"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 space-y-5 shadow-xl dark:border-slate-800 dark:bg-[#0F172A] dark:shadow-none">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2
                  id="modal-saque-titulo"
                  className="text-lg font-bold text-slate-900 dark:text-white"
                >
                  Solicitar saque
                </h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Saldo disponível:{" "}
                  <strong className="text-cyan-700 dark:text-cyan-300 font-mono tabular-nums">
                    {fmtBrl(data.metrics.saldoDisponivelBrl)}
                  </strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setWithdrawModalOpen(false)}
                aria-label="Fechar janela de saque"
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitWithdrawal} className="space-y-4">
              <div>
                <span className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Método de recebimento
                </span>
                <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1 border border-slate-200 dark:bg-[#070B16] dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setWithdrawMethod("pix")}
                    className={`rounded-lg py-2 text-xs font-semibold transition-colors ${
                      withdrawMethod === "pix"
                        ? "bg-indigo-600 text-white"
                        : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                    }`}
                  >
                    Pix
                  </button>
                  <button
                    type="button"
                    onClick={() => setWithdrawMethod("outro")}
                    className={`rounded-lg py-2 text-xs font-semibold transition-colors ${
                      withdrawMethod === "outro"
                        ? "bg-indigo-600 text-white"
                        : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                    }`}
                  >
                    Outro método
                  </button>
                </div>
              </div>

              {withdrawMethod === "pix" ? (
                <>
                  <div>
                    <label
                      htmlFor="saque-pix-tipo"
                      className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                    >
                      Tipo de chave Pix
                    </label>
                    <select
                      id="saque-pix-tipo"
                      value={pixKeyType}
                      onChange={(e) =>
                        setPixKeyType(e.target.value as PixKeyType)
                      }
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-[#070B16] dark:text-white"
                    >
                      <option value="cpf">CPF</option>
                      <option value="cnpj">CNPJ</option>
                      <option value="email">E-mail</option>
                      <option value="telefone">Telefone</option>
                      <option value="aleatoria">Chave aleatória</option>
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="saque-dados-pix"
                      className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                    >
                      Chave Pix
                    </label>
                    <input
                      id="saque-dados-pix"
                      type="text"
                      required
                      minLength={3}
                      maxLength={500}
                      value={paymentDetails}
                      onChange={(e) => setPaymentDetails(e.target.value)}
                      placeholder="Digite sua chave Pix"
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-[#070B16] dark:text-white dark:placeholder:text-slate-500"
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label
                    htmlFor="saque-dados-outro"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Dados completos do método de pagamento
                  </label>
                  <textarea
                    id="saque-dados-outro"
                    required
                    rows={3}
                    minLength={3}
                    maxLength={500}
                    value={paymentDetails}
                    onChange={(e) => setPaymentDetails(e.target.value)}
                    placeholder="Ex: Transferência bancária, IBAN, Wise, carteira móvel ou titularidade completa"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-[#070B16] dark:text-white dark:placeholder:text-slate-500"
                  />
                </div>
              )}

              <div>
                <label
                  htmlFor="saque-valor"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                >
                  Valor do saque (R$) — padrão: todo o saldo disponível
                </label>
                <input
                  id="saque-valor"
                  type="number"
                  step="0.01"
                  min={data.config.saqueMinimoBrl}
                  max={data.metrics.saldoDisponivelBrl}
                  required
                  value={withdrawAmountBrl}
                  onChange={(e) => setWithdrawAmountBrl(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 font-mono text-sm text-slate-900 tabular-nums focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-[#070B16] dark:text-white"
                />
              </div>

              {withdrawFeedback ? (
                <p
                  className={`text-xs font-medium ${
                    withdrawFeedback.type === "ok"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-rose-600 dark:text-rose-400"
                  }`}
                >
                  {withdrawFeedback.text}
                </p>
              ) : null}

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setWithdrawModalOpen(false)}
                  className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingWithdraw}
                  className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#5B4AF4] to-[#2563EB] px-5 py-2.5 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-50"
                >
                  {submittingWithdraw ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Banknote className="h-4 w-4" />
                  )}
                  <span>Confirmar solicitação</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
