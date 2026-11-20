"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import BrandLogo from "@/components/BrandLogo";
import RobotScene from "@/components/mascot/RobotScene";
import type {
  RobotAnimationState,
  RobotExpression,
} from "@/components/mascot/RobotAnimations";

type HeroBannerProps = {
  mascotState?: RobotAnimationState;
};

export default function HeroBanner({ mascotState = "idle" }: HeroBannerProps) {
  const [clickedGreeting, setClickedGreeting] = useState(false);

  const effectiveAnimation: RobotAnimationState =
    mascotState !== "idle"
      ? mascotState
      : clickedGreeting
      ? "greeting"
      : "idle";

  const effectiveExpression: RobotExpression =
    effectiveAnimation === "thinking"
      ? "curious"
      : effectiveAnimation === "excited"
      ? "excited"
      : effectiveAnimation === "greeting"
      ? "happy"
      : "neutral";

  return (
    <section
      aria-label="Apresentação do Gerador de Artigos"
      className="relative overflow-hidden rounded-2xl border border-indigo-200/70 bg-gradient-to-r from-[#EBF0FF] via-[#E1DBFE] to-[#CCE7FF] px-6 py-4 shadow-xs dark:border-indigo-500/25 dark:from-[#161E3D] dark:via-[#1E1B4B] dark:to-[#0F2747]"
    >
      {/* Decorative atmospheric shapes */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-8 -top-10 h-44 w-44 rounded-full bg-indigo-400/20 blur-2xl dark:bg-indigo-500/15"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 left-1/3 h-28 w-56 rounded-full bg-sky-300/25 blur-2xl dark:bg-sky-500/10"
      />

      <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-indigo-400/30 bg-gradient-to-br from-[#5B4AF4] via-[#4F46E5] to-[#2563EB] p-2 shadow-md shadow-indigo-600/20">
            <BrandLogo
              variant="static"
              className="size-9 text-white"
              ariaLabel="Logotipo Gerador de Artigos"
            />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#1E2448] dark:text-white sm:text-[28px] text-balance">
              Gerador de Artigos
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-700 dark:text-slate-300">
              Informe o tema, personalize as opções e deixe a IA criar um artigo
              completo para você!
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-start md:self-center shrink-0">
          <div className="inline-flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-[#6344F5] to-[#4F46E5] px-4 py-2 text-xs font-semibold text-white shadow-sm">
            <span className="whitespace-nowrap">
              Rápido <span aria-hidden="true">·</span> Inteligente{" "}
              <span aria-hidden="true">·</span> SEO Friendly
            </span>
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" />
          </div>

          <div className="hidden sm:flex items-center gap-2">
            <div
              title="Artigen AI Assistant 3D — Clique para interagir"
              className="relative h-20 w-20 overflow-hidden rounded-2xl border border-white/70 bg-white/60 shadow-sm backdrop-blur-xs dark:border-white/15 dark:bg-slate-900/60"
            >
              <RobotScene
                animation={effectiveAnimation}
                expression={effectiveExpression}
                cameraZ={4.35}
                scale={1.04}
                onRobotClick={() => setClickedGreeting((v) => !v)}
                className="h-full w-full"
                ariaLabel="Mascote 3D Artigen no painel principal"
              />
            </div>
            <Link
              href="/mascote"
              className="hidden xl:inline-flex items-center rounded-lg border border-indigo-300/60 bg-white/70 px-2.5 py-1.5 text-[11px] font-semibold text-indigo-700 transition-colors hover:bg-white dark:border-indigo-500/30 dark:bg-slate-900/70 dark:text-indigo-300 dark:hover:bg-slate-900 whitespace-nowrap"
            >
              Demo 3D
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
