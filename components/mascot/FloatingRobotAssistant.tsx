"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Bot,
  Hand,
  Lightbulb,
  Minimize2,
  MousePointerClick,
  PartyPopper,
  Sparkles,
  X,
} from "lucide-react";
import RobotScene from "@/components/mascot/RobotScene";
import { useRobotStateController } from "@/components/mascot/RobotController";
import type { RobotAnimationState } from "@/components/mascot/RobotAnimations";

type FloatingRobotAssistantProps = {
  context?: "landing" | "studio";
  externalState?: RobotAnimationState;
  statusMessage?: string;
  onQuickSuggest?: () => void;
};

export default function FloatingRobotAssistant({
  context = "landing",
  externalState,
  statusMessage,
  onQuickSuggest,
}: FloatingRobotAssistantProps) {
  const [open, setOpen] = useState(false);
  const robot = useRobotStateController(externalState ?? "greeting");
  const { setAnimation: setRobotAnimation } = robot;

  useEffect(() => {
    if (!externalState) return;
    let active = true;
    Promise.resolve().then(() => {
      if (active) {
        setRobotAnimation(externalState);
      }
    });
    return () => {
      active = false;
    };
  }, [externalState, setRobotAnimation]);

  const currentMessage =
    statusMessage ||
    (robot.animation === "thinking"
      ? "Estou a analisar e estruturar o seu conteúdo..."
      : robot.animation === "excited"
      ? "Artigo concluído com sucesso!"
      : robot.animation === "pointing"
      ? "Veja estas ferramentas prontas para acelerar a sua escrita."
      : robot.animation === "sleeping"
      ? "Em modo de descanso. Clique em mim para despertar."
      : context === "studio"
      ? "Olá! Posso ajudar a sugerir configurações ou acompanhar a geração do artigo."
      : "Olá! Sou o Artigen AI Assistant. Clique em mim ou explore minhas animações 3D.");

  return (
    <div className="fixed bottom-4 right-4 z-50 sm:bottom-6 sm:right-6">
      {!open ? (
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            robot.setAnimation(externalState ?? "greeting");
          }}
          aria-label="Abrir Artigen AI Assistant"
          className="group flex items-center gap-2.5 rounded-2xl border border-indigo-500/30 bg-[#0E162E] px-3.5 py-2.5 text-white shadow-xl shadow-indigo-950/30 transition-transform duration-150 hover:scale-[1.03] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-[#5B4AF4] to-[#06B6D4] text-white">
            <Bot className="h-4 w-4" />
          </span>
          <span className="text-left">
            <span className="block text-xs font-bold leading-tight whitespace-nowrap">
              Artigen Assistant
            </span>
            <span className="block text-[10px] text-cyan-300 leading-tight whitespace-nowrap">
              Mascote 3D
            </span>
          </span>
        </button>
      ) : (
        <div className="w-[310px] sm:w-[340px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-950/25 dark:border-slate-800 dark:bg-slate-900">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-[#0E162E] to-[#1E3A8A] px-4 py-3 text-white dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-cyan-300" />
              <span className="text-xs font-bold">Artigen AI Assistant</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Minimizar assistente"
                className="rounded-lg p-1 text-slate-300 hover:bg-white/10 hover:text-white"
              >
                <Minimize2 className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fechar assistente"
                className="rounded-lg p-1 text-slate-300 hover:bg-white/10 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* 3D Interactive Stage */}
          <div className="relative h-48 w-full bg-gradient-to-b from-slate-50 to-indigo-50/50 dark:from-slate-950 dark:to-[#0E162E]/70">
            <RobotScene
              animation={robot.animation}
              expression={robot.expression}
              scale={0.95}
              cameraZ={3.6}
              rotationDeg={robot.rotationDeg}
              onRotationChange={robot.setRotationDeg}
              onRobotClick={robot.cycleClickInteraction}
              className="h-full w-full"
            />
          </div>

          {/* Assistant Message + Quick Actions */}
          <div className="space-y-3 p-4">
            <p className="rounded-xl bg-slate-50 px-3 py-2.5 text-xs leading-relaxed text-slate-700 dark:bg-slate-800/80 dark:text-slate-200">
              {currentMessage}
            </p>

            {/* Quick Animation Buttons */}
            <div className="grid grid-cols-4 gap-1.5">
              {(
                [
                  { id: "greeting", label: "Acenar", icon: Hand },
                  { id: "thinking", label: "Pensar", icon: Lightbulb },
                  { id: "excited", label: "Celebrar", icon: PartyPopper },
                  { id: "pointing", label: "Apontar", icon: MousePointerClick },
                ] as const
              ).map((item) => {
                const Icon = item.icon;
                const active = robot.animation === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => robot.setAnimation(item.id)}
                    className={`flex flex-col items-center gap-1 rounded-lg border py-1.5 text-[10px] font-semibold transition-colors ${
                      active
                        ? "border-indigo-600 bg-indigo-600 text-white"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between gap-2 pt-1">
              {context === "studio" && onQuickSuggest ? (
                <button
                  type="button"
                  onClick={() => {
                    robot.setAnimation("thinking");
                    onQuickSuggest();
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Sugerir com IA</span>
                </button>
              ) : (
                <Link
                  href="/studio"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
                >
                  <span>Abrir Estúdio</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              )}

              <Link
                href="/mascote"
                className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
              >
                <span>Ver demo 3D</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
