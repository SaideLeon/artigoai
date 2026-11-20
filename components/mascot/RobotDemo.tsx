"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Eye,
  Hand,
  Lightbulb,
  Moon,
  MousePointerClick,
  PartyPopper,
  Pause,
  PenLine,
  Play,
  RotateCcw,
  Sparkles,
  Sun,
} from "lucide-react";
import BrandLogo from "@/components/BrandLogo";
import RobotScene from "@/components/mascot/RobotScene";
import { useRobotStateController } from "@/components/mascot/RobotController";
import type {
  RobotAnimationState,
  RobotExpression,
} from "@/components/mascot/RobotAnimations";
import { useTheme } from "@/components/ThemeProvider";

const ANIMATIONS: {
  id: RobotAnimationState;
  label: string;
  desc: string;
  icon: typeof Sparkles;
}[] = [
  { id: "idle", label: "Idle", desc: "Flutuação suave", icon: Sparkles },
  {
    id: "greeting",
    label: "Saudação",
    desc: "Acena com o braço",
    icon: Hand,
  },
  {
    id: "thinking",
    label: "Pensando",
    desc: "Mão ao queixo",
    icon: Lightbulb,
  },
  {
    id: "excited",
    label: "Comemorando",
    desc: "Artigo concluído",
    icon: PartyPopper,
  },
  {
    id: "pointing",
    label: "Apontando",
    desc: "Indica recursos",
    icon: MousePointerClick,
  },
  {
    id: "writing",
    label: "Escrevendo",
    desc: "Redige o artigo",
    icon: PenLine,
  },
  { id: "sleeping", label: "Dormindo", desc: "Modo repouso", icon: Moon },
];

const EXPRESSIONS: { id: RobotExpression; label: string }[] = [
  { id: "neutral", label: "Neutro" },
  { id: "happy", label: "Feliz" },
  { id: "curious", label: "Curioso" },
  { id: "wink", label: "Piscadela" },
  { id: "excited", label: "Empolgado" },
  { id: "sleepy", label: "Sonolento" },
];

export default function RobotDemo() {
  const { theme, toggleTheme } = useTheme();
  const robot = useRobotStateController("greeting");
  const [bgMode, setBgMode] = useState<"white" | "transparent">("white");
  const [dockCollapsed, setDockCollapsed] = useState(false);

  return (
    <div
      className={`relative flex min-h-screen flex-col transition-colors duration-150 ${
        bgMode === "white"
          ? "bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100"
          : "bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:20px_20px] bg-slate-50 text-slate-900 dark:bg-[radial-gradient(#1e293b_1px,transparent_1px)] dark:bg-slate-950 dark:text-slate-100"
      }`}
    >
      {/* Top Bar — Clean 3-Zone Contract */}
      <header className="relative z-20 border-b border-slate-200/80 bg-white/90 dark:border-slate-800/80 dark:bg-slate-950/90">
        <div className="mx-auto flex max-w-[1360px] items-center justify-between gap-8 px-4 py-3.5 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="flex items-center gap-2.5 whitespace-nowrap shrink-0 rounded-lg focus-visible:outline-2 focus-visible:outline-indigo-600"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#5B4AF4] to-[#2563EB] text-white">
              <BrandLogo className="size-5 text-white" />
            </span>
            <span className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white">
              Artigen AI Assistant
            </span>
          </Link>

          <nav
            aria-label="Navegação da demonstração"
            className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300"
          >
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 hover:text-slate-950 dark:hover:text-white whitespace-nowrap shrink-0"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Landing Page</span>
            </Link>
            <button
              type="button"
              onClick={() =>
                setBgMode((m) => (m === "white" ? "transparent" : "white"))
              }
              className="hover:text-slate-950 dark:hover:text-white whitespace-nowrap shrink-0"
            >
              {bgMode === "white" ? "Fundo: Branco" : "Fundo: Transparente"}
            </button>
            <button
              type="button"
              onClick={toggleTheme}
              className="inline-flex items-center gap-1.5 hover:text-slate-950 dark:hover:text-white whitespace-nowrap shrink-0"
            >
              {theme === "dark" ? (
                <Sun className="h-3.5 w-3.5 text-amber-400" />
              ) : (
                <Moon className="h-3.5 w-3.5" />
              )}
              <span>{theme === "dark" ? "Tema Claro" : "Tema Escuro"}</span>
            </button>
          </nav>

          <Link
            href="/studio"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#5B4AF4] to-[#2563EB] px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-sm hover:brightness-110 whitespace-nowrap shrink-0"
          >
            <span>Abrir Estúdio</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </header>

      {/* Center Unobstructed 3D Viewport */}
      <main className="relative flex flex-1 flex-col items-center justify-center px-4 pb-6 pt-4">
        <div className="text-center max-w-xl">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-950 dark:text-white">
            Artigen AI Assistant
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Mova o cursor para o robô acompanhar · Arraste para girar · Clique
            para saudação e expressões
          </p>
        </div>

        {/* 3D Canvas Container */}
        <div className="relative my-2 h-[380px] w-full max-w-[680px] sm:h-[460px] lg:h-[500px]">
          <RobotScene
            animation={robot.animation}
            expression={robot.expression}
            paused={robot.paused}
            rotationDeg={robot.rotationDeg}
            scale={robot.scale}
            blinkNonce={robot.blinkNonce}
            cameraZ={4.65}
            onRotationChange={robot.setRotationDeg}
            onRobotClick={robot.cycleClickInteraction}
            className="h-full w-full"
          />
        </div>

        {/* Collapsible Unified Bottom Control Dock (Zero Viewport Occlusion) */}
        <div className="relative z-20 w-full max-w-[960px]">
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => setDockCollapsed((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-t-xl border border-b-0 border-slate-200 bg-white px-4 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:text-white"
            >
              {dockCollapsed ? (
                <>
                  <ChevronUp className="h-3.5 w-3.5" />
                  <span>Mostrar controlos</span>
                </>
              ) : (
                <>
                  <ChevronDown className="h-3.5 w-3.5" />
                  <span>Ocultar controlos</span>
                </>
              )}
            </button>
          </div>

          {!dockCollapsed && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-lg shadow-slate-900/5 dark:border-slate-800 dark:bg-slate-900 space-y-4">
              {/* Row 1: Animation States */}
              <div>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Animações ({ANIMATIONS.find((a) => a.id === robot.animation)?.label})
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={robot.triggerBlink}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 whitespace-nowrap"
                    >
                      <Eye className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
                      <span>Piscar</span>
                    </button>
                    <button
                      type="button"
                      onClick={robot.togglePaused}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                        robot.paused
                          ? "bg-amber-500 text-slate-950 hover:bg-amber-400"
                          : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                      }`}
                    >
                      {robot.paused ? (
                        <>
                          <Play className="h-3.5 w-3.5" />
                          <span>Retomar</span>
                        </>
                      ) : (
                        <>
                          <Pause className="h-3.5 w-3.5" />
                          <span>Pausar</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
                  {ANIMATIONS.map((item) => {
                    const Icon = item.icon;
                    const active = robot.animation === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => robot.setAnimation(item.id)}
                        className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs font-semibold transition-colors ${
                          active
                            ? "border-indigo-600 bg-indigo-600 text-white"
                            : "border-slate-200 bg-slate-50/70 text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-200 dark:hover:bg-slate-800"
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Row 2: Expression + Rotation + Scale Controls */}
              <div className="grid grid-cols-1 gap-4 border-t border-slate-100 pt-4 dark:border-slate-800 lg:grid-cols-12 lg:items-center">
                {/* Facial Expression */}
                <div className="lg:col-span-5">
                  <span className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Expressão facial
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {EXPRESSIONS.map((expr) => {
                      const active = robot.expression === expr.id;
                      return (
                        <button
                          key={expr.id}
                          type="button"
                          onClick={() => robot.setExpression(expr.id)}
                          className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                            active
                              ? "bg-cyan-600 text-white"
                              : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                          }`}
                        >
                          {expr.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Rotation Slider */}
                <div className="lg:col-span-4">
                  <div className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                    <label htmlFor="robot-rotation">Girar personagem</label>
                    <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400">
                      {robot.rotationDeg}°
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      id="robot-rotation"
                      type="range"
                      min={-180}
                      max={180}
                      step={1}
                      value={robot.rotationDeg}
                      onChange={(e) =>
                        robot.setRotationDeg(Number(e.target.value))
                      }
                      className="w-full accent-indigo-600"
                    />
                    <button
                      type="button"
                      onClick={() => robot.setRotationDeg(0)}
                      aria-label="Repor rotação"
                      title="Repor rotação"
                      className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Scale Slider */}
                <div className="lg:col-span-3">
                  <div className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                    <label htmlFor="robot-scale">Tamanho</label>
                    <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400">
                      {robot.scale.toFixed(2)}x
                    </span>
                  </div>
                  <input
                    id="robot-scale"
                    type="range"
                    min={0.65}
                    max={1.35}
                    step={0.05}
                    value={robot.scale}
                    onChange={(e) => robot.setScale(Number(e.target.value))}
                    className="w-full accent-indigo-600"
                  />
                </div>
              </div>

              {/* Mobile Quick Background/Theme Actions */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs dark:border-slate-800 md:hidden">
                <button
                  type="button"
                  onClick={() =>
                    setBgMode((m) => (m === "white" ? "transparent" : "white"))
                  }
                  className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200"
                >
                  {bgMode === "white" ? "Fundo: Branco" : "Fundo: Transparente"}
                </button>
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200"
                >
                  {theme === "dark" ? "Tema Claro" : "Tema Escuro"}
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
