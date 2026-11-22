"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { ArrowLeft, Compass, Home, Moon, PenSquare, Sun } from "lucide-react";
import BrandLogo from "@/components/BrandLogo";
import LostMascotScene from "@/components/mascot/LostMascotScene";
import { useTheme } from "@/components/ThemeProvider";

export default function NotFoundView() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="flex min-h-screen flex-col bg-[#F4F6FB] text-slate-900 transition-colors duration-150 dark:bg-slate-950 dark:text-slate-100">
      {/* Top Bar — Clean 3-Zone Contract */}
      <header className="border-b border-slate-200/80 bg-white dark:border-slate-800/80 dark:bg-slate-950">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-8 px-4 py-3.5 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="flex items-center gap-2.5 whitespace-nowrap shrink-0 rounded-lg focus-visible:outline-2 focus-visible:outline-indigo-600"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#5B4AF4] to-[#2563EB] text-white">
              <BrandLogo className="size-5 text-white" />
            </span>
            <span className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white">
              Artigen
            </span>
          </Link>

          <nav
            aria-label="Navegação principal"
            className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300"
          >
            <Link
              href="/"
              className="hover:text-slate-950 hover:underline underline-offset-4 dark:hover:text-white whitespace-nowrap shrink-0"
            >
              Início
            </Link>
            <Link
              href="/studio"
              className="hover:text-slate-950 hover:underline underline-offset-4 dark:hover:text-white whitespace-nowrap shrink-0"
            >
              Estúdio
            </Link>
            <Link
              href="/mascote"
              className="hover:text-slate-950 hover:underline underline-offset-4 dark:hover:text-white whitespace-nowrap shrink-0"
            >
              Mascote 3D
            </Link>
          </nav>

          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#5B4AF4] to-[#2563EB] px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-sm transition-transform duration-150 hover:brightness-110 active:scale-[0.98] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-indigo-600"
          >
            <Home className="h-4 w-4" />
            <span>Página inicial</span>
          </Link>
        </div>
      </header>

      {/* Main 404 Content */}
      <main className="mx-auto flex w-full max-w-[1160px] flex-1 items-center px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <div className="grid w-full grid-cols-1 items-center gap-8 lg:grid-cols-12 lg:gap-12">
          {/* Left: Interactive 3D Lost Mulébi Stage */}
          <div className="lg:col-span-6">
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-b from-white via-slate-50 to-indigo-50/60 p-4 dark:border-slate-800 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950/40">
              <div className="h-[340px] w-full sm:h-[420px] lg:h-[460px]">
                <LostMascotScene
                  cameraZ={4.95}
                  className="h-full w-full"
                  ariaLabel="Mulébi perdido segurando um mapa e coçando a cabeça ao lado de uma placa 404"
                />
              </div>
              <p className="mt-2 text-center text-xs text-slate-500 dark:text-slate-400">
                Arraste para girar o Mulébi ou clique para ele olhar ao redor
              </p>
            </div>
          </div>

          {/* Right: Editorial Copy & Return Home Actions */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-6 space-y-6"
          >
            <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm font-semibold text-indigo-600 dark:text-indigo-400 font-mono tabular-nums">
              <span>Erro 404</span>
              <span aria-hidden="true" className="text-slate-400">
                ·
              </span>
              <span className="text-slate-600 dark:text-slate-300 font-sans font-medium">
                Página não encontrada
              </span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-slate-950 dark:text-white [text-wrap:balance]">
              Ops! O Mulébi perdeu o caminho.
            </h1>

            <p className="max-w-xl text-base leading-relaxed text-slate-600 dark:text-slate-300">
              O endereço que você procurou não existe ou foi movido. O Mulébi
              abriu o mapa, conferiu as placas da encruzilhada e ainda está
              tentando descobrir para onde essa rota leva.
            </p>

            {pathname && (
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span>Rota solicitada:</span>
                <code className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 font-mono text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 break-all">
                  {pathname}
                </code>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link
                href="/"
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-gradient-to-r from-[#5B4AF4] to-[#2563EB] px-6 py-3 text-sm font-semibold text-white shadow-sm transition-transform duration-150 hover:brightness-110 active:scale-[0.98] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-indigo-600"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Voltar para a página inicial</span>
              </Link>

              <Link
                href="/studio"
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition-colors duration-150 hover:bg-slate-50 hover:text-slate-950 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-indigo-600"
              >
                <PenSquare className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                <span>Abrir Estúdio</span>
              </Link>

              <Link
                href="/mascote"
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition-colors duration-150 hover:bg-slate-50 hover:text-slate-950 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-indigo-600"
              >
                <Compass className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                <span>Ver Mulébi 3D</span>
              </Link>
            </div>
          </motion.div>
        </div>
      </main>

      {/* Quiet Footer */}
      <footer className="border-t border-slate-200/80 bg-white/80 dark:border-slate-800/80 dark:bg-slate-950">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-4 px-4 py-4 text-xs text-slate-500 dark:text-slate-400 sm:px-6 lg:px-8">
          <span>Artigen · Gerador de Artigos com IA</span>
          <div className="flex flex-wrap items-center gap-4">
            <Link
              href="/sobre"
              className="hover:text-slate-900 dark:hover:text-white whitespace-nowrap"
            >
              Sobre
            </Link>
            <Link
              href="/termos-de-uso"
              className="hover:text-slate-900 dark:hover:text-white whitespace-nowrap"
            >
              Termos de Uso
            </Link>
            <Link
              href="/privacidade"
              className="hover:text-slate-900 dark:hover:text-white whitespace-nowrap"
            >
              Privacidade
            </Link>
            <Link
              href="/"
              className="hover:text-slate-900 dark:hover:text-white whitespace-nowrap"
            >
              Voltar ao início
            </Link>
            <button
              type="button"
              onClick={toggleTheme}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 whitespace-nowrap"
            >
              {theme === "dark" ? (
                <>
                  <Sun className="h-3.5 w-3.5 text-amber-400" />
                  <span>Tema Claro</span>
                </>
              ) : (
                <>
                  <Moon className="h-3.5 w-3.5" />
                  <span>Tema Escuro</span>
                </>
              )}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
