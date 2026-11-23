"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Ban,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  Loader2,
  LogIn,
  LogOut,
  MousePointerClick,
  Plus,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  UserCheck,
  Users,
  Wallet,
  XCircle,
} from "lucide-react";
import BrandLogo from "@/components/BrandLogo";
import { useAuth } from "@/components/AuthProvider";

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
  pagaBrl: number;
  estornadaBrl: number;
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
  status: "pendente" | "paga" | "estornada";
  criadoEm: string;
  pagaEm: string | null;
};

type AdminOverviewPayload = {
  adminEmail: string;
  summary: {
    totalParceiros: number;
    parceirosAtivos: number;
    totalCliques: number;
    totalCadastros: number;
    totalPendenteBrl: number;
    totalPagaBrl: number;
  };
  invites: AdminInviteItem[];
  partners: AdminPartnerItem[];
  commissions: AdminCommissionItem[];
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
  const [error, setError] = useState<string | null>(null);

  const [partnerFilter, setPartnerFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Formulário de convite
  const [nomeSugerido, setNomeSugerido] = useState("");
  const [percentualComissao, setPercentualComissao] = useState("45");
  const [validadeDias, setValidadeDias] = useState("14");
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [createdInviteUrl, setCreatedInviteUrl] = useState<string | null>(null);
  const [copiedInviteUrl, setCopiedInviteUrl] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Edição inline de percentual de parceiro
  const [editingPercent, setEditingPercent] = useState<Record<string, string>>(
    {}
  );
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadAdminData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setAccessDenied(null);
    try {
      const qs = new URLSearchParams();
      if (partnerFilter) qs.set("partnerId", partnerFilter);
      if (statusFilter) qs.set("status", statusFilter);

      const res = await fetch(`/api/admin/parceiros?${qs.toString()}`, {
        cache: "no-store",
      });
      const json = (await res.json()) as AdminOverviewPayload & {
        erro?: string;
      };
      if (res.status === 401 || res.status === 403) {
        setAccessDenied(
          json.erro || "Acesso restrito ao administrador autorizado."
        );
        setData(null);
      } else if (!res.ok) {
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
  }, [partnerFilter, statusFilter]);

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
          percentualComissao: Number(percentualComissao || 45),
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
    status: "paga" | "pendente" | "estornada"
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

  const exportCsvUrl = (() => {
    const qs = new URLSearchParams();
    if (partnerFilter) qs.set("partnerId", partnerFilter);
    if (statusFilter) qs.set("status", statusFilter);
    return `/api/admin/parceiros/commissions/export?${qs.toString()}`;
  })();

  return (
    <div className="min-h-screen bg-[#070B16] text-slate-100 flex flex-col">
      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-[#0B1124]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1320px] items-center justify-between gap-8 px-4 py-3.5 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="flex items-center gap-2.5 whitespace-nowrap shrink-0"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#5B4AF4] to-[#2563EB] text-white">
              <BrandLogo className="size-5 text-white" />
            </span>
            <span className="text-base font-bold tracking-tight text-white">
              Artigen Admin
            </span>
          </Link>

          <nav
            aria-label="Navegação administrativa"
            className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300"
          >
            <Link
              href="/parceiro"
              className="hover:text-white hover:underline underline-offset-4 whitespace-nowrap shrink-0"
            >
              Painel Parceiro
            </Link>
            <Link
              href="/studio"
              className="hover:text-white hover:underline underline-offset-4 whitespace-nowrap shrink-0"
            >
              Estúdio
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
          <div className="rounded-2xl border border-slate-800 bg-[#0F172A] p-12 text-center">
            <Loader2 className="mx-auto h-7 w-7 animate-spin text-indigo-400" />
            <p className="mt-3 text-sm text-slate-300">
              A verificar permissão administrativa no servidor…
            </p>
          </div>
        ) : !user ? (
          <div className="mx-auto max-w-lg rounded-2xl border border-slate-800 bg-[#0F172A] p-8 text-center space-y-5">
            <ShieldCheck className="mx-auto h-9 w-9 text-indigo-400" />
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-white">
                Administração de Parceiros
              </h1>
              <p className="text-sm text-slate-300">
                Entre com a conta Google configurada em{" "}
                <code className="text-indigo-300">PARTNER_ADMIN_EMAILS</code>{" "}
                para gerar convites e gerir comissões.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void signInWithGoogle("/admin/parceiros")}
              className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#5B4AF4] to-[#2563EB] px-5 py-3 text-sm font-semibold text-white hover:brightness-110"
            >
              <LogIn className="h-4 w-4" />
              <span>Entrar como Administrador</span>
            </button>
          </div>
        ) : accessDenied ? (
          <div className="mx-auto max-w-lg rounded-2xl border border-rose-800/70 bg-[#0F172A] p-8 text-center space-y-4">
            <ShieldAlert className="mx-auto h-9 w-9 text-rose-400" />
            <h1 className="text-xl font-bold text-white">Acesso negado</h1>
            <p className="text-sm text-slate-300">
              {accessDenied} ({user.email})
            </p>
            <p className="text-xs text-slate-400">
              Adicione seu e-mail na variável de ambiente{" "}
              <code>PARTNER_ADMIN_EMAILS</code> no servidor para liberar o
              acesso.
            </p>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-rose-800/70 bg-rose-950/30 p-6 text-sm text-rose-200">
            {error}
          </div>
        ) : data ? (
          <>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
                  Gestão Administrativa
                </p>
                <h1 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-white">
                  Parceiros, Convites e Comissões
                </h1>
                <p className="mt-1 text-xs text-slate-400">
                  Sessão verificada no servidor: {data.adminEmail}
                </p>
              </div>
            </div>

            {/* Resumo Executivo */}
            <section className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-6">
              <div className="rounded-2xl border border-slate-800 bg-[#0F172A] p-4 space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Parceiros</span>
                  <Users className="h-4 w-4 text-indigo-400" />
                </div>
                <p className="text-2xl font-bold text-white tabular-nums">
                  {data.summary.totalParceiros}
                </p>
                <p className="text-[11px] text-emerald-400 tabular-nums">
                  {data.summary.parceirosAtivos} ativo(s)
                </p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-[#0F172A] p-4 space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Cliques</span>
                  <MousePointerClick className="h-4 w-4 text-cyan-400" />
                </div>
                <p className="text-2xl font-bold text-white tabular-nums">
                  {data.summary.totalCliques}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-[#0F172A] p-4 space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Cadastros</span>
                  <UserCheck className="h-4 w-4 text-indigo-400" />
                </div>
                <p className="text-2xl font-bold text-white tabular-nums">
                  {data.summary.totalCadastros}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-[#0F172A] p-4 space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>A Pagar</span>
                  <Clock className="h-4 w-4 text-amber-400" />
                </div>
                <p className="text-2xl font-bold text-amber-300 tabular-nums">
                  {fmtBrl(data.summary.totalPendenteBrl)}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-[#0F172A] p-4 space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Já Pago</span>
                  <Wallet className="h-4 w-4 text-emerald-400" />
                </div>
                <p className="text-2xl font-bold text-emerald-400 tabular-nums">
                  {fmtBrl(data.summary.totalPagaBrl)}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-[#0F172A] p-4 space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Total Gerado</span>
                  <TrendingUp className="h-4 w-4 text-indigo-400" />
                </div>
                <p className="text-2xl font-bold text-white tabular-nums">
                  {fmtBrl(
                    data.summary.totalPendenteBrl + data.summary.totalPagaBrl
                  )}
                </p>
              </div>
            </section>

            {/* Gerador de Convites + Lista de Convites */}
            <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              <div className="lg:col-span-5 rounded-2xl border border-slate-800 bg-[#0F172A] p-5 sm:p-6 space-y-4">
                <h2 className="text-base font-bold text-white">
                  Criar Convite de Uso Único
                </h2>

                <form onSubmit={handleCreateInvite} className="space-y-3.5">
                  <div>
                    <label
                      htmlFor="invite-nome"
                      className="block text-xs font-medium text-slate-300 mb-1"
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
                      className="w-full rounded-xl border border-slate-700 bg-[#070B16] px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label
                        htmlFor="invite-percent"
                        className="block text-xs font-medium text-slate-300 mb-1"
                      >
                        Comissão (%)
                      </label>
                      <input
                        id="invite-percent"
                        type="number"
                        min={0}
                        max={100}
                        step="0.5"
                        value={percentualComissao}
                        onChange={(e) => setPercentualComissao(e.target.value)}
                        className="w-full rounded-xl border border-slate-700 bg-[#070B16] px-3.5 py-2.5 text-sm font-mono text-white tabular-nums focus:border-indigo-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="invite-days"
                        className="block text-xs font-medium text-slate-300 mb-1"
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
                        className="w-full rounded-xl border border-slate-700 bg-[#070B16] px-3.5 py-2.5 text-sm font-mono text-white tabular-nums focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {inviteError ? (
                    <p className="text-xs text-rose-400">{inviteError}</p>
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
                  <div className="rounded-xl border border-emerald-700/70 bg-emerald-950/35 p-4 space-y-2.5">
                    <p className="text-xs font-bold text-emerald-300">
                      Link gerado (exibido apenas uma vez — copie agora):
                    </p>
                    <div className="overflow-x-auto rounded-lg border border-emerald-800/70 bg-[#070B16] p-2.5 font-mono text-[11px] text-emerald-200 select-all">
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

              <div className="lg:col-span-7 rounded-2xl border border-slate-800 bg-[#0F172A] overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
                  <h2 className="text-sm font-bold text-white">
                    Convites Emitidos
                  </h2>
                  <span className="text-xs text-slate-400 tabular-nums">
                    {data.invites.length} registro(s)
                  </span>
                </div>

                {data.invites.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400">
                    Nenhum convite gerado ainda.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 bg-[#0B1124] text-slate-400">
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
                      <tbody className="divide-y divide-slate-800/80">
                        {data.invites.map((inv) => (
                          <tr key={inv.id} className="hover:bg-slate-800/30">
                            <td className="px-4 py-3 text-white font-medium">
                              {inv.nome_sugerido || "Sem nome sugerido"}
                            </td>
                            <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-200">
                              {inv.percentual_comissao}%
                            </td>
                            <td className="px-4 py-3 text-slate-400 whitespace-nowrap tabular-nums">
                              {fmtDate(inv.expira_em)}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap font-semibold">
                              {inv.status === "pendente" ? (
                                <span className="text-amber-300">Pendente</span>
                              ) : inv.status === "aceito" ? (
                                <span className="text-emerald-400">Aceito</span>
                              ) : inv.status === "cancelado" ? (
                                <span className="text-rose-400">Cancelado</span>
                              ) : (
                                <span className="text-slate-400">Expirado</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right whitespace-nowrap">
                              {inv.status === "pendente" ? (
                                <button
                                  type="button"
                                  disabled={busyId === inv.id}
                                  onClick={() => void handleCancelInvite(inv.id)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-rose-800/70 bg-rose-950/40 px-2.5 py-1 text-[11px] font-semibold text-rose-300 hover:bg-rose-900/50 disabled:opacity-50"
                                >
                                  <XCircle className="h-3 w-3" />
                                  <span>Cancelar</span>
                                </button>
                              ) : (
                                <span className="text-slate-600">—</span>
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
            <section className="rounded-2xl border border-slate-800 bg-[#0F172A] overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
                <h2 className="text-sm font-bold text-white">
                  Parceiros Cadastrados
                </h2>
                <span className="text-xs text-slate-400 tabular-nums">
                  {data.partners.length} parceiro(s)
                </span>
              </div>

              {data.partners.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  Nenhum parceiro aceitou convite ainda.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 bg-[#0B1124] text-slate-400">
                        <th className="px-4 py-3 font-semibold">Parceiro</th>
                        <th className="px-4 py-3 font-semibold">Código</th>
                        <th className="px-4 py-3 font-semibold">Comissão %</th>
                        <th className="px-4 py-3 font-semibold text-right">
                          Cliques / Indicados / Pagos
                        </th>
                        <th className="px-4 py-3 font-semibold text-right">
                          Pendente
                        </th>
                        <th className="px-4 py-3 font-semibold text-right">
                          Pago
                        </th>
                        <th className="px-4 py-3 font-semibold text-right">
                          Ações
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80">
                      {data.partners.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-800/30">
                          <td className="px-4 py-3">
                            <p className="font-semibold text-white">{p.nome}</p>
                            <p className="text-[11px] text-slate-400">
                              {p.email}
                            </p>
                          </td>
                          <td className="px-4 py-3 font-mono text-indigo-300">
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
                                className="w-16 rounded-lg border border-slate-700 bg-[#070B16] px-2 py-1 font-mono text-xs text-white tabular-nums"
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
                                className="rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] font-semibold text-slate-200 hover:bg-slate-700"
                              >
                                Salvar
                              </button>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-200 whitespace-nowrap">
                            {p.cliques} / {p.cadastros} / {p.assinantesAtivos}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-semibold text-amber-300 tabular-nums whitespace-nowrap">
                            {fmtBrl(p.pendenteBrl)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-semibold text-emerald-400 tabular-nums whitespace-nowrap">
                            {fmtBrl(p.pagaBrl)}
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setPartnerFilter(p.id)}
                                className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-slate-200 hover:bg-slate-700"
                              >
                                Filtrar
                              </button>
                              {p.pendenteBrl > 0 ? (
                                <button
                                  type="button"
                                  disabled={busyId === `bulk-${p.id}`}
                                  onClick={() => void handleBulkPayPartner(p.id)}
                                  className="rounded-lg bg-emerald-600/90 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-500"
                                >
                                  Pagar tudo
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
                                    ? "border border-amber-800/70 bg-amber-950/40 text-amber-300 hover:bg-amber-900/50"
                                    : "border border-emerald-800/70 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/50"
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
            <section className="rounded-2xl border border-slate-800 bg-[#0F172A] overflow-hidden">
              <div className="flex flex-col gap-3 border-b border-slate-800 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-sm font-bold text-white">
                    Livro de Comissões
                  </h2>
                  <p className="text-xs text-slate-400">
                    Geradas automaticamente pelo webhook aprovado da Cakto.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={partnerFilter}
                    onChange={(e) => setPartnerFilter(e.target.value)}
                    aria-label="Filtrar por parceiro"
                    className="rounded-xl border border-slate-700 bg-[#070B16] px-3 py-2 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
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
                    className="rounded-xl border border-slate-700 bg-[#070B16] px-3 py-2 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="">Todos os status</option>
                    <option value="pendente">Pendentes</option>
                    <option value="paga">Pagas</option>
                    <option value="estornada">Estornadas</option>
                  </select>

                  <a
                    href={exportCsvUrl}
                    download
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-700 whitespace-nowrap"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Exportar CSV</span>
                  </a>
                </div>
              </div>

              {data.commissions.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  Nenhuma comissão encontrada para os filtros selecionados.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 bg-[#0B1124] text-slate-400">
                        <th className="px-4 py-3 font-semibold">Data</th>
                        <th className="px-4 py-3 font-semibold">Parceiro</th>
                        <th className="px-4 py-3 font-semibold">Indicado</th>
                        <th className="px-4 py-3 font-semibold">
                          Transação Cakto
                        </th>
                        <th className="px-4 py-3 font-semibold">Plano</th>
                        <th className="px-4 py-3 font-semibold text-right">
                          Bruto
                        </th>
                        <th className="px-4 py-3 font-semibold text-right">
                          Comissão
                        </th>
                        <th className="px-4 py-3 font-semibold">Status</th>
                        <th className="px-4 py-3 font-semibold text-right">
                          Repasse
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80">
                      {data.commissions.map((c) => (
                        <tr key={c.id} className="hover:bg-slate-800/30">
                          <td className="px-4 py-3 whitespace-nowrap text-slate-300 tabular-nums">
                            {fmtDate(c.criadoEm)}
                          </td>
                          <td className="px-4 py-3 font-mono text-indigo-300">
                            {c.partnerCodigo}
                          </td>
                          <td className="px-4 py-3 text-slate-300">
                            {c.customerEmail}
                          </td>
                          <td className="px-4 py-3 font-mono text-[11px] text-slate-400">
                            {c.transacaoCakto}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-slate-200">
                            {c.plano} ·{" "}
                            <span className="text-slate-400">
                              {c.tipo === "renovacao" ? "Renovação" : "1º pgto"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-300 whitespace-nowrap">
                            {fmtBrl(c.valorBruto)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-white tabular-nums whitespace-nowrap">
                            {fmtBrl(c.valorComissao)} ({c.percentualAplicado}%)
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap font-semibold">
                            {c.status === "paga" ? (
                              <span className="inline-flex items-center gap-1 text-emerald-400">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                <span>Paga</span>
                              </span>
                            ) : c.status === "estornada" ? (
                              <span className="inline-flex items-center gap-1 text-rose-400">
                                <Ban className="h-3.5 w-3.5" />
                                <span>Estornada</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-amber-300">
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
                                    "paga"
                                  )
                                }
                                className="rounded-lg bg-emerald-600/90 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                              >
                                Marcar paga
                              </button>
                            ) : c.status === "paga" ? (
                              <span className="text-[11px] text-slate-400 tabular-nums">
                                {fmtDate(c.pagaEm)}
                              </span>
                            ) : (
                              <span className="text-slate-600">—</span>
                            )}
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
    </div>
  );
}
