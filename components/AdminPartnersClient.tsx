"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Ban,
  Banknote,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  History,
  Hourglass,
  Loader2,
  LogIn,
  LogOut,
  Mail,
  MousePointerClick,
  Plus,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Users,
  Wallet,
  X,
  XCircle,
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

type AdminInviteItem = {
  id: string;
  nome_sugerido: string;
  percentual_comissao: number;
  expira_em: string;
  status: "pendente" | "aceito" | "expirado" | "cancelado";
  criado_em: string;
  aceito_em: string | null;
};

type AdminPartnerItem = {
  id: string;
  userId: string;
  nome: string;
  email: string;
  codigo: string;
  percentualComissao: number;
  ativo: boolean;
  codigoPersonalizado: boolean;
  criadoEm: string;
  cliques: number;
  cadastros: number;
  assinantesAtivos: number;
  pendenteBrl: number;
  disponivelBrl: number;
  emSaqueBrl: number;
  pagaBrl: number;
  estornadaBrl: number;
  totalGanhoBrl: number;
};

type AdminCommissionItem = {
  id: string;
  partnerId: string;
  partnerCodigo: string;
  userId: string;
  customerEmail: string;
  transacaoCakto: string;
  plano: string;
  ciclo: string;
  tipo: string;
  valorBruto: number;
  percentualAplicado: number;
  valorComissao: number;
  moeda: string;
  status: CommissionStatus;
  criadoEm: string;
  disponivelEm: string;
  pagaEm: string | null;
};

type AdminWithdrawalItem = {
  id: string;
  partnerId: string;
  partnerCodigo: string;
  partnerNome: string;
  partnerEmail: string;
  valorCentavos: number;
  valorBrl: number;
  saldoNoMomentoBrl: number;
  metodo: "pix" | "outro";
  pixTipoChave: string | null;
  dadosPagamento: string;
  status: WithdrawalStatus;
  comprovativoRef: string | null;
  motivoRecusa: string | null;
  solicitadoEm: string;
  analisadoEm: string | null;
  pagoEm: string | null;
  recusadoEm: string | null;
};

type AdminAuditItem = {
  id: string;
  entidade: string;
  entidadeId: string;
  partnerCodigo: string;
  actorType: string;
  actorEmail: string;
  acao: string;
  estadoAnterior: Record<string, unknown> | null;
  estadoNovo: Record<string, unknown> | null;
  motivo: string | null;
  criadoEm: string;
};

type AdminOverviewPayload = {
  adminEmail: string;
  emailService?: {
    configured: boolean;
    domain: string;
    from: string;
  };
  planCommissionRates?: {
    starter: number;
    pro: number;
    agencia: number;
  };
  summary: {
    totalParceiros: number;
    parceirosAtivos: number;
    totalCliques: number;
    totalCadastros: number;
    totalPendenteBrl: number;
    totalDisponivelBrl: number;
    totalEmSaqueBrl: number;
    totalAPagarBrl: number;
    totalPagaBrl: number;
    totalEstornadoBrl: number;
    saquesAbertosCount: number;
  };
  invites: AdminInviteItem[];
  partners: AdminPartnerItem[];
  commissions: AdminCommissionItem[];
  withdrawals: AdminWithdrawalItem[];
  auditLogs: AdminAuditItem[];
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

export default function AdminPartnersClient() {
  const { user, loading: authLoading, signInWithGoogle, signOutUser } = useAuth();

  const [data, setData] = useState<AdminOverviewPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [accessDenied, setAccessDenied] = useState<string | null>(null);
  const [accessDiag, setAccessDiag] = useState<{
    supabaseProjectRef?: string;
    userIdPrefix?: string;
    userProfileRole?: string | null;
    adminProfileRole?: string | null;
    userQueryError?: string | null;
    adminQueryError?: string | null;
    serviceRoleBypassOk?: boolean;
    envSuperAdminConfigured?: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [partnerFilter, setPartnerFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [withdrawalStatusFilter, setWithdrawalStatusFilter] = useState("");

  // Formulário de convite
  const [nomeSugerido, setNomeSugerido] = useState("");
  const [percentualComissao, setPercentualComissao] = useState("35");
  const [validadeDias, setValidadeDias] = useState("14");
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [createdInviteUrl, setCreatedInviteUrl] = useState<string | null>(null);
  const [copiedInviteUrl, setCopiedInviteUrl] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Edição inline e estados de ação
  const [editingPercent, setEditingPercent] = useState<Record<string, string>>(
    {}
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [maturationMessage, setMaturationMessage] = useState<string | null>(
    null
  );
  const [emailTestMessage, setEmailTestMessage] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);

  // Modal de ação de saque (pagar / recusar)
  const [withdrawalActionModal, setWithdrawalActionModal] = useState<{
    item: AdminWithdrawalItem;
    mode: "pago" | "recusado";
  } | null>(null);
  const [comprovativoInput, setComprovativoInput] = useState("");
  const [pagoDateInput, setPagoDateInput] = useState("");
  const [motivoRecusaInput, setMotivoRecusaInput] = useState("");
  const [withdrawalActionError, setWithdrawalActionError] = useState<
    string | null
  >(null);

  const loadAdminData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setAccessDenied(null);
    setAccessDiag(null);
    try {
      const qs = new URLSearchParams();
      if (partnerFilter) qs.set("partnerId", partnerFilter);
      if (statusFilter) qs.set("status", statusFilter);
      if (withdrawalStatusFilter) {
        qs.set("withdrawalStatus", withdrawalStatusFilter);
      }

      const res = await fetch(`/api/admin/parceiros?${qs.toString()}`, {
        cache: "no-store",
      });
      const json = (await res.json()) as AdminOverviewPayload & {
        erro?: string;
        diag?: typeof accessDiag;
      };
      if (res.status === 401 || res.status === 403) {
        setAccessDenied(
          json.erro ||
            "Acesso restrito exclusivamente ao administrador supremo."
        );
        setAccessDiag(json.diag ?? null);
        setData(null);
      } else if (!res.ok) {
        setAccessDiag(json.diag ?? null);
        setError(json.erro || "Erro ao carregar painel administrativo.");
      } else {
        setData(json);
        const pctMap: Record<string, string> = {};
        for (const p of json.partners) {
          pctMap[p.id] = String(p.percentualComissao);
        }
        setEditingPercent(pctMap);
      }
    } catch {
      setError("Falha de rede ao consultar API administrativa.");
    } finally {
      setLoading(false);
    }
  }, [partnerFilter, statusFilter, withdrawalStatusFilter]);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (!active) return;
      if (!authLoading && user) {
        void loadAdminData();
      } else if (!authLoading && !user) {
        setData(null);
        setAccessDenied(null);
      }
    });
    return () => {
      active = false;
    };
  }, [authLoading, user, loadAdminData]);

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (creatingInvite) return;
    setCreatingInvite(true);
    setInviteError(null);
    setCreatedInviteUrl(null);
    setCopiedInviteUrl(false);

    try {
      const res = await fetch("/api/admin/parceiros/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nomeSugerido: nomeSugerido.trim(),
          percentualComissao: Number(percentualComissao || 35),
          validadeDias: Number(validadeDias || 14),
        }),
      });
      const json = (await res.json()) as {
        inviteUrl?: string;
        erro?: string;
      };
      if (!res.ok || !json.inviteUrl) {
        setInviteError(json.erro || "Não foi possível gerar o convite.");
      } else {
        setCreatedInviteUrl(json.inviteUrl);
        setNomeSugerido("");
        await loadAdminData();
      }
    } catch {
      setInviteError("Erro de rede ao gerar convite.");
    } finally {
      setCreatingInvite(false);
    }
  };

  const handleCopyInviteUrl = async () => {
    if (!createdInviteUrl) return;
    try {
      await navigator.clipboard.writeText(createdInviteUrl);
      setCopiedInviteUrl(true);
      setTimeout(() => setCopiedInviteUrl(false), 2500);
    } catch {
      // Ignora
    }
  };

  const handleCancelInvite = async (inviteId: string) => {
    setBusyId(inviteId);
    try {
      await fetch(`/api/admin/parceiros/invites/${inviteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });
      await loadAdminData();
    } finally {
      setBusyId(null);
    }
  };

  const handleUpdatePartner = async (
    partnerId: string,
    payload: { ativo?: boolean; percentualComissao?: number }
  ) => {
    setBusyId(partnerId);
    try {
      await fetch(`/api/admin/parceiros/${partnerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      await loadAdminData();
    } finally {
      setBusyId(null);
    }
  };

  const handleUpdateCommissionStatus = async (
    commissionId: string,
    status: CommissionStatus
  ) => {
    setBusyId(commissionId);
    try {
      await fetch(`/api/admin/parceiros/commissions/${commissionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      await loadAdminData();
    } finally {
      setBusyId(null);
    }
  };

  const handleBulkPayPartner = async (partnerId: string) => {
    setBusyId(`bulk-${partnerId}`);
    try {
      await fetch("/api/admin/parceiros/commissions/bulk-pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partnerId }),
      });
      await loadAdminData();
    } finally {
      setBusyId(null);
    }
  };

  const handleRunMaturationCron = async () => {
    setBusyId("cron-maturar");
    setMaturationMessage(null);
    try {
      const res = await fetch("/api/cron/parceiros/maturar-comissoes", {
        method: "POST",
      });
      const json = (await res.json()) as {
        ok?: boolean;
        maturedCount?: number;
        erro?: string;
      };
      if (res.ok) {
        setMaturationMessage(
          `${json.maturedCount ?? 0} comissão(ões) liberada(s) para disponível.`
        );
        await loadAdminData();
      } else {
        setMaturationMessage(json.erro || "Falha ao processar maturação.");
      }
    } finally {
      setBusyId(null);
    }
  };

  const handleSendTestEmail = async () => {
    setBusyId("email-test");
    setEmailTestMessage(null);
    try {
      const res = await fetch("/api/admin/email-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        to?: string;
        erro?: string;
      };
      if (res.ok && json.ok) {
        setEmailTestMessage({
          ok: true,
          text: `E-mail de teste enviado via Resend para ${json.to ?? data?.adminEmail}.`,
        });
      } else {
        setEmailTestMessage({
          ok: false,
          text: json.erro || "Falha ao enviar e-mail de teste via Resend.",
        });
      }
    } catch {
      setEmailTestMessage({
        ok: false,
        text: "Erro de rede ao testar envio via Resend.",
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleSetWithdrawalInAnalysis = async (withdrawalId: string) => {
    setBusyId(withdrawalId);
    try {
      await fetch(`/api/admin/parceiros/saques/${withdrawalId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "em_analise" }),
      });
      await loadAdminData();
    } finally {
      setBusyId(null);
    }
  };

  const openWithdrawalModal = (
    item: AdminWithdrawalItem,
    mode: "pago" | "recusado"
  ) => {
    setWithdrawalActionError(null);
    setComprovativoInput("");
    setPagoDateInput(new Date().toISOString().slice(0, 10));
    setMotivoRecusaInput("");
    setWithdrawalActionModal({ item, mode });
  };

  const handleSubmitWithdrawalAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!withdrawalActionModal) return;

    const { item, mode } = withdrawalActionModal;
    if (mode === "recusado" && !motivoRecusaInput.trim()) {
      setWithdrawalActionError("Informe o motivo da recusa.");
      return;
    }

    setBusyId(item.id);
    setWithdrawalActionError(null);
    try {
      const res = await fetch(`/api/admin/parceiros/saques/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "pago"
            ? {
                action: "pago",
                comprovativoRef: comprovativoInput.trim(),
                pagoEm: pagoDateInput ? `${pagoDateInput}T12:00:00.000Z` : undefined,
              }
            : {
                action: "recusado",
                motivoRecusa: motivoRecusaInput.trim(),
              }
        ),
      });
      const json = (await res.json()) as { ok?: boolean; erro?: string };
      if (!res.ok) {
        setWithdrawalActionError(
          json.erro || "Não foi possível atualizar o saque."
        );
      } else {
        setWithdrawalActionModal(null);
        await loadAdminData();
      }
    } catch {
      setWithdrawalActionError("Falha de rede ao atualizar pedido de saque.");
    } finally {
      setBusyId(null);
    }
  };

  const exportCsvUrl = (() => {
    const qs = new URLSearchParams();
    if (partnerFilter) qs.set("partnerId", partnerFilter);
    if (statusFilter) qs.set("status", statusFilter);
    return `/api/admin/parceiros/commissions/export?${qs.toString()}`;
  })();

  const exportWithdrawalsCsvUrl = (() => {
    const qs = new URLSearchParams();
    if (partnerFilter) qs.set("partnerId", partnerFilter);
    if (withdrawalStatusFilter) {
      qs.set("withdrawalStatus", withdrawalStatusFilter);
    }
    return `/api/admin/parceiros/saques/export?${qs.toString()}`;
  })();

  const rates = data?.planCommissionRates ?? {
    starter: 20,
    pro: 35,
    agencia: 35,
  };

  return (
    <div className="min-h-screen bg-[#F4F6FB] text-slate-900 dark:bg-[#070B16] dark:text-slate-100 flex flex-col transition-colors duration-150">
      <header className="sticky top-0 z-30 border-b border-slate-200/90 bg-white/90 dark:border-slate-800/80 dark:bg-[#0B1124]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1320px] items-center justify-between gap-6 px-4 py-3.5 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="flex items-center gap-2.5 whitespace-nowrap shrink-0"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#5B4AF4] to-[#2563EB] text-white">
              <BrandLogo className="size-5 text-white" />
            </span>
            <span className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
              Artigen Admin Supremo
            </span>
          </Link>

          <nav
            aria-label="Navegação administrativa"
            className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300"
          >
            <Link
              href="/admin/prospeccao"
              className="hover:text-slate-950 dark:hover:text-white hover:underline underline-offset-4 whitespace-nowrap shrink-0"
            >
              Prospecção IA
            </Link>
            <Link
              href="/admin/roteiros"
              className="hover:text-slate-950 dark:hover:text-white hover:underline underline-offset-4 whitespace-nowrap shrink-0"
            >
              Roteiros & Áudio
            </Link>
            <Link
              href="/admin/emails"
              className="hover:text-slate-950 dark:hover:text-white hover:underline underline-offset-4 whitespace-nowrap shrink-0"
            >
              Caixa de E-mail
            </Link>
            <Link
              href="/parceiro"
              className="hover:text-slate-950 dark:hover:text-white hover:underline underline-offset-4 whitespace-nowrap shrink-0"
            >
              Painel Parceiro
            </Link>
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
              Termos
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
                onClick={() => void signInWithGoogle("/admin/parceiros")}
                className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#5B4AF4] to-[#2563EB] px-4 py-2 text-xs font-semibold text-white hover:brightness-110 whitespace-nowrap shrink-0"
              >
                <LogIn className="h-3.5 w-3.5" />
                <span>Entrar</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1320px] flex-1 px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        {authLoading || (user && loading && !data && !accessDenied) ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-xs dark:border-slate-800 dark:bg-[#0F172A] dark:shadow-none">
            <Loader2 className="mx-auto h-7 w-7 animate-spin text-indigo-600 dark:text-indigo-400" />
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
              A verificar credenciais de administrador supremo no servidor…
            </p>
          </div>
        ) : !user ? (
          <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center space-y-5 shadow-xs dark:border-slate-800 dark:bg-[#0F172A] dark:shadow-none">
            <ShieldCheck className="mx-auto h-9 w-9 text-indigo-600 dark:text-indigo-400" />
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                Acesso do Administrador Supremo
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Área restrita exclusivamente ao administrador supremo do Artigen
                para gerar convites e gerir parceiros, comissões e saques.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void signInWithGoogle("/admin/parceiros")}
              className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#5B4AF4] to-[#2563EB] px-5 py-3 text-sm font-semibold text-white hover:brightness-110"
            >
              <LogIn className="h-4 w-4" />
              <span>Entrar como Administrador Supremo</span>
            </button>
          </div>
        ) : accessDenied ? (
          <div className="mx-auto max-w-lg rounded-2xl border border-rose-200 bg-white p-8 text-center space-y-4 shadow-xs dark:border-rose-800/70 dark:bg-[#0F172A] dark:shadow-none">
            <ShieldAlert className="mx-auto h-9 w-9 text-rose-500 dark:text-rose-400" />
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              Acesso restrito
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {accessDenied}
            </p>
            {user.email ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Sessão atual:{" "}
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {user.email}
                </span>
              </p>
            ) : null}
            {accessDiag ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-left text-[11px] font-mono text-slate-600 space-y-1 dark:border-slate-800 dark:bg-[#070B16] dark:text-slate-400">
                <p>
                  Projeto Supabase:{" "}
                  <span className="text-slate-900 dark:text-slate-200">
                    {accessDiag.supabaseProjectRef}
                  </span>{" "}
                  · ID:{" "}
                  <span className="text-slate-900 dark:text-slate-200">
                    {accessDiag.userIdPrefix}
                  </span>
                </p>
                <p>
                  Papel (cliente):{" "}
                  <span className="text-slate-900 dark:text-slate-200">
                    {accessDiag.userProfileRole ?? "ausente"}
                  </span>{" "}
                  · Papel (servidor):{" "}
                  <span className="text-slate-900 dark:text-slate-200">
                    {accessDiag.adminProfileRole ?? "ausente"}
                  </span>
                </p>
                {accessDiag.adminQueryError || accessDiag.userQueryError ? (
                  <p className="text-rose-600 dark:text-rose-300">
                    Erro DB:{" "}
                    {accessDiag.adminQueryError || accessDiag.userQueryError}
                  </p>
                ) : null}
              </div>
            ) : null}
            <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => void loadAdminData()}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Verificar acesso novamente</span>
              </button>
              <button
                type="button"
                onClick={() => void signOutUser()}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Sair e trocar de conta</span>
              </button>
            </div>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700 space-y-2 dark:border-rose-800/70 dark:bg-rose-950/30 dark:text-rose-200">
            <p>{error}</p>
            {accessDiag ? (
              <p className="text-xs font-mono text-rose-600 dark:text-rose-300/90">
                Projeto Supabase: {accessDiag.supabaseProjectRef} · ID:{" "}
                {accessDiag.userIdPrefix}
                {accessDiag.adminQueryError
                  ? ` · ${accessDiag.adminQueryError}`
                  : ""}
              </p>
            ) : null}
          </div>
        ) : data ? (
          <>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  Administrador Supremo
                </p>
                <h1 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Parceiros, Saques e Livro-Caixa
                </h1>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Sessão verificada: {data.adminEmail}
                  {data.emailService
                    ? ` · Resend (${data.emailService.domain}: ${
                        data.emailService.configured ? "ativo" : "chave ausente"
                      })`
                    : ""}
                  {maturationMessage ? ` · ${maturationMessage}` : ""}
                </p>
                {emailTestMessage ? (
                  <p
                    className={`mt-1 text-xs font-medium ${
                      emailTestMessage.ok
                        ? "text-emerald-700 dark:text-emerald-400"
                        : "text-rose-600 dark:text-rose-400"
                    }`}
                  >
                    {emailTestMessage.text}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={busyId === "email-test"}
                  onClick={() => void handleSendTestEmail()}
                  className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
                >
                  {busyId === "email-test" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Mail className="h-3.5 w-3.5" />
                  )}
                  <span>Testar e-mail Resend</span>
                </button>
                <button
                  type="button"
                  disabled={busyId === "cron-maturar"}
                  onClick={() => void handleRunMaturationCron()}
                  className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${
                      busyId === "cron-maturar" ? "animate-spin" : ""
                    }`}
                  />
                  <span>Liberar garantia vencida</span>
                </button>
              </div>
            </div>

            {/* Tabela de Referência Oficial de Planos e Comissões */}
            <section className="rounded-2xl border border-indigo-200 bg-indigo-50/70 px-5 py-3.5 dark:border-indigo-900/60 dark:bg-indigo-950/25">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-xs">
                <span className="font-semibold text-indigo-900 dark:text-indigo-200">
                  Tabela Oficial Vigente (Planos & Comissões sobre Valor Bruto):
                </span>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-slate-700 dark:text-slate-300 tabular-nums">
                  <span>
                    <strong className="text-slate-900 dark:text-white">
                      Starter
                    </strong>
                    : R$ 34,90 · 14 art / 98 img ·{" "}
                    <strong className="text-emerald-700 dark:text-emerald-400">
                      {rates.starter}% (R$ 6,98)
                    </strong>
                  </span>
                  <span>
                    <strong className="text-slate-900 dark:text-white">Pro</strong>
                    : R$ 94,90 · 33 art / 231 img ·{" "}
                    <strong className="text-emerald-700 dark:text-emerald-400">
                      {rates.pro}% (R$ 33,22)
                    </strong>
                  </span>
                  <span>
                    <strong className="text-slate-900 dark:text-white">
                      Agência
                    </strong>
                    : R$ 149,90 · 48 art / 336 img ·{" "}
                    <strong className="text-emerald-700 dark:text-emerald-400">
                      {rates.agencia}% (R$ 52,47)
                    </strong>
                  </span>
                </div>
              </div>
            </section>

            {/* Resumo Executivo */}
            <section className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-1 shadow-xs dark:border-slate-800 dark:bg-[#0F172A] dark:shadow-none">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>Parceiros</span>
                  <Users className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                </div>
                <p className="text-2xl font-bold text-slate-900 dark:text-white font-mono tabular-nums">
                  {data.summary.totalParceiros}
                </p>
                <p className="text-[11px] text-emerald-700 dark:text-emerald-400 tabular-nums">
                  {data.summary.parceirosAtivos} ativo(s)
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-1 shadow-xs dark:border-slate-800 dark:bg-[#0F172A] dark:shadow-none">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>Cliques / Indicados</span>
                  <MousePointerClick className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                </div>
                <p className="text-2xl font-bold text-slate-900 dark:text-white font-mono tabular-nums">
                  {data.summary.totalCliques}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                  {data.summary.totalCadastros} cadastros
                </p>
              </div>

              <div className="rounded-2xl border border-amber-200 bg-white p-4 space-y-1 lg:col-span-2 shadow-xs dark:border-amber-800/60 dark:bg-[#0F172A] dark:shadow-none">
                <div className="flex items-center justify-between text-xs text-amber-700 dark:text-amber-300">
                  <span>Total de Comissões a Pagar</span>
                  <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                </div>
                <p className="text-2xl font-bold text-amber-700 dark:text-amber-300 font-mono tabular-nums">
                  {fmtBrl(data.summary.totalAPagarBrl)}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                  Pendente {fmtBrl(data.summary.totalPendenteBrl)} · Disponível{" "}
                  {fmtBrl(data.summary.totalDisponivelBrl)} · Em saque{" "}
                  {fmtBrl(data.summary.totalEmSaqueBrl)}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-1 shadow-xs dark:border-slate-800 dark:bg-[#0F172A] dark:shadow-none">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>Total Já Pago</span>
                  <Wallet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 font-mono tabular-nums">
                  {fmtBrl(data.summary.totalPagaBrl)}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                  Estornado: {fmtBrl(data.summary.totalEstornadoBrl)}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-1 shadow-xs dark:border-slate-800 dark:bg-[#0F172A] dark:shadow-none">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>Saques Abertos</span>
                  <Banknote className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                </div>
                <p className="text-2xl font-bold text-slate-900 dark:text-white font-mono tabular-nums">
                  {data.summary.saquesAbertosCount}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Solicitado ou em análise
                </p>
              </div>
            </section>

            {/* Gestão de Pedidos de Saque */}
            <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs dark:border-slate-800 dark:bg-[#0F172A] dark:shadow-none">
              <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                    Pedidos de Saque dos Parceiros
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Confira os dados de pagamento, marque em análise, pague com
                    comprovativo ou recuse devolvendo as comissões para disponível.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={withdrawalStatusFilter}
                    onChange={(e) => setWithdrawalStatusFilter(e.target.value)}
                    aria-label="Filtrar saques por estado"
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-[#070B16] dark:text-slate-200"
                  >
                    <option value="">Todos os estados</option>
                    <option value="solicitado">Solicitado</option>
                    <option value="em_analise">Em análise</option>
                    <option value="pago">Pago</option>
                    <option value="recusado">Recusado</option>
                  </select>

                  <a
                    href={exportWithdrawalsCsvUrl}
                    download
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-100 px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700 whitespace-nowrap"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Exportar Saques CSV</span>
                  </a>
                </div>
              </div>

              {data.withdrawals.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
                  Nenhum pedido de saque encontrado para os filtros aplicados.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-[#0B1124] dark:text-slate-400">
                        <th className="px-4 py-3 font-semibold">Data</th>
                        <th className="px-4 py-3 font-semibold">Parceiro</th>
                        <th className="px-4 py-3 font-semibold text-right">
                          Valor
                        </th>
                        <th className="px-4 py-3 font-semibold text-right">
                          Saldo no Pedido
                        </th>
                        <th className="px-4 py-3 font-semibold">
                          Método e Dados
                        </th>
                        <th className="px-4 py-3 font-semibold">Estado</th>
                        <th className="px-4 py-3 font-semibold text-right">
                          Ações
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/80 dark:divide-slate-800/80">
                      {data.withdrawals.map((w) => (
                        <tr
                          key={w.id}
                          className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                        >
                          <td className="px-4 py-3 whitespace-nowrap text-slate-700 dark:text-slate-300 tabular-nums">
                            {fmtDate(w.solicitadoEm)}
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-semibold text-slate-900 dark:text-white">
                              {w.partnerNome}{" "}
                              <span className="font-mono text-indigo-700 dark:text-indigo-300">
                                ({w.partnerCodigo})
                              </span>
                            </p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              {w.partnerEmail}
                            </p>
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 dark:text-white tabular-nums whitespace-nowrap">
                            {fmtBrl(w.valorBrl)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-slate-700 dark:text-slate-300 tabular-nums whitespace-nowrap">
                            {fmtBrl(w.saldoNoMomentoBrl)}
                          </td>
                          <td className="px-4 py-3 max-w-xs">
                            <p className="font-semibold text-slate-800 dark:text-slate-200">
                              {w.metodo === "pix"
                                ? `Pix (${w.pixTipoChave ?? "chave"})`
                                : "Outro método"}
                            </p>
                            <p className="font-mono text-[11px] text-slate-500 dark:text-slate-400 break-all">
                              {w.dadosPagamento}
                            </p>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {w.status === "solicitado" ? (
                              <span className="inline-flex items-center gap-1 font-semibold text-amber-700 dark:text-amber-300">
                                <Clock className="h-3.5 w-3.5" />
                                <span>Solicitado</span>
                              </span>
                            ) : w.status === "em_analise" ? (
                              <span className="inline-flex items-center gap-1 font-semibold text-indigo-700 dark:text-indigo-300">
                                <Hourglass className="h-3.5 w-3.5" />
                                <span>Em análise</span>
                              </span>
                            ) : w.status === "pago" ? (
                              <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                <span>Pago</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 font-semibold text-rose-600 dark:text-rose-400">
                                <Ban className="h-3.5 w-3.5" />
                                <span>Recusado</span>
                              </span>
                            )}
                            {w.comprovativoRef ? (
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                Ref: {w.comprovativoRef}
                              </div>
                            ) : null}
                            {w.motivoRecusa ? (
                              <div className="text-[11px] text-rose-600 dark:text-rose-300 mt-0.5">
                                {w.motivoRecusa}
                              </div>
                            ) : null}
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            {w.status === "solicitado" ||
                            w.status === "em_analise" ? (
                              <div className="inline-flex items-center gap-1.5">
                                {w.status === "solicitado" ? (
                                  <button
                                    type="button"
                                    disabled={busyId === w.id}
                                    onClick={() =>
                                      void handleSetWithdrawalInAnalysis(w.id)
                                    }
                                    className="rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-100 dark:border-indigo-700/70 dark:bg-indigo-950/50 dark:text-indigo-200 dark:hover:bg-indigo-900/60"
                                  >
                                    Em análise
                                  </button>
                                ) : null}
                                <button
                                  type="button"
                                  disabled={busyId === w.id}
                                  onClick={() => openWithdrawalModal(w, "pago")}
                                  className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-500"
                                >
                                  Marcar pago
                                </button>
                                <button
                                  type="button"
                                  disabled={busyId === w.id}
                                  onClick={() =>
                                    openWithdrawalModal(w, "recusado")
                                  }
                                  className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-100 dark:border-rose-800/70 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-900/50"
                                >
                                  Recusar
                                </button>
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                                {fmtDate(w.pagoEm ?? w.recusadoEm)}
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

            {/* Gerador de Convites + Lista de Convites */}
            <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              <div className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-4 shadow-xs dark:border-slate-800 dark:bg-[#0F172A] dark:shadow-none">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Criar Convite de Uso Único
                  </h2>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    O cálculo automático nos planos segue as taxas oficiais
                    (Starter {rates.starter}%, Pro {rates.pro}%, Agência{" "}
                    {rates.agencia}%).
                  </p>
                </div>

                <form onSubmit={handleCreateInvite} className="space-y-3.5">
                  <div>
                    <label
                      htmlFor="invite-nome"
                      className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                    >
                      Nome do influenciador / canal (opcional)
                    </label>
                    <input
                      id="invite-nome"
                      type="text"
                      value={nomeSugerido}
                      onChange={(e) => setNomeSugerido(e.target.value)}
                      maxLength={100}
                      placeholder="Ex: Kildary SEO"
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-[#070B16] dark:text-white dark:placeholder:text-slate-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label
                        htmlFor="invite-percent"
                        className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                      >
                        Comissão base (%)
                      </label>
                      <input
                        id="invite-percent"
                        type="number"
                        min={0}
                        max={100}
                        step="0.5"
                        value={percentualComissao}
                        onChange={(e) => setPercentualComissao(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-mono text-slate-900 tabular-nums focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-[#070B16] dark:text-white"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="invite-days"
                        className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                      >
                        Validade (dias)
                      </label>
                      <input
                        id="invite-days"
                        type="number"
                        min={1}
                        max={365}
                        value={validadeDias}
                        onChange={(e) => setValidadeDias(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-mono text-slate-900 tabular-nums focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-[#070B16] dark:text-white"
                      />
                    </div>
                  </div>

                  {inviteError ? (
                    <p className="text-xs text-rose-600 dark:text-rose-400">
                      {inviteError}
                    </p>
                  ) : null}

                  <button
                    type="submit"
                    disabled={creatingInvite}
                    className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#5B4AF4] to-[#2563EB] px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50"
                  >
                    {creatingInvite ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                    <span>Gerar link de convite</span>
                  </button>
                </form>

                {createdInviteUrl ? (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-2.5 dark:border-emerald-700/70 dark:bg-emerald-950/35">
                    <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                      Link gerado (exibido apenas uma vez — copie agora):
                    </p>
                    <div className="overflow-x-auto rounded-lg border border-emerald-200 bg-white p-2.5 font-mono text-[11px] text-emerald-800 dark:border-emerald-800/70 dark:bg-[#070B16] dark:text-emerald-200 select-all">
                      {createdInviteUrl}
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleCopyInviteUrl()}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
                    >
                      {copiedInviteUrl ? (
                        <>
                          <Check className="h-3.5 w-3.5" />
                          <span>Link copiado!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          <span>Copiar link completo</span>
                        </>
                      )}
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs dark:border-slate-800 dark:bg-[#0F172A] dark:shadow-none">
                <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                    Convites Emitidos
                  </h2>
                  <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    {data.invites.length} registro(s)
                  </span>
                </div>

                {data.invites.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
                    Nenhum convite gerado ainda.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-[#0B1124] dark:text-slate-400">
                          <th className="px-4 py-3 font-semibold">Nome</th>
                          <th className="px-4 py-3 font-semibold text-right">
                            Comissão
                          </th>
                          <th className="px-4 py-3 font-semibold">Validade</th>
                          <th className="px-4 py-3 font-semibold">Status</th>
                          <th className="px-4 py-3 font-semibold text-right">
                            Ação
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/80 dark:divide-slate-800/80">
                        {data.invites.map((inv) => (
                          <tr
                            key={inv.id}
                            className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                          >
                            <td className="px-4 py-3 text-slate-900 dark:text-white font-medium">
                              {inv.nome_sugerido || "Sem nome sugerido"}
                            </td>
                            <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-700 dark:text-slate-200">
                              {inv.percentual_comissao}%
                            </td>
                            <td className="px-4 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap tabular-nums">
                              {fmtDate(inv.expira_em)}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap font-semibold">
                              {inv.status === "pendente" ? (
                                <span className="text-amber-700 dark:text-amber-300">
                                  Pendente
                                </span>
                              ) : inv.status === "aceito" ? (
                                <span className="text-emerald-700 dark:text-emerald-400">
                                  Aceito
                                </span>
                              ) : inv.status === "cancelado" ? (
                                <span className="text-rose-600 dark:text-rose-400">
                                  Cancelado
                                </span>
                              ) : (
                                <span className="text-slate-500 dark:text-slate-400">
                                  Expirado
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right whitespace-nowrap">
                              {inv.status === "pendente" ? (
                                <button
                                  type="button"
                                  disabled={busyId === inv.id}
                                  onClick={() => void handleCancelInvite(inv.id)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50 dark:border-rose-800/70 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-900/50"
                                >
                                  <XCircle className="h-3 w-3" />
                                  <span>Cancelar</span>
                                </button>
                              ) : (
                                <span className="text-slate-400 dark:text-slate-600">
                                  —
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>

            {/* Parceiros */}
            <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs dark:border-slate-800 dark:bg-[#0F172A] dark:shadow-none">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Parceiros Cadastrados (Saldos Derivados)
                </h2>
                <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                  {data.partners.length} parceiro(s)
                </span>
              </div>

              {data.partners.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
                  Nenhum parceiro aceitou convite ainda.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-[#0B1124] dark:text-slate-400">
                        <th className="px-4 py-3 font-semibold">Parceiro</th>
                        <th className="px-4 py-3 font-semibold">Código</th>
                        <th className="px-4 py-3 font-semibold">Comissão %</th>
                        <th className="px-4 py-3 font-semibold text-right">
                          Cliq / Cad / Assin
                        </th>
                        <th className="px-4 py-3 font-semibold text-right">
                          Pendente
                        </th>
                        <th className="px-4 py-3 font-semibold text-right">
                          Disponível
                        </th>
                        <th className="px-4 py-3 font-semibold text-right">
                          Já Recebido
                        </th>
                        <th className="px-4 py-3 font-semibold text-right">
                          Ações
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/80 dark:divide-slate-800/80">
                      {data.partners.map((p) => (
                        <tr
                          key={p.id}
                          className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                        >
                          <td className="px-4 py-3">
                            <p className="font-semibold text-slate-900 dark:text-white">
                              {p.nome}
                            </p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              {p.email}
                            </p>
                          </td>
                          <td className="px-4 py-3 font-mono text-indigo-700 dark:text-indigo-300">
                            ?ref={p.codigo}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                min={0}
                                max={100}
                                step="0.5"
                                value={
                                  editingPercent[p.id] ??
                                  String(p.percentualComissao)
                                }
                                onChange={(e) =>
                                  setEditingPercent((prev) => ({
                                    ...prev,
                                    [p.id]: e.target.value,
                                  }))
                                }
                                aria-label={`Comissão de ${p.codigo}`}
                                className="w-16 rounded-lg border border-slate-300 bg-white px-2 py-1 font-mono text-xs text-slate-900 tabular-nums dark:border-slate-700 dark:bg-[#070B16] dark:text-white"
                              />
                              <button
                                type="button"
                                disabled={busyId === p.id}
                                onClick={() =>
                                  void handleUpdatePartner(p.id, {
                                    percentualComissao: Number(
                                      editingPercent[p.id] ??
                                        p.percentualComissao
                                    ),
                                  })
                                }
                                className="rounded-lg border border-slate-200 bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                              >
                                Salvar
                              </button>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-700 dark:text-slate-200 whitespace-nowrap">
                            {p.cliques} / {p.cadastros} / {p.assinantesAtivos}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-semibold text-amber-700 dark:text-amber-300 tabular-nums whitespace-nowrap">
                            {fmtBrl(p.pendenteBrl)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-semibold text-cyan-700 dark:text-cyan-300 tabular-nums whitespace-nowrap">
                            {fmtBrl(p.disponivelBrl)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums whitespace-nowrap">
                            {fmtBrl(p.pagaBrl)}
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setPartnerFilter(p.id)}
                                className="rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                              >
                                Filtrar
                              </button>
                              {p.disponivelBrl > 0 ? (
                                <button
                                  type="button"
                                  disabled={busyId === `bulk-${p.id}`}
                                  onClick={() => void handleBulkPayPartner(p.id)}
                                  className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-500"
                                >
                                  Pagar disponíveis
                                </button>
                              ) : null}
                              <button
                                type="button"
                                disabled={busyId === p.id}
                                onClick={() =>
                                  void handleUpdatePartner(p.id, {
                                    ativo: !p.ativo,
                                  })
                                }
                                className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold ${
                                  p.ativo
                                    ? "border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-800/70 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-900/50"
                                    : "border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800/70 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/50"
                                }`}
                              >
                                {p.ativo ? "Desativar" : "Reativar"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Comissões e Exportação CSV */}
            <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs dark:border-slate-800 dark:bg-[#0F172A] dark:shadow-none">
              <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                    Livro de Comissões
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Geradas automaticamente pelo webhook aprovado da Cakto.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={partnerFilter}
                    onChange={(e) => setPartnerFilter(e.target.value)}
                    aria-label="Filtrar por parceiro"
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-[#070B16] dark:text-slate-200"
                  >
                    <option value="">Todos os parceiros</option>
                    {data.partners.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.codigo} ({p.nome})
                      </option>
                    ))}
                  </select>

                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    aria-label="Filtrar por status"
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-[#070B16] dark:text-slate-200"
                  >
                    <option value="">Todos os status</option>
                    <option value="pendente">Pendentes (garantia)</option>
                    <option value="disponivel">Disponíveis</option>
                    <option value="em_saque">Em saque</option>
                    <option value="paga">Pagas</option>
                    <option value="estornada">Estornadas</option>
                  </select>

                  <a
                    href={exportCsvUrl}
                    download
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-100 px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700 whitespace-nowrap"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Exportar Comissões CSV</span>
                  </a>
                </div>
              </div>

              {data.commissions.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
                  Nenhuma comissão encontrada para os filtros selecionados.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-[#0B1124] dark:text-slate-400">
                        <th className="px-4 py-3 font-semibold">Data</th>
                        <th className="px-4 py-3 font-semibold">Parceiro</th>
                        <th className="px-4 py-3 font-semibold">Indicado</th>
                        <th className="px-4 py-3 font-semibold">
                          Transação Cakto
                        </th>
                        <th className="px-4 py-3 font-semibold">Plano</th>
                        <th className="px-4 py-3 font-semibold text-right">
                          Base
                        </th>
                        <th className="px-4 py-3 font-semibold text-right">
                          Comissão
                        </th>
                        <th className="px-4 py-3 font-semibold">Status</th>
                        <th className="px-4 py-3 font-semibold text-right">
                          Ação
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/80 dark:divide-slate-800/80">
                      {data.commissions.map((c) => (
                        <tr
                          key={c.id}
                          className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                        >
                          <td className="px-4 py-3 whitespace-nowrap text-slate-700 dark:text-slate-300 tabular-nums">
                            {fmtDate(c.criadoEm)}
                          </td>
                          <td className="px-4 py-3 font-mono text-indigo-700 dark:text-indigo-300">
                            {c.partnerCodigo}
                          </td>
                          <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                            {c.customerEmail}
                          </td>
                          <td className="px-4 py-3 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                            {c.transacaoCakto}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-slate-800 dark:text-slate-200">
                            {c.plano} ·{" "}
                            <span className="text-slate-500 dark:text-slate-400">
                              {c.tipo === "renovacao" ? "Renovação" : "1º pgto"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300 whitespace-nowrap">
                            {fmtBrl(c.valorBruto)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 dark:text-white tabular-nums whitespace-nowrap">
                            {fmtBrl(c.valorComissao)} ({c.percentualAplicado}%)
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap font-semibold">
                            {c.status === "paga" ? (
                              <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                <span>Paga</span>
                              </span>
                            ) : c.status === "disponivel" ? (
                              <span className="inline-flex items-center gap-1 text-cyan-700 dark:text-cyan-300">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                <span>Disponível</span>
                              </span>
                            ) : c.status === "em_saque" ? (
                              <span className="inline-flex items-center gap-1 text-indigo-700 dark:text-indigo-300">
                                <Hourglass className="h-3.5 w-3.5" />
                                <span>Em saque</span>
                              </span>
                            ) : c.status === "estornada" ? (
                              <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400">
                                <Ban className="h-3.5 w-3.5" />
                                <span>Estornada</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300">
                                <Clock className="h-3.5 w-3.5" />
                                <span>Pendente</span>
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            {c.status === "pendente" ? (
                              <button
                                type="button"
                                disabled={busyId === c.id}
                                onClick={() =>
                                  void handleUpdateCommissionStatus(
                                    c.id,
                                    "disponivel"
                                  )
                                }
                                className="rounded-lg border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-[11px] font-semibold text-cyan-800 hover:bg-cyan-100 disabled:opacity-50 dark:border-cyan-800/70 dark:bg-cyan-950/40 dark:text-cyan-200 dark:hover:bg-cyan-900/50"
                              >
                                Liberar
                              </button>
                            ) : c.status === "disponivel" ? (
                              <button
                                type="button"
                                disabled={busyId === c.id}
                                onClick={() =>
                                  void handleUpdateCommissionStatus(
                                    c.id,
                                    "paga"
                                  )
                                }
                                className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                              >
                                Marcar paga
                              </button>
                            ) : c.status === "paga" ? (
                              <span className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                                {fmtDate(c.pagaEm)}
                              </span>
                            ) : (
                              <span className="text-slate-400 dark:text-slate-600">
                                —
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

            {/* Auditoria Recente */}
            <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs dark:border-slate-800 dark:bg-[#0F172A] dark:shadow-none">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                    Auditoria de Mudanças de Estado
                  </h2>
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                  {data.auditLogs.length} evento(s) recente(s)
                </span>
              </div>

              {data.auditLogs.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
                  Nenhum registro de auditoria ainda.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-[#0B1124] dark:text-slate-400">
                        <th className="px-4 py-3 font-semibold">Quando</th>
                        <th className="px-4 py-3 font-semibold">Quem</th>
                        <th className="px-4 py-3 font-semibold">Parceiro</th>
                        <th className="px-4 py-3 font-semibold">Ação</th>
                        <th className="px-4 py-3 font-semibold">
                          Antes → Depois
                        </th>
                        <th className="px-4 py-3 font-semibold">Motivo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/80 dark:divide-slate-800/80">
                      {data.auditLogs.map((log) => (
                        <tr
                          key={log.id}
                          className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                        >
                          <td className="px-4 py-3 whitespace-nowrap text-slate-700 dark:text-slate-300 tabular-nums">
                            {fmtDate(log.criadoEm)}
                          </td>
                          <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                            <span className="font-semibold text-slate-900 dark:text-white">
                              {log.actorType}
                            </span>
                            {log.actorEmail ? (
                              <span className="ml-1 text-slate-500 dark:text-slate-400">
                                ({log.actorEmail})
                              </span>
                            ) : null}
                          </td>
                          <td className="px-4 py-3 font-mono text-indigo-700 dark:text-indigo-300">
                            {log.partnerCodigo}
                          </td>
                          <td className="px-4 py-3 font-mono text-slate-800 dark:text-slate-200">
                            {log.entidade}.{log.acao}
                          </td>
                          <td className="px-4 py-3 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                            {String(log.estadoAnterior?.status ?? "—")} →{" "}
                            <span className="font-semibold text-slate-900 dark:text-white">
                              {String(log.estadoNovo?.status ?? "—")}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                            {log.motivo || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        ) : null}
      </main>

      {/* Modal Admin: Marcar Saque como Pago ou Recusar */}
      {withdrawalActionModal ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-admin-saque-titulo"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 space-y-4 shadow-xl dark:border-slate-800 dark:bg-[#0F172A] dark:shadow-none">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2
                  id="modal-admin-saque-titulo"
                  className="text-lg font-bold text-slate-900 dark:text-white"
                >
                  {withdrawalActionModal.mode === "pago"
                    ? "Confirmar pagamento de saque"
                    : "Recusar pedido de saque"}
                </h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {withdrawalActionModal.item.partnerNome} (
                  {withdrawalActionModal.item.partnerCodigo}) ·{" "}
                  <strong className="text-slate-900 dark:text-white font-mono tabular-nums">
                    {fmtBrl(withdrawalActionModal.item.valorBrl)}
                  </strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setWithdrawalActionModal(null)}
                aria-label="Fechar janela"
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form
              onSubmit={handleSubmitWithdrawalAction}
              className="space-y-4"
            >
              {withdrawalActionModal.mode === "pago" ? (
                <>
                  <div>
                    <label
                      htmlFor="admin-comprovativo"
                      className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                    >
                      Referência / Comprovativo (ID Pix, E2E ou link)
                    </label>
                    <input
                      id="admin-comprovativo"
                      type="text"
                      value={comprovativoInput}
                      onChange={(e) => setComprovativoInput(e.target.value)}
                      maxLength={300}
                      placeholder="Ex: E0000000020261123..."
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-[#070B16] dark:text-white dark:placeholder:text-slate-500"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="admin-pago-data"
                      className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                    >
                      Data do pagamento
                    </label>
                    <input
                      id="admin-pago-data"
                      type="date"
                      value={pagoDateInput}
                      onChange={(e) => setPagoDateInput(e.target.value)}
                      required
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-[#070B16] dark:text-white"
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label
                    htmlFor="admin-motivo-recusa"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Motivo da recusa (enviado ao parceiro)
                  </label>
                  <textarea
                    id="admin-motivo-recusa"
                    required
                    rows={3}
                    maxLength={500}
                    value={motivoRecusaInput}
                    onChange={(e) => setMotivoRecusaInput(e.target.value)}
                    placeholder="Ex: Chave Pix divergente da titularidade do parceiro."
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-[#070B16] dark:text-white dark:placeholder:text-slate-500"
                  />
                </div>
              )}

              {withdrawalActionError ? (
                <p className="text-xs text-rose-600 dark:text-rose-400">
                  {withdrawalActionError}
                </p>
              ) : null}

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setWithdrawalActionModal(null)}
                  className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={busyId === withdrawalActionModal.item.id}
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold text-white disabled:opacity-50 ${
                    withdrawalActionModal.mode === "pago"
                      ? "bg-emerald-600 hover:bg-emerald-500"
                      : "bg-rose-600 hover:bg-rose-500"
                  }`}
                >
                  {busyId === withdrawalActionModal.item.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : null}
                  <span>
                    {withdrawalActionModal.mode === "pago"
                      ? "Confirmar pago"
                      : "Confirmar recusa"}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
