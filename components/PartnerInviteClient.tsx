"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Handshake,
  Loader2,
  LogIn,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import BrandLogo from "@/components/BrandLogo";
import { useAuth } from "@/components/AuthProvider";

type InviteInspection = {
  status: "pendente" | "aceito" | "expirado" | "cancelado";
  nomeSugerido: string;
  percentualComissao: number;
  expiraEm: string;
  alreadyPartner: boolean;
  existingPartnerCode: string | null;
};

export default function PartnerInviteClient({ token }: { token: string }) {
  const router = useRouter();
  const { user, loading: authLoading, signInWithGoogle, signOutUser } = useAuth();

  const [invite, setInvite] = useState<InviteInspection | null>(null);
  const [loadingInvite, setLoadingInvite] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [agreedTerms, setAgreedTerms] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const [acceptedCode, setAcceptedCode] = useState<string | null>(null);

  const loadInvite = useCallback(async () => {
    setLoadingInvite(true);
    setFetchError(null);
    try {
      const res = await fetch(
        `/api/parceiros/convite/${encodeURIComponent(token)}`,
        { cache: "no-store" }
      );
      const data = (await res.json()) as InviteInspection & { erro?: string };
      if (!res.ok) {
        setFetchError(data.erro || "Convite inválido ou não encontrado.");
        setInvite(null);
      } else {
        setInvite(data);
      }
    } catch {
      setFetchError("Não foi possível validar o convite no momento.");
    } finally {
      setLoadingInvite(false);
    }
  }, [token]);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (!active || authLoading) return;
      void loadInvite();
    });
    return () => {
      active = false;
    };
  }, [authLoading, loadInvite, user?.uid]);

  const handleAcceptInvite = async () => {
    if (!agreedTerms || accepting) return;
    setAccepting(true);
    setAcceptError(null);
    try {
      const res = await fetch(
        `/api/parceiros/convite/${encodeURIComponent(token)}/accept`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }
      );
      const data = (await res.json()) as {
        ok?: boolean;
        erro?: string;
        partner?: { codigo?: string };
        existingCode?: string;
      };
      if (!res.ok) {
        setAcceptError(
          data.erro || "Não foi possível concluir o aceite do convite."
        );
        if (data.existingCode) {
          setAcceptedCode(data.existingCode);
        }
      } else {
        setAcceptedCode(data.partner?.codigo ?? null);
        setTimeout(() => {
          router.push("/parceiro");
        }, 1200);
      }
    } catch {
      setAcceptError("Erro de rede ao ativar sua conta de parceiro.");
    } finally {
      setAccepting(false);
    }
  };

  const formattedExpiry = invite?.expiraEm
    ? new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "long",
        timeStyle: "short",
      }).format(new Date(invite.expiraEm))
    : "";

  return (
    <div className="min-h-screen bg-[#070B16] text-slate-100 flex flex-col">
      <header className="border-b border-slate-800/80 bg-[#0B1124]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1040px] items-center justify-between px-4 py-4 sm:px-6">
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

          <Link
            href="/termos-parceiros"
            className="text-xs font-medium text-slate-300 hover:text-white hover:underline underline-offset-4 whitespace-nowrap"
          >
            Regras do Programa
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[920px] flex-1 items-center justify-center px-4 py-10 sm:px-6">
        {loadingInvite || authLoading ? (
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-[#0F172A] p-8 text-center">
            <Loader2 className="mx-auto h-7 w-7 animate-spin text-indigo-400" />
            <p className="mt-3 text-sm text-slate-300">
              A validar seu convite exclusivo de parceria…
            </p>
          </div>
        ) : fetchError || !invite ? (
          <div className="w-full max-w-lg rounded-2xl border border-rose-900/60 bg-[#0F172A] p-8 text-center space-y-4">
            <AlertCircle className="mx-auto h-9 w-9 text-rose-400" />
            <h1 className="text-xl font-bold text-white">
              Convite indisponível
            </h1>
            <p className="text-sm text-slate-300">
              {fetchError || "Este link de convite não é mais válido."}
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-700"
            >
              <span>Voltar para o Artigen</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <div className="w-full grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Resumo dos benefícios do programa */}
            <div className="lg:col-span-7 rounded-2xl border border-slate-800 bg-[#0F172A] p-6 sm:p-8 space-y-6">
              <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-400">
                <Handshake className="h-4 w-4" />
                <span>Convite Oficial de Parceria</span>
              </div>

              <div className="space-y-2">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white text-balance">
                  {invite.nomeSugerido
                    ? `Olá, ${invite.nomeSugerido}! Bem-vindo ao Programa de Parceiros Artigen`
                    : "Você foi convidado para o Programa de Parceiros Artigen"}
                </h1>
                <p className="text-sm leading-relaxed text-slate-300">
                  Indique criadores de conteúdo, redatores, blogs e agências
                  para o Artigen e receba comissão recorrente sobre cada
                  assinatura aprovada via Pix, Cartão ou Boleto.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="rounded-xl border border-slate-800 bg-[#0B1124] p-4">
                  <span className="text-xs font-medium text-slate-400">
                    Sua Comissão Definida
                  </span>
                  <p className="mt-1 text-2xl font-bold text-emerald-400 tabular-nums">
                    {invite.percentualComissao}%
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Sobre o valor bruto da primeira assinatura e renovações.
                  </p>
                </div>

                <div className="rounded-xl border border-slate-800 bg-[#0B1124] p-4">
                  <span className="text-xs font-medium text-slate-400">
                    Janela de Atribuição
                  </span>
                  <p className="mt-1 text-2xl font-bold text-indigo-400 tabular-nums">
                    60 dias
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Cookie seguro first-touch e vínculo permanente após cadastro.
                  </p>
                </div>
              </div>

              <ul className="space-y-2.5 border-t border-slate-800 pt-5 text-xs sm:text-sm text-slate-300">
                <li className="flex items-start gap-2.5">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-indigo-400" />
                  <span>
                    Link personalizado exclusivo (ex:{" "}
                    <code className="text-indigo-300">
                      criador.artificializar.site/?ref=seucodigo
                    </code>
                    ) + QR Code pronto.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                  <span>
                    Painel em tempo real com cliques diários, cadastros,
                    assinantes ativos e extrato de comissões.
                  </span>
                </li>
                {invite.status === "pendente" && formattedExpiry ? (
                  <li className="flex items-start gap-2.5 text-slate-400">
                    <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                    <span>Convite de uso único válido até {formattedExpiry}.</span>
                  </li>
                ) : null}
              </ul>
            </div>

            {/* Card de Ação / Login / Aceite */}
            <div className="lg:col-span-5 rounded-2xl border border-slate-800 bg-[#0F172A] p-6 sm:p-7 flex flex-col justify-between space-y-6">
              {acceptedCode || invite.alreadyPartner ? (
                <div className="space-y-4">
                  <CheckCircle2 className="h-10 w-10 text-emerald-400" />
                  <h2 className="text-xl font-bold text-white">
                    Perfil de Parceiro Ativo!
                  </h2>
                  <p className="text-sm text-slate-300">
                    Sua conta já está habilitada no programa de parceiros
                    {acceptedCode || invite.existingPartnerCode ? (
                      <>
                        {" "}
                        com o código{" "}
                        <code className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-indigo-300">
                          {acceptedCode || invite.existingPartnerCode}
                        </code>
                      </>
                    ) : null}
                    .
                  </p>
                  <Link
                    href="/parceiro"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#5B4AF4] to-[#2563EB] px-5 py-3 text-sm font-semibold text-white hover:brightness-110"
                  >
                    <span>Abrir Painel do Parceiro</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              ) : invite.status !== "pendente" ? (
                <div className="space-y-4">
                  <AlertCircle className="h-9 w-9 text-amber-400" />
                  <h2 className="text-xl font-bold text-white">
                    {invite.status === "aceito"
                      ? "Convite já utilizado"
                      : invite.status === "cancelado"
                      ? "Convite cancelado"
                      : "Convite expirado"}
                  </h2>
                  <p className="text-sm text-slate-300">
                    Este link de convite é de uso único e encontra-se no estado{" "}
                    <strong className="text-white">{invite.status}</strong>.
                    Caso precise de acesso, solicite um novo convite ao
                    administrador.
                  </p>
                  <Link
                    href="/"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-700"
                  >
                    <span>Ir para o site</span>
                  </Link>
                </div>
              ) : !user ? (
                <div className="space-y-5">
                  <div className="space-y-2">
                    <h2 className="text-lg font-bold text-white">
                      1. Crie sua conta ou faça login
                    </h2>
                    <p className="text-xs sm:text-sm leading-relaxed text-slate-300">
                      Entre com sua conta Google para vincular sua parceria.
                      Após autenticar, você retornará automaticamente para
                      ativar este convite.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      void signInWithGoogle(`/parceiro/convite/${token}`);
                    }}
                    className="inline-flex min-h-[44px] w-full items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-[#5B4AF4] to-[#2563EB] px-5 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:brightness-110"
                  >
                    <LogIn className="h-4 w-4" />
                    <span>Entrar / Cadastrar com Google</span>
                  </button>

                  <p className="text-[11px] leading-relaxed text-slate-400">
                    Ao entrar e aceitar, você concorda com os{" "}
                    <Link
                      href="/termos-parceiros"
                      className="text-indigo-400 underline underline-offset-2"
                    >
                      Termos do Programa de Parceiros
                    </Link>{" "}
                    e a{" "}
                    <Link
                      href="/privacidade"
                      className="text-indigo-400 underline underline-offset-2"
                    >
                      Política de Privacidade (LGPD)
                    </Link>
                    .
                  </p>
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="space-y-2">
                    <h2 className="text-lg font-bold text-white">
                      2. Confirmar e ativar parceria
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-300">
                      Conectado como{" "}
                      <strong className="text-white">{user.email}</strong>.
                    </p>
                  </div>

                  <label className="flex items-start gap-2.5 rounded-xl border border-slate-800 bg-[#0B1124] p-3.5 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={agreedTerms}
                      onChange={(e) => setAgreedTerms(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-600 bg-slate-900 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>
                      Li e concordo com os{" "}
                      <Link
                        href="/termos-parceiros"
                        className="font-semibold text-indigo-400 underline"
                      >
                        Termos do Programa de Parceiros
                      </Link>{" "}
                      (taxa de {invite.percentualComissao}%, sem autoindicação).
                    </span>
                  </label>

                  {acceptError ? (
                    <div className="rounded-xl border border-rose-800/70 bg-rose-950/50 p-3 text-xs text-rose-200">
                      {acceptError}
                    </div>
                  ) : null}

                  <div className="space-y-2.5">
                    <button
                      type="button"
                      disabled={!agreedTerms || accepting}
                      onClick={() => void handleAcceptInvite()}
                      className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#5B4AF4] to-[#2563EB] px-5 py-3 text-sm font-semibold text-white transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {accepting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Ativando parceria…</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-4 w-4" />
                          <span>Aceitar convite e virar parceiro</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => void signOutUser()}
                      className="w-full py-2 text-xs font-medium text-slate-400 hover:text-white"
                    >
                      Usar outra conta Google
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
