"use client";

import { useState } from "react";
import {
  CheckCircle2,
  Download,
  PlusSquare,
  Share,
  Smartphone,
  X,
} from "lucide-react";
import { usePWAInstall } from "@/lib/use-pwa-install";

type PWAInstallButtonProps = {
  variant?: "compact" | "menu" | "card";
  onClickBeforeAction?: () => void;
};

export default function PWAInstallButton({
  variant = "compact",
  onClickBeforeAction,
}: PWAInstallButtonProps) {
  const { isInstallable, isInstalled, isIOS, installing, install } =
    usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [showBrowserGuide, setShowBrowserGuide] = useState(false);

  async function handleInstallClick() {
    onClickBeforeAction?.();
    if (isIOS) {
      setShowIOSGuide(true);
      return;
    }
    if (isInstallable) {
      await install();
      return;
    }
    setShowBrowserGuide(true);
  }

  if (variant !== "card") {
    if (isInstalled || (!isInstallable && !isIOS)) {
      return null;
    }
  }

  return (
    <>
      {variant === "compact" && (
        <button
          type="button"
          onClick={handleInstallClick}
          disabled={installing}
          title="Instalar Artigen como aplicativo"
          aria-label="Instalar aplicativo Artigen"
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-indigo-200/90 bg-white px-3 text-xs font-semibold text-indigo-700 transition-colors hover:bg-indigo-50 disabled:opacity-60 dark:border-indigo-800/70 dark:bg-slate-900 dark:text-indigo-300 dark:hover:bg-indigo-950/50 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-indigo-600"
        >
          <Download className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">
            {installing ? "Instalando..." : "Instalar app"}
          </span>
        </button>
      )}

      {variant === "menu" && (
        <button
          type="button"
          onClick={handleInstallClick}
          disabled={installing}
          className="mt-1 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-100 dark:hover:bg-slate-800"
        >
          <Download className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          <span>{installing ? "Instalando..." : "Instalar aplicativo Artigen"}</span>
        </button>
      )}

      {variant === "card" && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-800 dark:bg-slate-950/40">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/70 dark:text-indigo-400">
              <Smartphone className="h-4 w-4" />
            </span>
            <div>
              <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                Aplicativo instalado (PWA)
              </p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {isInstalled
                  ? "Você já está usando o Artigen instalado em janela própria."
                  : "Instale o Artigen no celular ou desktop para abrir direto em janela dedicada."}
              </p>
            </div>
          </div>

          {isInstalled ? (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Instalado
            </span>
          ) : (
            <button
              type="button"
              onClick={handleInstallClick}
              disabled={installing}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-60"
            >
              <Download className="h-3.5 w-3.5" />
              <span>{installing ? "Instalando..." : "Instalar aplicativo"}</span>
            </button>
          )}
        </div>
      )}

      {showIOSGuide && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-ios-guide-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
          onClick={() => setShowIOSGuide(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/70 dark:text-indigo-400">
                  <Smartphone className="h-4 w-4" />
                </span>
                <h3
                  id="pwa-ios-guide-title"
                  className="text-base font-bold text-slate-900 dark:text-white"
                >
                  Instalar no iPhone / iPad
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                aria-label="Fechar instruções"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <ol className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
              <li className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                  1
                </span>
                <span>
                  Toque no botão{" "}
                  <strong className="inline-flex items-center gap-1 font-semibold text-slate-900 dark:text-white">
                    Compartilhar <Share className="inline h-3.5 w-3.5" />
                  </strong>{" "}
                  na barra do Safari.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                  2
                </span>
                <span>
                  Role e toque em{" "}
                  <strong className="inline-flex items-center gap-1 font-semibold text-slate-900 dark:text-white">
                    Adicionar à Tela de Início{" "}
                    <PlusSquare className="inline h-3.5 w-3.5" />
                  </strong>
                  .
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                  3
                </span>
                <span>
                  Toque em{" "}
                  <strong className="font-semibold text-slate-900 dark:text-white">
                    Adicionar
                  </strong>{" "}
                  para abrir o Artigen como aplicativo.
                </span>
              </li>
            </ol>

            <button
              type="button"
              onClick={() => setShowIOSGuide(false)}
              className="mt-5 w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Entendi
            </button>
          </div>
        </div>
      )}

      {showBrowserGuide && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-browser-guide-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
          onClick={() => setShowBrowserGuide(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/70 dark:text-indigo-400">
                  <Download className="h-4 w-4" />
                </span>
                <h3
                  id="pwa-browser-guide-title"
                  className="text-base font-bold text-slate-900 dark:text-white"
                >
                  Como instalar o Artigen
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowBrowserGuide(false)}
                aria-label="Fechar instruções"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              No Chrome, Edge ou navegador do Android, abra o menu do navegador
              (ou clique no ícone de instalação na barra de endereço) e selecione{" "}
              <strong className="font-semibold text-slate-900 dark:text-white">
                Instalar Artigen
              </strong>{" "}
              ou{" "}
              <strong className="font-semibold text-slate-900 dark:text-white">
                Adicionar à tela inicial
              </strong>
              .
            </p>

            <button
              type="button"
              onClick={() => setShowBrowserGuide(false)}
              className="mt-5 w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Entendi
            </button>
          </div>
        </div>
      )}
    </>
  );
}
