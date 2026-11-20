"use client";

import { useState, useRef, useEffect } from "react";
import {
  Bell,
  ChevronDown,
  Menu,
  User,
  FileText,
  Settings,
  CheckCheck,
  Sun,
  Moon,
  LogIn,
  LogOut,
  Cloud,
} from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { useAuth } from "@/components/AuthProvider";
import BrandLogo from "@/components/BrandLogo";
import type { NavTab, NotificacaoItem } from "@/lib/types";

type TopBarProps = {
  onOpenMobileMenu: () => void;
  notificacoes: NotificacaoItem[];
  onMarcarLidas: () => void;
  onNavigate: (tab: NavTab) => void;
};

export default function TopBar({
  onOpenMobileMenu,
  notificacoes,
  onMarcarLidas,
  onNavigate,
}: TopBarProps) {
  const { theme, toggleTheme } = useTheme();
  const { user, loading, authError, clearAuthError, signInWithGoogle, signOutUser } =
    useAuth();
  const [notifOpen, setNotifOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  const unreadCount = notificacoes.filter((n) => !n.lida).length;

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
      if (userRef.current && !userRef.current.contains(e.target as Node)) {
        setUserOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  async function handleGoogleLogin() {
    setSigningIn(true);
    try {
      await signInWithGoogle();
    } finally {
      setSigningIn(false);
      setUserOpen(false);
    }
  }

  const displayName =
    user?.displayName ||
    (user?.email ? user.email.split("@")[0] : null) ||
    "Minha conta";

  return (
    <header className="space-y-2 pb-3">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onOpenMobileMenu}
            aria-label="Abrir menu lateral"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2 lg:hidden">
            <BrandLogo className="size-6 text-indigo-600 dark:text-indigo-400" />
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              Gerador de Artigos
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* Theme toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={
              theme === "dark" ? "Ativar modo claro" : "Ativar modo escuro"
            }
            title={
              theme === "dark"
                ? "Mudar para modo claro"
                : "Mudar para modo escuro"
            }
            className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200/80 bg-white text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white focus-visible:outline-2 focus-visible:outline-indigo-600"
          >
            {theme === "dark" ? (
              <Sun className="h-[18px] w-[18px] text-amber-400" />
            ) : (
              <Moon className="h-[18px] w-[18px]" />
            )}
          </button>

          {/* Notifications dropdown */}
          <div className="relative" ref={notifRef}>
            <button
              type="button"
              onClick={() => {
                setNotifOpen((v) => !v);
                setUserOpen(false);
              }}
              aria-label="Notificações"
              className="relative flex h-9 w-9 items-center justify-center rounded-full border border-slate-200/80 bg-white text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white focus-visible:outline-2 focus-visible:outline-indigo-600"
            >
              <Bell className="h-[18px] w-[18px]" />
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white tabular-nums">
                  {unreadCount}
                </span>
              )}
            </button>

            {notifOpen && (
              <div className="absolute right-0 z-40 mt-2 w-80 rounded-2xl border border-slate-200 bg-white p-3 shadow-lg dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 dark:border-slate-800">
                  <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                    Atividade recente
                  </span>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={onMarcarLidas}
                      className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                    >
                      <CheckCheck className="h-3.5 w-3.5" />
                      Marcar lidas
                    </button>
                  )}
                </div>
                <div className="mt-2 max-h-64 space-y-1.5 overflow-y-auto">
                  {notificacoes.length === 0 ? (
                    <p className="py-6 text-center text-xs text-slate-500 dark:text-slate-400">
                      Nenhuma atividade registrada ainda.
                    </p>
                  ) : (
                    notificacoes.map((item) => (
                      <div
                        key={item.id}
                        className={`rounded-xl px-3 py-2 text-xs ${
                          item.lida
                            ? "bg-slate-50/70 dark:bg-slate-800/50"
                            : "bg-indigo-50/70 dark:bg-indigo-950/50"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-slate-800 dark:text-slate-100">
                            {item.titulo}
                          </span>
                          <span className="text-[11px] text-slate-400 dark:text-slate-500 tabular-nums">
                            {item.hora}
                          </span>
                        </div>
                        <p className="mt-0.5 text-slate-600 dark:text-slate-300 line-clamp-2">
                          {item.detalhe}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Google Account / User profile menu */}
          {!loading && !user ? (
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={signingIn}
              className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-indigo-700 shadow-xs transition-colors hover:bg-indigo-50 disabled:opacity-60 dark:border-indigo-800/70 dark:bg-slate-900 dark:text-indigo-300 dark:hover:bg-indigo-950/50 whitespace-nowrap shrink-0"
            >
              <LogIn className="h-3.5 w-3.5" />
              <span>{signingIn ? "A entrar..." : "Entrar com Google"}</span>
            </button>
          ) : (
            <div className="relative" ref={userRef}>
              <button
                type="button"
                onClick={() => {
                  setUserOpen((v) => !v);
                  setNotifOpen(false);
                }}
                className="flex items-center gap-2 rounded-full border border-slate-200/80 bg-white py-1 pl-1.5 pr-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-indigo-600 whitespace-nowrap shrink-0"
              >
                {user?.photoURL ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.photoURL}
                    alt={displayName}
                    referrerPolicy="no-referrer"
                    className="h-7 w-7 rounded-full object-cover"
                  />
                ) : (
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                    <User className="h-4 w-4" />
                  </span>
                )}
                <span className="max-w-[130px] truncate text-[13px] font-semibold text-slate-800 dark:text-slate-100">
                  {loading ? "A carregar..." : displayName}
                </span>
                <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
              </button>

              {userOpen && user && (
                <div className="absolute right-0 z-40 mt-2 w-60 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-lg dark:border-slate-800 dark:bg-slate-900">
                  <div className="border-b border-slate-100 px-3 py-2 dark:border-slate-800">
                    <p className="truncate text-xs font-bold text-slate-900 dark:text-white">
                      {displayName}
                    </p>
                    {user.email && (
                      <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                        {user.email}
                      </p>
                    )}
                    <div className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                      <Cloud className="h-3 w-3" />
                      <span>Sincronizado na conta Google</span>
                    </div>
                  </div>
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        onNavigate("artigos");
                        setUserOpen(false);
                      }}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      <FileText className="h-4 w-4 text-slate-400" />
                      Meus Artigos
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onNavigate("configuracoes");
                        setUserOpen(false);
                      }}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      <Settings className="h-4 w-4 text-slate-400" />
                      Configurações padrão
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await signOutUser();
                        setUserOpen(false);
                      }}
                      className="mt-0.5 flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
                    >
                      <LogOut className="h-4 w-4" />
                      Terminar sessão
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {authError && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300"
        >
          <span>{authError}</span>
          <button
            type="button"
            onClick={clearAuthError}
            className="font-semibold underline underline-offset-2"
          >
            Fechar
          </button>
        </div>
      )}
    </header>
  );
}
