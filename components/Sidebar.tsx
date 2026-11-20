"use client";

import Link from "next/link";
import BrandLogo from "@/components/BrandLogo";
import {
  Home,
  FileText,
  Heart,
  BarChart3,
  Settings,
  Crown,
  HelpCircle,
  Info,
  X,
  ArrowLeft,
  Bot,
} from "lucide-react";
import type { NavTab } from "@/lib/types";

type SidebarProps = {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  totalArtigos: number;
  totalFavoritos: number;
  onOpenModal: (tipo: "upgrade" | "ajuda" | "sobre") => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  ocupado?: boolean;
};

const NAV_ITEMS: { id: NavTab; label: string; icon: typeof Home }[] = [
  { id: "inicio", label: "Início", icon: Home },
  { id: "artigos", label: "Meus Artigos", icon: FileText },
  { id: "favoritos", label: "Favoritos", icon: Heart },
  { id: "estatisticas", label: "Estatísticas", icon: BarChart3 },
  { id: "configuracoes", label: "Configurações", icon: Settings },
];

export default function Sidebar({
  activeTab,
  onSelectTab,
  totalArtigos,
  totalFavoritos,
  onOpenModal,
  mobileOpen,
  onCloseMobile,
  ocupado = false,
}: SidebarProps) {
  const content = (
    <aside className="relative flex h-full w-[252px] shrink-0 flex-col justify-between overflow-hidden bg-gradient-to-b from-[#0E162E] via-[#121C3A] to-[#111936] px-4 py-6 text-slate-200 select-none dark:border-r dark:border-slate-800/80">
      {/* Subtle atmospheric glow at bottom matching the design */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-indigo-500/20 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-10 right-0 h-40 w-40 rounded-full bg-blue-500/15 blur-2xl"
      />

      <div className="relative z-10 flex flex-col gap-7">
        {/* Brand Block */}
        <div className="flex items-start justify-between px-2">
          <Link
            href="/"
            className="group flex w-full flex-col items-center text-center focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-400 rounded-xl"
          >
            <div className="mb-3 flex h-15 w-15 items-center justify-center rounded-2xl border border-white/15 bg-gradient-to-br from-[#5B4AF4] via-[#4F46E5] to-[#2563EB] p-2.5 shadow-lg shadow-indigo-950/50 transition-transform duration-200 group-hover:scale-105">
              <BrandLogo
                variant={ocupado ? "write" : "static"}
                className="size-10 text-white"
                ariaLabel="Logotipo Gerador de Artigos"
              />
            </div>
            <span className="text-[19px] font-bold leading-tight tracking-tight text-white">
              Gerador
              <br />
              de Artigos
            </span>
            <p className="mt-1.5 text-xs leading-snug text-slate-400">
              Crie conteúdos incríveis com IA
            </p>
          </Link>
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Fechar menu"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation Links */}
        <nav aria-label="Navegação principal" className="flex flex-col gap-1.5">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            const count =
              item.id === "artigos"
                ? totalArtigos
                : item.id === "favoritos"
                ? totalFavoritos
                : undefined;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelectTab(item.id);
                  onCloseMobile();
                }}
                className={`group flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-left text-sm font-medium transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400 ${
                  isActive
                    ? "bg-gradient-to-r from-[#5B4AF4] to-[#3B82F6] text-white shadow-md shadow-indigo-950/40"
                    : "text-slate-300 hover:bg-white/8 hover:text-white"
                }`}
              >
                <span className="flex items-center gap-3 whitespace-nowrap">
                  <Icon
                    className={`h-[18px] w-[18px] shrink-0 ${
                      isActive
                        ? "text-white"
                        : "text-slate-400 group-hover:text-slate-200"
                    }`}
                  />
                  <span>{item.label}</span>
                </span>
                {typeof count === "number" && count > 0 && (
                  <span
                    className={`text-xs font-mono tabular-nums ${
                      isActive ? "text-white/90" : "text-slate-400"
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Plan Card + Support Links */}
      <div className="relative z-10 mt-6 flex flex-col gap-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 text-center backdrop-blur-sm">
          <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-amber-400/15 text-amber-400">
            <Crown className="h-5 w-5" />
          </div>
          <p className="text-sm font-semibold text-white">Pacotes de Artigos</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-300">
            Avulso ou pacotes com até 32% off
          </p>
          <button
            type="button"
            onClick={() => onOpenModal("upgrade")}
            className="mt-3 w-full rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 px-3 py-2 text-xs font-semibold text-slate-950 transition-transform duration-150 hover:brightness-105 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 whitespace-nowrap"
          >
            Ver Pacotes
          </button>
        </div>

        <div className="flex flex-col gap-1 border-t border-white/10 pt-3">
          <button
            type="button"
            onClick={() => onOpenModal("ajuda")}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium text-slate-300 transition-colors hover:bg-white/8 hover:text-white focus-visible:outline-2 focus-visible:outline-indigo-400"
          >
            <HelpCircle className="h-4 w-4 text-slate-400" />
            <span>Ajuda</span>
          </button>
          <button
            type="button"
            onClick={() => onOpenModal("sobre")}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium text-slate-300 transition-colors hover:bg-white/8 hover:text-white focus-visible:outline-2 focus-visible:outline-indigo-400"
          >
            <Info className="h-4 w-4 text-slate-400" />
            <span>Sobre</span>
          </button>
          <Link
            href="/mascote"
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium text-cyan-300 transition-colors hover:bg-white/8 hover:text-white focus-visible:outline-2 focus-visible:outline-indigo-400"
          >
            <Bot className="h-4 w-4 text-cyan-400" />
            <span>Mascote 3D</span>
          </Link>
          <Link
            href="/"
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium text-slate-400 transition-colors hover:bg-white/8 hover:text-white focus-visible:outline-2 focus-visible:outline-indigo-400"
          >
            <ArrowLeft className="h-4 w-4 text-slate-400" />
            <span>Página inicial</span>
          </Link>
        </div>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden lg:block lg:h-screen lg:sticky lg:top-0">
        {content}
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
            onClick={onCloseMobile}
          />
          <div className="relative z-10 h-full">{content}</div>
        </div>
      )}
    </>
  );
}
