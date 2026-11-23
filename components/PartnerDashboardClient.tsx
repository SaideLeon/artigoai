"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import {
  AlertTriangle,
  ArrowRight,
  Ban,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  ExternalLink,
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
} from "lucide-react";
import BrandLogo from "@/components/BrandLogo";
import { useAuth } from "@/components/AuthProvider";

type PartnerDashboardData =
  | { isPartner: false }
  | {
      isPartner: true;
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
        comissoesPendentesBrl: number;
        comissoesPagasBrl: number;
        comissoesEstornadasBrl: number;
        totalGanhoBrl: number;
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
        pagaEm: string | null;
        maskedEmail: string;
        plano: string;
        ciclo: string;
        tipo: string;
        valorBruto: number;
        percentualAplicado: number;
        valorComissao: number;
        moeda: string;
        status: "pendente" | "paga" | "estornada";
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

  const maxDayClicks =
    data && data.isPartner
      ? Math.max(1, ...data.clicksByDay.map((d) => d.total))
      : 1;

  return (
    <div className="min-h-screen bg-[#070B16] text-slate-100 flex flex-col">
      {/* 3-zone top bar */}
      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-[#0B1124]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-8 px-4 py-3.5 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="flex items-center gap-2.5 whitespace-nowrap shrink-0"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#5B4AF4] to-[#2563EB] text-white">
              <BrandLogo className="size-5 text-white" />
            </span>
            <span className="text-base font-bold tracking-tight text-white">
              Artigen Parceiros
            </span>
          </Link>

          <nav
            aria-label="Navegação do parceiro"
            className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300"
          >
            <Link
              href="/studio"
              className="hover:text-white hover:underline underline-offset-4 whitespace-nowrap shrink-0"
            >
              Estúdio
            </Link>
            <Link
              href="/termos-parceiros"
              className="hover:text-white hover:underline underline-offset-4 whitespace-nowrap shrink-0"
            >
              Regras
            </Link>
            <Link
              href="/privacidade"
              className="hover:text-white hover:underline underline-offset-4 whitespace-nowrap shrink-0"
            >
              Privacidade
            </Link>
            <Link
              href="/"
              className="hover:text-white hover:underline underline-offset-4 whitespace-nowrap shrink-0"
            >
              Início
            </Link>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            {user ? (
              <button
                type="button"
                onClick={() => void signOutUser()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 whitespace-nowrap shrink-0"
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
          <div className="rounded-2xl border border-slate-800 bg-[#0F172A] p-12 text-center">
            <Loader2 className="mx-auto h-7 w-7 animate-spin text-indigo-400" />
            <p className="mt-3 text-sm text-slate-300">
              A carregar seu painel de parceiro…
            </p>
          </div>
        ) : !user ? (
          <div className="mx-auto max-w-lg rounded-2xl border border-slate-800 bg-[#0F172A] p-8 text-center space-y-5">
            <Sparkles className="mx-auto h-9 w-9 text-indigo-400" />
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-white">
                Painel do Parceiro Artigen
              </h1>
              <p className="text-sm text-slate-300">
                Faça login com a conta Google vinculada à sua parceria para
                acessar seu link de indicação, cliques e comissões.
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
          <div className="rounded-2xl border border-rose-800/70 bg-rose-950/30 p-6 text-sm text-rose-200">
            {error}
          </div>
        ) : data && !data.isPartner ? (
          <div className="mx-auto max-w-xl rounded-2xl border border-slate-800 bg-[#0F172A] p-8 space-y-4">
            <h1 className="text-xl font-bold text-white">
              Conta ainda não habilitada como parceira
            </h1>
            <p className="text-sm leading-relaxed text-slate-300">
              Você está conectado como{" "}
              <strong className="text-white">{user.email}</strong>, porém esta
              conta ainda não aceitou um convite de parceiro. O programa de
              parceiros Artigen funciona mediante convite exclusivo gerado pelo
              administrador.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link
                href="/termos-parceiros"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-700"
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
            {/* Cabeçalho do Painel */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
                  Programa de Afiliados e Parceiros
                </p>
                <h1 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-white">
                  Desempenho das suas Indicações
                </h1>
                <p className="mt-1 text-xs sm:text-sm text-slate-400">
                  Comissão vigente:{" "}
                  <strong className="text-emerald-400 tabular-nums">
                    {data.partner.percentualComissao}%
                  </strong>{" "}
                  sobre o valor bruto · Recorrente em todas as renovações ·{" "}
                  Cookie de 60 dias
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs font-semibold">
                {data.partner.ativo ? (
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-800/70 bg-emerald-950/50 px-3 py-1.5 text-emerald-300">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Parceiro Ativo</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-800/70 bg-amber-950/50 px-3 py-1.5 text-amber-300">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    <span>Parceiro Desativado</span>
                  </span>
                )}
              </div>
            </div>

            {!data.partner.ativo ? (
              <div className="flex items-start gap-3 rounded-2xl border border-amber-800/70 bg-amber-950/30 p-4 text-xs sm:text-sm text-amber-200">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
                <div>
                  Sua conta de parceiro está desativada temporariamente pelo
                  administrador. Novos cadastros pelo seu link não são
                  rastreados enquanto estiver pausada, mas todas as comissões
                  já geradas permanecem preservadas.
                </div>
              </div>
            ) : null}

            {/* Link de Divulgação + QR Code + Personalização Única */}
            <section className="rounded-2xl border border-slate-800 bg-[#0F172A] p-5 sm:p-6 space-y-5">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
                <div className="lg:col-span-7 space-y-3">
                  <h2 className="text-sm font-bold text-white">
                    Seu Link Exclusivo de Divulgação
                  </h2>
                  <div className="flex flex-col sm:flex-row gap-2.5">
                    <div className="flex-1 overflow-x-auto rounded-xl border border-slate-700 bg-[#070B16] px-4 py-3 font-mono text-xs sm:text-sm text-indigo-300 select-all">
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
                        className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 whitespace-nowrap"
                      >
                        <QrCode className="h-4 w-4" />
                        <span>{showQr ? "Ocultar QR" : "QR Code"}</span>
                      </button>
                    </div>
                  </div>

                  {showQr && qrDataUrl ? (
                    <div className="flex flex-col sm:flex-row items-center gap-4 rounded-xl border border-slate-800 bg-[#0B1124] p-4">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={qrDataUrl}
                        alt={`QR Code do link de indicação ${data.partner.codigo}`}
                        className="h-32 w-32 rounded-lg bg-white p-1.5"
                      />
                      <div className="space-y-2 text-center sm:text-left">
                        <p className="text-xs font-semibold text-white">
                          QR Code para vídeos, YouTube, stories ou slides
                        </p>
                        <p className="text-xs text-slate-400">
                          Aponta diretamente para{" "}
                          <code className="text-indigo-300">
                            ?ref={data.partner.codigo}
                          </code>
                        </p>
                        <a
                          href={qrDataUrl}
                          download={`artigen-qr-${data.partner.codigo}.png`}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700"
                        >
                          <Download className="h-3.5 w-3.5" />
                          <span>Baixar PNG</span>
                        </a>
                      </div>
                    </div>
                  ) : null}
                </div>

                {/* Personalização única do código */}
                <div className="lg:col-span-5 rounded-xl border border-slate-800 bg-[#0B1124] p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                      Personalizar Código
                    </h3>
                    {data.partner.codigoPersonalizado ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400">
                        <Lock className="h-3 w-3" />
                        <span>Já personalizado</span>
                      </span>
                    ) : (
                      <span className="text-[11px] font-medium text-indigo-400">
                        1 alteração disponível
                      </span>
                    )}
                  </div>

                  {data.partner.codigoPersonalizado ? (
                    <p className="text-xs leading-relaxed text-slate-400">
                      Seu código personalizado{" "}
                      <code className="font-mono text-white">
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
                          className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-[#070B16] px-3 py-2 font-mono text-xs text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
                        />
                        <button
                          type="submit"
                          disabled={savingCode}
                          className="inline-flex items-center justify-center rounded-xl border border-indigo-500/50 bg-indigo-600/90 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 whitespace-nowrap shrink-0"
                        >
                          {savingCode ? "Salvando…" : "Salvar código"}
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Use 3 a 30 caracteres: letras minúsculas, números e
                        hífen. Essa personalização só pode ser feita uma vez.
                      </p>
                      {codeMessage ? (
                        <p
                          className={`text-xs font-medium ${
                            codeMessage.type === "ok"
                              ? "text-emerald-400"
                              : "text-rose-400"
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

            {/* KPIs principais */}
            <section
              aria-label="Métricas principais do parceiro"
              className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-6"
            >
              <div className="rounded-2xl border border-slate-800 bg-[#0F172A] p-4 space-y-1.5">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Cliques Totais</span>
                  <MousePointerClick className="h-4 w-4 text-indigo-400" />
                </div>
                <p className="text-2xl font-bold text-white tabular-nums">
                  {data.metrics.cliquesTotais}
                </p>
                <p className="text-[11px] text-slate-400 tabular-nums">
                  {data.metrics.cliquesUltimos30Dias} nos últimos 30 dias
                </p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-[#0F172A] p-4 space-y-1.5">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Cadastros</span>
                  <Users className="h-4 w-4 text-cyan-400" />
                </div>
                <p className="text-2xl font-bold text-white tabular-nums">
                  {data.metrics.cadastrosTotais}
                </p>
                <p className="text-[11px] text-slate-400">
                  Contas novas atribuídas
                </p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-[#0F172A] p-4 space-y-1.5">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Assinantes Ativos</span>
                  <UserCheck className="h-4 w-4 text-emerald-400" />
                </div>
                <p className="text-2xl font-bold text-white tabular-nums">
                  {data.metrics.assinantesAtivos}
                </p>
                <p className="text-[11px] text-slate-400">
                  Planos pagos ativos
                </p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-[#0F172A] p-4 space-y-1.5">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Pendentes</span>
                  <Clock className="h-4 w-4 text-amber-400" />
                </div>
                <p className="text-2xl font-bold text-amber-300 tabular-nums">
                  {fmtBrl(data.metrics.comissoesPendentesBrl)}
                </p>
                <p className="text-[11px] text-slate-400">
                  Aguardando repasse
                </p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-[#0F172A] p-4 space-y-1.5">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Pagas</span>
                  <Wallet className="h-4 w-4 text-emerald-400" />
                </div>
                <p className="text-2xl font-bold text-emerald-400 tabular-nums">
                  {fmtBrl(data.metrics.comissoesPagasBrl)}
                </p>
                <p className="text-[11px] text-slate-400">
                  Já repassadas a você
                </p>
              </div>

              <div className="rounded-2xl border border-indigo-900/60 bg-[#0F172A] p-4 space-y-1.5">
                <div className="flex items-center justify-between text-xs text-indigo-300">
                  <span>Total Ganho</span>
                  <TrendingUp className="h-4 w-4 text-indigo-400" />
                </div>
                <p className="text-2xl font-bold text-white tabular-nums">
                  {fmtBrl(data.metrics.totalGanhoBrl)}
                </p>
                <p className="text-[11px] text-slate-400">
                  Pendentes + pagas
                </p>
              </div>
            </section>

            {/* Cliques Diários (últimos 14 registros) */}
            {data.clicksByDay.length > 0 ? (
              <section className="rounded-2xl border border-slate-800 bg-[#0F172A] p-5 sm:p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-white">
                    Cliques Agregados por Dia
                  </h2>
                  <span className="text-xs text-slate-400">
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
                        <span className="text-[10px] font-mono text-slate-300 tabular-nums">
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
              <section className="lg:col-span-8 rounded-2xl border border-slate-800 bg-[#0F172A] overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
                  <h2 className="text-sm font-bold text-white">
                    Últimas Comissões
                  </h2>
                  <span className="text-xs text-slate-400 tabular-nums">
                    {data.commissions.length} registro(s)
                  </span>
                </div>

                {data.commissions.length === 0 ? (
                  <div className="p-8 text-center text-xs sm:text-sm text-slate-400">
                    Nenhuma comissão registrada ainda. Compartilhe seu link{" "}
                    <code className="text-indigo-300">
                      ?ref={data.partner.codigo}
                    </code>{" "}
                    para começar a pontuar.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 bg-[#0B1124] text-slate-400">
                          <th className="px-4 py-3 font-semibold">Data</th>
                          <th className="px-4 py-3 font-semibold">Indicado</th>
                          <th className="px-4 py-3 font-semibold">Plano</th>
                          <th className="px-4 py-3 font-semibold text-right">
                            Valor Bruto
                          </th>
                          <th className="px-4 py-3 font-semibold text-right">
                            Comissão
                          </th>
                          <th className="px-4 py-3 font-semibold">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/80">
                        {data.commissions.map((c) => (
                          <tr
                            key={c.id}
                            className="hover:bg-slate-800/30 transition-colors"
                          >
                            <td className="px-4 py-3 text-slate-300 whitespace-nowrap tabular-nums">
                              {fmtDate(c.criadoEm)}
                            </td>
                            <td className="px-4 py-3 font-mono text-slate-300">
                              {c.maskedEmail}
                            </td>
                            <td className="px-4 py-3 text-slate-200 whitespace-nowrap">
                              <span>{formatPlanLabel(c.plano)}</span>
                              <span className="mx-1.5 text-slate-600">·</span>
                              <span className="text-slate-400">
                                {c.tipo === "renovacao"
                                  ? "Renovação"
                                  : "1º pgto"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-slate-300 tabular-nums whitespace-nowrap">
                              {fmtBrl(c.valorBruto)}
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-bold text-white tabular-nums whitespace-nowrap">
                              {fmtBrl(c.valorComissao)}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              {c.status === "paga" ? (
                                <span className="inline-flex items-center gap-1 font-semibold text-emerald-400">
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  <span>Paga</span>
                                </span>
                              ) : c.status === "estornada" ? (
                                <span className="inline-flex items-center gap-1 font-semibold text-rose-400">
                                  <Ban className="h-3.5 w-3.5" />
                                  <span>Estornada</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 font-semibold text-amber-300">
                                  <Clock className="h-3.5 w-3.5" />
                                  <span>Pendente</span>
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

              <section className="lg:col-span-4 rounded-2xl border border-slate-800 bg-[#0F172A] overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
                  <h2 className="text-sm font-bold text-white">
                    Cadastros Recentes
                  </h2>
                  <Link
                    href="/termos-parceiros"
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-400 hover:underline"
                  >
                    <span>Regras</span>
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>

                {data.referrals.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400">
                    Nenhum cadastro atribuído ao seu código ainda.
                  </div>
                ) : (
                  <ul className="divide-y divide-slate-800/80">
                    {data.referrals.map((ref, i) => (
                      <li
                        key={`${ref.maskedEmail}-${i}`}
                        className="flex items-center justify-between gap-3 px-5 py-3 text-xs"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-mono text-slate-200">
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
                              ? "text-emerald-400"
                              : "text-slate-400"
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
    </div>
  );
}
