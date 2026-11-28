"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, LogIn, LogOut, ShieldAlert, ShieldCheck } from "lucide-react";
import BrandLogo from "@/components/BrandLogo";
import ThemeToggleButton from "@/components/ThemeToggleButton";
import AdminEmailInbox from "@/components/AdminEmailInbox";
import { useAuth } from "@/components/AuthProvider";

export default function AdminEmailsPageClient() {
  const { user, loading: authLoading, signInWithGoogle, signOutUser } =
    useAuth();
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      Promise.resolve().then(() => {
        setIsAdmin(false);
        setChecking(false);
      });
      return;
    }

    let active = true;
    fetch("/api/admin/session", { cache: "no-store" })
      .then((res) => res.json())
      .then((data: { isAdmin?: boolean }) => {
        if (!active) return;
        setIsAdmin(Boolean(data.isAdmin));
      })
      .catch(() => {
        if (!active) return;
        setIsAdmin(false);
      })
      .finally(() => {
        if (active) setChecking(false);
      });

    return () => {
      active = false;
    };
  }, [authLoading, user]);

  return (
    <div className="flex min-h-screen flex-col bg-[#F4F6FB] text-slate-900 dark:bg-[#0B1124] dark:text-slate-100 transition-colors duration-150">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-[#F4F6FB]/90 backdrop-blur-md dark:border-slate-800/80 dark:bg-[#0B1124]/90">
        <div className="mx-auto flex max-w-[1380px] items-center justify-between gap-4 px-4 py-3.5 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="flex items-center gap-2.5 whitespace-nowrap shrink-0"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#5B4AF4] to-[#2563EB] text-white">
              <BrandLogo className="size-5 text-white" />
            </span>
            <span className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
              Artigen Admin · E-mail
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
              href="/admin/parceiros"
              className="hover:text-slate-950 dark:hover:text-white hover:underline underline-offset-4 whitespace-nowrap shrink-0"
            >
              Área Administrativa
            </Link>
            <Link
              href="/studio"
              className="hover:text-slate-950 dark:hover:text-white hover:underline underline-offset-4 whitespace-nowrap shrink-0"
            >
              Estúdio
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
                onClick={() => void signInWithGoogle("/admin/emails")}
                className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#5B4AF4] to-[#2563EB] px-4 py-2 text-xs font-semibold text-white hover:brightness-110 whitespace-nowrap shrink-0"
              >
                <LogIn className="h-3.5 w-3.5" />
                <span>Entrar</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1380px] flex-1 px-4 py-6 sm:px-6 lg:px-8">
        {authLoading || checking ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <Loader2 className="mx-auto h-7 w-7 animate-spin text-indigo-600 dark:text-indigo-400" />
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
              A verificar acesso do administrador supremo…
            </p>
          </div>
        ) : !user ? (
          <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center space-y-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <ShieldCheck className="mx-auto h-9 w-9 text-indigo-600 dark:text-indigo-400" />
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              Caixa de E-mail do Administrador
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Entre com sua conta de administrador supremo para visualizar e
              responder e-mails enviados por clientes ao Artigen.
            </p>
            <button
              type="button"
              onClick={() => void signInWithGoogle("/admin/emails")}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#5B4AF4] to-[#2563EB] px-5 py-3 text-sm font-semibold text-white hover:brightness-110"
            >
              <LogIn className="h-4 w-4" />
              <span>Entrar como Administrador Supremo</span>
            </button>
          </div>
        ) : !isAdmin ? (
          <div className="mx-auto max-w-lg rounded-2xl border border-rose-200 bg-white p-8 text-center space-y-4 shadow-xs dark:border-rose-800/70 dark:bg-slate-900">
            <ShieldAlert className="mx-auto h-9 w-9 text-rose-500" />
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              Acesso restrito
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Apenas o administrador supremo pode acessar a caixa de e-mail da
              plataforma.
            </p>
            <Link
              href="/studio"
              className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
            >
              Voltar para o Estúdio
            </Link>
          </div>
        ) : (
          <AdminEmailInbox />
        )}
      </main>
    </div>
  );
}
