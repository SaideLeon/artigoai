"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Download,
  FileText,
  Globe,
  Image as ImageIcon,
  Mail,
  Menu,
  Moon,
  Package,
  Play,
  Search,
  Sliders,
  Sparkles,
  Sun,
  UserCheck,
  X,
  TrendingUp,
  Laptop,
  LogIn,
} from "lucide-react";
import BrandLogo from "@/components/BrandLogo";
import { useTheme } from "@/components/ThemeProvider";
import { useAuth } from "@/components/AuthProvider";
import RobotScene from "@/components/mascot/RobotScene";
import HeroLaptop3D from "@/components/mascot/HeroLaptop3D";
import FloatingRobotAssistant from "@/components/mascot/FloatingRobotAssistant";
import type {
  RobotAnimationState,
  RobotExpression,
} from "@/components/mascot/RobotAnimations";
import {
  PRICING_TIERS,
  USD_TO_BRL,
  formatCurrency,
  getPerArticlePrice,
  type CurrencyCode,
} from "@/lib/pricing";

type PreviewPresetId = "produtividade" | "noticia" | "seo";

const PREVIEW_PRESETS: Record<
  PreviewPresetId,
  {
    label: string;
    tema: string;
    tom: string;
    primeiraPessoa: boolean;
    pesquisaWeb: string;
    tituloArtigo: string;
    meta: string;
    secaoTitulo: string;
    secaoParagrafo: string;
    fonte: string;
  }
> = {
  produtividade: {
    label: "Produtividade IA",
    tema: "Guia prático de produtividade com IA no trabalho",
    tom: "Informativo e Didático",
    primeiraPessoa: true,
    pesquisaWeb: "Automática",
    tituloArtigo:
      "Como adotei fluxos de inteligência artificial sem perder minha voz editorial",
    meta: "2.300 palavras · ~10 min · Primeira pessoa · 6 fontes",
    secaoTitulo: "1. O ponto de partida na minha rotina",
    secaoParagrafo:
      "Quando comecei a testar assistentes de escrita em relatórios semanais, percebi rapidamente que o ganho real não está em delegar o pensamento, mas em estruturar melhor a pesquisa inicial e ganhar clareza antes de redigir.",
    fonte: "Harvard Business Review · McKinsey Productivity Report",
  },
  noticia: {
    label: "Notícia Tech",
    tema: "Novas diretrizes europeias para modelos abertos de IA",
    tom: "Notícia e Atualidade",
    primeiraPessoa: false,
    pesquisaWeb: "Sempre pesquisar",
    tituloArtigo:
      "O que muda para empresas e desenvolvedores com as novas regras de transparência em IA",
    meta: "1.550 palavras · ~7 min · Terceira pessoa · 8 fontes",
    secaoTitulo: "1. Principais exigências do novo marco regulatório",
    secaoParagrafo:
      "Publicadas nesta semana, as diretrizes estabelecem critérios objetivos de documentação técnica, rastreabilidade de dados de treino e avaliação contínua de riscos para provedores que operam no mercado europeu.",
    fonte: "Comissão Europeia · Reuters Technology",
  },
  seo: {
    label: "Guia SEO",
    tema: "Arquitetura de conteúdo para blogs B2B em 2026",
    tom: "Profissional e Corporativo",
    primeiraPessoa: true,
    pesquisaWeb: "Automática",
    tituloArtigo:
      "Como reorganizei nossa arquitetura editorial para dobrar o tráfego orgânico qualificado",
    meta: "2.850 palavras · ~12 min · Primeira pessoa · 5 fontes",
    secaoTitulo: "1. Clusters temáticos orientados à intenção real",
    secaoParagrafo:
      "Em vez de publicar dezenas de textos superficiais, concentrei o calendário em guias profundos divididos por secções objetivas, conectando cada subtema a dúvidas concretas de decisão.",
    fonte: "Search Engine Journal · Ahrefs Editorial Study",
  },
};

const WORKFLOW_STEPS = [
  {
    num: "01",
    short: "Configure",
    titulo: "Configure seu artigo",
    desc: "Insira apenas o título principal ou personalize palavras-chave, tom, idioma, escrita em primeira pessoa e pesquisa web.",
    detalhe:
      "Se preferir começar rápido, basta digitar o título: a IA sugere descrição, palavras-chave e estilo para você revisar ou editar.",
  },
  {
    num: "02",
    short: "Gere",
    titulo: "Geração com IA e pesquisa",
    desc: "O estúdio consulta fontes atualizadas quando necessário, cria o esboço e redige cada secção mantendo continuidade.",
    detalhe:
      "Cada capítulo é escrito com contexto progressivo do que já foi produzido e recebe uma ilustração exclusiva sob medida.",
  },
  {
    num: "03",
    short: "Publique",
    titulo: "Edite e publique",
    desc: "Ajuste qualquer parágrafo diretamente na prévia, salve nos favoritos ou exporte um arquivo HTML limpo e pronto.",
    detalhe:
      "Acompanhe a contagem exata de palavras, revise as fontes consultadas e leve o artigo pronto para o seu blog ou CMS.",
  },
] as const;

const TESTIMONIALS = [
  {
    nome: "Ana Pereira",
    cargo: "Editora de Blog de Tecnologia",
    iniciais: "AP",
    citacao:
      "Antes eu levava quase um dia inteiro para pesquisar fontes e estruturar guias longos. Agora gero o esboço e as secções com referências em menos de cinco minutos.",
  },
  {
    nome: "Carlos Mendes",
    cargo: "Estrategista de Conteúdo e SEO",
    iniciais: "CM",
    citacao:
      "Poder alternar entre primeira pessoa para artigos autorais e pesquisa automática para notícias reduziu drasticamente o tempo de revisão editorial da equipa.",
  },
  {
    nome: "Mariana Silva",
    cargo: "Criadora de Conteúdo Digital",
    iniciais: "MS",
    citacao:
      "Digito apenas o título principal, ajusto a descrição sugerida pela IA e exporto o HTML limpo diretamente para a minha plataforma de publicação.",
  },
] as const;

const FAQS = [
  {
    q: "Preciso preencher todos os campos antes de gerar um artigo?",
    a: "Não. Basta digitar o título principal e clicar em gerar — o estúdio sugere automaticamente descrição, palavras-chave, tom e extensão, que você pode editar quando quiser.",
  },
  {
    q: "Como funciona a pesquisa web para notícias e artigos informativos?",
    a: "No modo automático ou sempre ativo, o estúdio analisa o tema e busca fontes atualizadas na web antes de criar o esboço e redigir as secções, exibindo as referências consultadas ao final.",
  },
  {
    q: "Posso escolher escrever em primeira ou terceira pessoa?",
    a: "Sim. O interruptor de perspectiva narrativa vem habilitado por padrão para textos em primeira pessoa e pode ser alternado para escrita impessoal a qualquer momento.",
  },
  {
    q: "Em quais formatos posso exportar os artigos criados?",
    a: "Além de editar secções ao vivo e copiar o texto completo, você pode descarregar o artigo inteiro em HTML limpo, com imagens integradas e lista de fontes.",
  },
] as const;

const NAV_LINKS = [
  { href: "#inicio", label: "Início" },
  { href: "#recursos", label: "Recursos" },
  { href: "#como-funciona", label: "Como funciona" },
  { href: "#planos", label: "Planos" },
  { href: "#contato", label: "Contato" },
] as const;

export default function LandingPage() {
  const { theme, toggleTheme } = useTheme();
  const { user, authError, clearAuthError, signInWithGoogle } = useAuth();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [headerHovered, setHeaderHovered] = useState(false);
  const [laptopHovered, setLaptopHovered] = useState(false);
  const [laptopPinnedOpen, setLaptopPinnedOpen] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [presetId, setPresetId] = useState<PreviewPresetId>("produtividade");
  const [activeStep, setActiveStep] = useState<number>(0);
  const [mascotInteractClicks, setMascotInteractClicks] = useState(0);
  const [currency, setCurrency] = useState<CurrencyCode>("BRL");
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // Contact form state
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [assunto, setAssunto] = useState("Dúvida geral");
  const [mensagem, setMensagem] = useState("");
  const [formErro, setFormErro] = useState("");
  const [formEnviado, setFormEnviado] = useState(false);

  const preset = PREVIEW_PRESETS[presetId];
  const isLaptopOpen = headerHovered || laptopHovered || laptopPinnedOpen;

  async function handleLandingLogin() {
    setSigningIn(true);
    try {
      await signInWithGoogle();
    } finally {
      setSigningIn(false);
    }
  }

  function handleSelectEnterprise() {
    setAssunto("Pacote Personalizado");
    setFormEnviado(false);
    const el = document.getElementById("contato");
    el?.scrollIntoView({ behavior: "smooth" });
  }

  function handleSubmitContact(e: React.FormEvent) {
    e.preventDefault();
    setFormErro("");

    if (!nome.trim() || nome.trim().length < 2) {
      setFormErro("Informe seu nome para continuarmos.");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setFormErro("Informe um endereço de e-mail válido.");
      return;
    }
    if (!mensagem.trim() || mensagem.trim().length < 10) {
      setFormErro("Escreva uma mensagem com pelo menos 10 caracteres.");
      return;
    }

    setFormEnviado(true);
    setNome("");
    setEmail("");
    setMensagem("");
  }

  return (
    <div className="min-h-screen bg-[#F4F6FB] text-slate-900 dark:bg-slate-950 dark:text-slate-100 transition-colors duration-150">
      {/* Top Bar — Strict 3-Zone Contract (hover opens 3D Laptop) */}
      <header
        onMouseEnter={() => setHeaderHovered(true)}
        onMouseLeave={() => setHeaderHovered(false)}
        className="sticky top-0 z-40 border-b border-slate-200/80 bg-[#F4F6FB]/90 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-950/90"
      >
        <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-8 px-4 py-3.5 sm:px-6 lg:px-8">
          {/* Zone 1: Brand wordmark (single line, no subtitles or chips) */}
          <a
            href="#inicio"
            className="flex items-center gap-2.5 whitespace-nowrap shrink-0 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#5B4AF4] to-[#2563EB] text-white shadow-sm">
              <BrandLogo className="size-5 text-white" />
            </span>
            <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
              Artigen
            </span>
          </a>

          {/* Zone 2: 5 concise single-line nav links */}
          <nav
            aria-label="Navegação principal"
            className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600 dark:text-slate-300"
          >
            {NAV_LINKS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="whitespace-nowrap shrink-0 transition-colors hover:text-slate-950 hover:underline underline-offset-4 dark:hover:text-white"
              >
                {item.label}
              </a>
            ))}
          </nav>

          {/* Zone 3: Account Sign-In + Primary CTA (+ mobile menu button on small screens) */}
          <div className="flex items-center gap-2.5 shrink-0">
            {user ? (
              <Link
                href="/studio"
                className="hidden sm:inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
              >
                {user.photoURL && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.photoURL}
                    alt={user.displayName ?? "Conta"}
                    referrerPolicy="no-referrer"
                    className="h-5 w-5 rounded-full object-cover"
                  />
                )}
                <span className="max-w-[110px] truncate">
                  {user.displayName?.split(" ")[0] || "Minha conta"}
                </span>
              </Link>
            ) : (
              <button
                type="button"
                onClick={handleLandingLogin}
                disabled={signingIn}
                className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-white px-3.5 py-2 text-xs font-semibold text-indigo-700 transition-colors hover:bg-indigo-50 disabled:opacity-60 dark:border-indigo-800/60 dark:bg-slate-900 dark:text-indigo-300 dark:hover:bg-indigo-950/50 whitespace-nowrap shrink-0"
              >
                <LogIn className="h-3.5 w-3.5" />
                <span>{signingIn ? "A entrar..." : "Entrar"}</span>
              </button>
            )}
            <Link
              href="/studio"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#5B4AF4] to-[#2563EB] px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:brightness-110 active:scale-[0.98] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            >
              <span>{user ? "Abrir Estúdio" : "Começar Grátis"}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <button
              type="button"
              onClick={() => setMobileNavOpen((v) => !v)}
              aria-label={mobileNavOpen ? "Fechar menu" : "Abrir menu"}
              aria-expanded={mobileNavOpen}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 md:hidden"
            >
              {mobileNavOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile navigation drawer */}
        {mobileNavOpen && (
          <nav
            aria-label="Menu móvel"
            className="border-t border-slate-200/80 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900 md:hidden"
          >
            <div className="flex flex-col gap-1">
              {NAV_LINKS.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileNavOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  {item.label}
                </a>
              ))}
              {!user && (
                <button
                  type="button"
                  onClick={() => {
                    setMobileNavOpen(false);
                    void handleLandingLogin();
                  }}
                  disabled={signingIn}
                  className="mt-1 flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50/70 px-3 py-2.5 text-sm font-semibold text-indigo-700 dark:border-indigo-800/60 dark:bg-indigo-950/50 dark:text-indigo-300"
                >
                  <LogIn className="h-4 w-4" />
                  <span>{signingIn ? "A entrar..." : "Entrar com Google"}</span>
                </button>
              )}
            </div>
          </nav>
        )}
      </header>

      {authError && (
        <div
          role="alert"
          className="mx-auto mt-3 flex max-w-[1280px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8"
        >
          <div className="flex w-full items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
            <span>{authError}</span>
            <button
              type="button"
              onClick={clearAuthError}
              className="font-semibold underline underline-offset-2 shrink-0"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      <main>
        {/* HERO SECTION */}
        <section
          id="inicio"
          className="relative overflow-hidden border-b border-slate-200/70 bg-gradient-to-b from-indigo-50/70 via-[#F4F6FB] to-[#F4F6FB] py-12 sm:py-16 lg:py-20 dark:border-slate-800/70 dark:from-[#0E162E] dark:via-slate-950 dark:to-slate-950"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 right-0 h-[420px] w-[420px] rounded-full bg-indigo-500/10 blur-3xl dark:bg-indigo-500/15"
          />

          <div className="relative mx-auto grid max-w-[1280px] grid-cols-1 items-center gap-10 px-4 sm:px-6 lg:grid-cols-12 lg:gap-12 lg:px-8">
            {/* Hero Left Copy */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="lg:col-span-6 space-y-6"
            >
              <h1 className="text-[clamp(2.25rem,4vw,3.5rem)] font-bold leading-[1.08] tracking-tight text-slate-950 dark:text-white text-balance">
                Artigen: Gerador de Artigos com{" "}
                <span className="bg-gradient-to-r from-[#5B4AF4] to-[#2563EB] bg-clip-text text-transparent">
                  Inteligência Artificial
                </span>
              </h1>

              <p className="max-w-xl text-base sm:text-lg leading-relaxed text-slate-600 dark:text-slate-300">
                Crie artigos completos, estruturados secção a secção, com
                pesquisa web atualizada e ilustrações automáticas. Economize
                tempo e publique conteúdo original em minutos.
              </p>

              <ul className="space-y-2.5 text-sm sm:text-[15px] text-slate-700 dark:text-slate-200">
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span>Conteúdo original em primeira ou terceira pessoa</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span>Pesquisa web automática para notícias e guias</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span>Sugestão de pauta e descrição a partir do título</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span>Edição ao vivo e exportação em HTML limpo</span>
                </li>
              </ul>

              <div className="flex flex-wrap items-center gap-3.5 pt-1">
                <Link
                  href="/studio"
                  className="inline-flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-[#5B4AF4] to-[#2563EB] px-6 py-3 text-sm font-semibold text-white shadow-md shadow-indigo-600/20 transition-all duration-150 hover:brightness-110 active:scale-[0.98] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                >
                  <span>Começar Agora Grátis</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <a
                  href="#como-funciona"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                >
                  <Play className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>Ver como funciona</span>
                </a>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                <span>Seguro</span>
                <span aria-hidden="true">·</span>
                <span>Pesquisa em tempo real</span>
                <span aria-hidden="true">·</span>
                <span>100% Online</span>
              </div>
            </motion.div>

            {/* Hero Right: 3D Interactive Laptop (opens when hovering header or laptop) */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
              className="lg:col-span-6 flex flex-col items-center"
            >
              <div
                onMouseEnter={() => setLaptopHovered(true)}
                onMouseLeave={() => setLaptopHovered(false)}
                className="relative w-full"
              >
                {/* Floating accent icon badges flanking the 3D stage (left margin, non-occluding) */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none hidden sm:flex absolute left-2 top-12 z-10 h-12 w-12 items-center justify-center rounded-2xl border border-indigo-200/80 bg-white/95 text-[#5B4AF4] shadow-lg shadow-indigo-900/10 dark:border-indigo-500/30 dark:bg-slate-900/95"
                >
                  <FileText className="h-5 w-5" />
                </div>
                <div
                  aria-hidden="true"
                  className="pointer-events-none hidden sm:flex absolute left-6 top-28 z-10 h-11 w-11 items-center justify-center rounded-2xl border border-blue-200/80 bg-white/95 text-[#2563EB] shadow-lg shadow-blue-900/10 dark:border-blue-500/30 dark:bg-slate-900/95"
                >
                  <TrendingUp className="h-5 w-5" />
                </div>

                {/* Isolated 3D WebGL Viewport */}
                <div className="relative h-[340px] sm:h-[410px] lg:h-[440px] w-full">
                  <HeroLaptop3D
                    isOpen={isLaptopOpen}
                    preset={preset}
                    onClickLaptop={() => setLaptopPinnedOpen((v) => !v)}
                  />
                </div>
              </div>

              {/* Unified Compact Control Bar below 3D Laptop (zero viewport occlusion) */}
              <div className="mt-2 flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-slate-200/90 bg-white px-3 py-2 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <button
                  type="button"
                  onClick={() => setLaptopPinnedOpen((v) => !v)}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    isLaptopOpen
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  }`}
                >
                  <Laptop className="h-3.5 w-3.5" />
                  <span>{isLaptopOpen ? "Fechar PC" : "Abrir PC"}</span>
                </button>

                <span
                  aria-hidden="true"
                  className="hidden sm:inline-block h-4 w-px bg-slate-200 dark:bg-slate-700"
                />

                <div
                  role="tablist"
                  aria-label="Exemplos de artigos no estúdio"
                  className="flex flex-wrap items-center gap-1"
                >
                  {(
                    Object.keys(PREVIEW_PRESETS) as PreviewPresetId[]
                  ).map((id) => {
                    const active = presetId === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => {
                          setPresetId(id);
                          setLaptopPinnedOpen(true);
                        }}
                        className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 ${
                          active
                            ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300"
                            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                        }`}
                      >
                        {PREVIEW_PRESETS[id].label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <p className="mt-2 text-center text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Passe o cursor no cabeçalho superior ou clique no computador 3D para abrir o estúdio
              </p>
            </motion.div>
          </div>
        </section>

        {/* SECTION 2: RECURSOS PODEROSOS (Asymmetric Bento Grid) */}
        <section
          id="recursos"
          className="mx-auto max-w-[1280px] px-4 py-16 sm:px-6 lg:px-8 lg:py-20"
        >
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-[clamp(1.75rem,2.8vw,2.35rem)] font-bold tracking-tight text-slate-950 dark:text-white text-balance">
              Recursos Poderosos
            </h2>
            <p className="mt-2.5 text-base text-slate-600 dark:text-slate-400">
              Tudo o que você precisa para pesquisar, escrever e publicar
              conteúdos de alto impacto.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {/* 01 — Featured span-2 */}
            <div className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 lg:col-span-2">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-semibold text-indigo-600 dark:text-indigo-400 tabular-nums">
                    01
                  </span>
                  <Search className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Geração Secção a Secção com Pesquisa Web
                </h3>
                <p className="max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  Produza artigos de 800 a 3.200 palavras sem perder coerência
                  entre capítulos. Quando o tema envolve atualidades, notícias ou
                  dados técnicos, o estúdio consulta fontes reais na web antes
                  de redigir e cita as referências ao final.
                </p>
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  Modos disponíveis:
                </span>
                <span>Automático</span>
                <span aria-hidden="true">·</span>
                <span>Sempre pesquisar</span>
                <span aria-hidden="true">·</span>
                <span>Desativada</span>
              </div>
            </div>

            {/* 02 */}
            <div className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-semibold text-indigo-600 dark:text-indigo-400 tabular-nums">
                    02
                  </span>
                  <UserCheck className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Primeira ou Terceira Pessoa
                </h3>
                <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  Escrita em primeira pessoa ativada por padrão para relatos e
                  guias autorais, ou alterne para terceira pessoa impessoal com
                  um clique.
                </p>
              </div>
            </div>

            {/* 03 */}
            <div className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-semibold text-indigo-600 dark:text-indigo-400 tabular-nums">
                    03
                  </span>
                  <Sparkles className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Sugestão Completa pelo Título
                </h3>
                <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  Informe apenas o título principal e receba descrição,
                  palavras-chave, tom e extensão recomendados para editar antes
                  de gerar.
                </p>
              </div>
            </div>

            {/* 04 */}
            <div className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-semibold text-indigo-600 dark:text-indigo-400 tabular-nums">
                    04
                  </span>
                  <ImageIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Ilustrações por Secção
                </h3>
                <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  Cada secção recebe uma imagem contextual gerada
                  automaticamente com fallback integrado e opção de regenerar
                  individualmente.
                </p>
              </div>
            </div>

            {/* 05 */}
            <div className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-semibold text-indigo-600 dark:text-indigo-400 tabular-nums">
                    05
                  </span>
                  <Globe className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Multi-idioma e Tons Sob Medida
                </h3>
                <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  Crie em Português (Brasil ou Portugal), Inglês, Espanhol ou
                  Francês escolhendo entre 6 tons editoriais distintos.
                </p>
              </div>
            </div>

            {/* 06 — Full-width editorial bar */}
            <div className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 md:col-span-2 lg:col-span-3 lg:flex-row lg:items-center">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-mono font-semibold text-indigo-600 dark:text-indigo-400 tabular-nums">
                  <span>06</span>
                  <span aria-hidden="true">·</span>
                  <span>Editor e Exportação Flexível</span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Edite parágrafos ao vivo, organize favoritos e descarregue HTML
                  pronto
                </h3>
                <p className="max-w-3xl text-sm text-slate-600 dark:text-slate-400">
                  Adicione ou remova secções, acompanhe a densidade de palavras
                  em tempo real e exporte o artigo formatado com um clique.
                </p>
              </div>
              <Link
                href="/studio"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700 whitespace-nowrap shrink-0"
              >
                <Download className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                <span>Experimentar no Estúdio</span>
              </Link>
            </div>
          </div>
        </section>

        {/* SECTION 3: COMO FUNCIONA */}
        <section
          id="como-funciona"
          className="border-y border-slate-200/70 bg-white/75 py-16 lg:py-20 dark:border-slate-800/80 dark:bg-slate-900/40"
        >
          <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-12">
              <div className="lg:col-span-5 space-y-6">
                <div>
                  <h2 className="text-[clamp(1.75rem,2.8vw,2.35rem)] font-bold tracking-tight text-slate-950 dark:text-white text-balance">
                    Como Funciona?
                  </h2>
                  <p className="mt-2 text-base text-slate-600 dark:text-slate-400">
                    Em apenas 3 passos, leve sua ideia do título ao artigo
                    publicável.
                  </p>
                </div>

                <div className="space-y-3">
                  {WORKFLOW_STEPS.map((step, idx) => {
                    const isSelected = activeStep === idx;
                    return (
                      <button
                        key={step.num}
                        type="button"
                        onClick={() => {
                          setActiveStep(idx);
                          setMascotInteractClicks(0);
                        }}
                        className={`flex w-full items-start gap-4 rounded-2xl border p-4 text-left transition-all duration-150 ${
                          isSelected
                            ? "border-indigo-500/60 bg-indigo-50/70 dark:border-indigo-500/50 dark:bg-indigo-950/30"
                            : "border-slate-200/80 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
                        }`}
                      >
                        <span
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-mono text-xs font-bold tabular-nums ${
                            isSelected
                              ? "bg-indigo-600 text-white"
                              : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                          }`}
                        >
                          {step.num}
                        </span>
                        <div>
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                            {step.titulo}
                          </h3>
                          <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                            {step.desc}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Visual 3-stage pipeline panel */}
              <div className="lg:col-span-7">
                <div className="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8 dark:border-slate-800 dark:bg-slate-900">
                  <div className="grid grid-cols-3 gap-3 sm:gap-5">
                    {WORKFLOW_STEPS.map((step, idx) => {
                      const isCurrent = activeStep === idx;
                      return (
                        <button
                          key={step.num}
                          type="button"
                          onClick={() => {
                          setActiveStep(idx);
                          setMascotInteractClicks(0);
                        }}
                          className={`flex flex-col items-center rounded-2xl border p-4 text-center transition-all duration-150 ${
                            isCurrent
                              ? "border-indigo-500 bg-indigo-50/70 dark:border-indigo-500 dark:bg-indigo-950/40"
                              : "border-slate-200/80 bg-slate-50/60 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-800/40"
                          }`}
                        >
                          <div
                            className={`mb-3 flex h-12 w-12 items-center justify-center rounded-2xl ${
                              isCurrent
                                ? "bg-gradient-to-br from-[#5B4AF4] to-[#2563EB] text-white shadow-md shadow-indigo-600/20"
                                : "bg-white text-slate-600 border border-slate-200 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300"
                            }`}
                          >
                            {idx === 0 && <Sliders className="h-5 w-5" />}
                            {idx === 1 && (
                              <BrandLogo
                                variant={isCurrent ? "write" : "static"}
                                className="size-6"
                              />
                            )}
                            {idx === 2 && <Check className="h-5 w-5" />}
                          </div>
                          <span className="text-[11px] font-mono font-semibold text-indigo-600 dark:text-indigo-400 tabular-nums">
                            Passo {step.num}
                          </span>
                          <span className="mt-0.5 text-sm font-bold text-slate-900 dark:text-white">
                            {step.short}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-6 grid grid-cols-1 items-center gap-5 md:grid-cols-[minmax(0,1fr)_220px]">
                    <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-5 dark:border-slate-800 dark:bg-slate-950/60">
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-xs font-mono font-semibold text-indigo-600 dark:text-indigo-400 tabular-nums">
                          Etapa {WORKFLOW_STEPS[activeStep].num}
                        </span>
                        <Link
                          href="/studio"
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                        >
                          <span>Abrir no estúdio</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                      <h3 className="mt-2 text-base font-bold text-slate-900 dark:text-white">
                        {WORKFLOW_STEPS[activeStep].titulo}
                      </h3>
                      <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                        {WORKFLOW_STEPS[activeStep].detalhe}
                      </p>
                      <div className="mt-4 pt-3 border-t border-slate-200/70 dark:border-slate-800">
                        <Link
                          href="/mascote"
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-indigo-600 dark:text-slate-300 dark:hover:text-indigo-400"
                        >
                          <span>Explorar Artigen AI Assistant 3D</span>
                          <ArrowRight className="h-3 w-3" />
                        </Link>
                      </div>
                    </div>

                    <div className="relative flex h-56 flex-col items-center justify-center overflow-hidden rounded-2xl border border-indigo-200/70 bg-gradient-to-b from-indigo-50/80 to-white dark:border-indigo-500/20 dark:from-[#0E162E] dark:to-slate-950">
                      {(() => {
                        const stepAnim: RobotAnimationState =
                          mascotInteractClicks % 2 === 1
                            ? "greeting"
                            : activeStep === 0
                            ? "pointing"
                            : activeStep === 1
                            ? "thinking"
                            : "excited";
                        const stepExpr: RobotExpression =
                          stepAnim === "thinking"
                            ? "curious"
                            : stepAnim === "excited"
                            ? "excited"
                            : "happy";
                        return (
                          <RobotScene
                            animation={stepAnim}
                            expression={stepExpr}
                            cameraZ={4.55}
                            scale={1.0}
                            onRobotClick={() =>
                              setMascotInteractClicks((c) => c + 1)
                            }
                            className="h-full w-full"
                            ariaLabel="Mascote 3D Artigen demonstrando a etapa selecionada"
                          />
                        );
                      })()}
                      <span className="pointer-events-none absolute bottom-2 text-[10px] font-medium text-slate-500 dark:text-slate-400">
                        Arraste ou clique no mascote 3D
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 4: TESTIMONIALS */}
        <section className="mx-auto max-w-[1280px] px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-[clamp(1.75rem,2.8vw,2.35rem)] font-bold tracking-tight text-slate-950 dark:text-white text-balance">
              O que nossos usuários dizem
            </h2>
            <p className="mt-2.5 text-base text-slate-600 dark:text-slate-400">
              Quem publica com frequência ganha velocidade sem abrir mão de
              profundidade e fontes reais.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-3">
            {TESTIMONIALS.map((item) => (
              <figure
                key={item.nome}
                className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
              >
                <blockquote className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                  “{item.citacao}”
                </blockquote>
                <figcaption className="mt-6 flex items-center gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#5B4AF4] to-[#2563EB] text-xs font-bold text-white">
                    {item.iniciais}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold text-slate-900 dark:text-white">
                      {item.nome}
                    </div>
                    <div className="truncate text-xs text-slate-500 dark:text-slate-400">
                      {item.cargo}
                    </div>
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>

        {/* SECTION 5: PLANOS E PREÇOS */}
        <section
          id="planos"
          className="border-t border-slate-200/70 bg-white/60 py-16 lg:py-20 dark:border-slate-800/80 dark:bg-slate-900/30"
        >
          <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-[clamp(1.75rem,2.8vw,2.35rem)] font-bold tracking-tight text-slate-950 dark:text-white text-balance">
                Preços por Artigo e Pacotes
              </h2>
              <p className="mt-2.5 text-base text-slate-600 dark:text-slate-400">
                Pague apenas pelo que produzir — compre 1 artigo avulso ou
                economize até 32% com pacotes de créditos.
              </p>

              {/* Segmented Currency Switcher */}
              <div className="mt-6 inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
                <button
                  type="button"
                  onClick={() => setCurrency("BRL")}
                  className={`rounded-lg px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    currency === "BRL"
                      ? "bg-indigo-600 text-white"
                      : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                  }`}
                >
                  Real (R$)
                </button>
                <button
                  type="button"
                  onClick={() => setCurrency("USD")}
                  className={`rounded-lg px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    currency === "USD"
                      ? "bg-indigo-600 text-white"
                      : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                  }`}
                >
                  Dólar (US$)
                </button>
              </div>
              <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                Pacotes pagos geram artigos e imagens exclusivamente com modelos{" "}
                <strong className="font-semibold text-slate-700 dark:text-slate-200">
                  Google Gemini
                </strong>{" "}
                (~2.500 palavras e até 7 imagens 1K) · Plano gratuito utiliza{" "}
                <strong className="font-semibold text-slate-700 dark:text-slate-200">
                  OpenRouter (texto), Groq (pesquisa) e NVIDIA (imagens)
                </strong>{" "}
                · Cotação: 1 USD = R${" "}
                {USD_TO_BRL.toLocaleString("pt-BR", {
                  minimumFractionDigits: 4,
                  maximumFractionDigits: 4,
                })}
              </p>
            </div>

            <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {PRICING_TIERS.map((tier) => {
                const isPopular = tier.destaque === "popular";
                const isBestValue = tier.destaque === "melhor-valor";
                const totalPrice =
                  currency === "BRL" ? tier.totalBrl : tier.totalUsd;
                const altTotal =
                  currency === "BRL" ? tier.totalUsd : tier.totalBrl;
                const altCurrency: CurrencyCode =
                  currency === "BRL" ? "USD" : "BRL";
                const perArticle = getPerArticlePrice(tier, currency);
                const Icon = tier.artigos === 1 ? FileText : Package;

                return (
                  <div
                    key={tier.id}
                    className={`flex flex-col justify-between rounded-2xl bg-white p-7 dark:bg-slate-900 ${
                      isPopular
                        ? "border-2 border-indigo-600 shadow-lg shadow-indigo-950/10 dark:border-indigo-500"
                        : isBestValue
                        ? "border-2 border-blue-500/70 shadow-md shadow-blue-950/5 dark:border-blue-400/70"
                        : "border border-slate-200/90 dark:border-slate-800"
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          {isPopular && (
                            <span className="mb-0.5 block text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                              Mais popular
                            </span>
                          )}
                          {isBestValue && (
                            <span className="mb-0.5 block text-xs font-semibold text-blue-600 dark:text-blue-400">
                              Melhor custo-benefício
                            </span>
                          )}
                          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                            {tier.nome}
                          </h3>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            {tier.descricao}
                          </p>
                        </div>
                        <Icon className="h-5 w-5 shrink-0 text-indigo-600 dark:text-indigo-400" />
                      </div>

                      <div className="mt-6 flex items-baseline gap-2">
                        <span className="font-mono text-3xl font-bold text-slate-950 dark:text-white tabular-nums">
                          {formatCurrency(totalPrice, currency)}
                        </span>
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                          /{" "}
                          {tier.artigos === 1
                            ? "1 artigo"
                            : `${tier.artigos} artigos`}
                        </span>
                      </div>

                      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                        <span className="font-semibold text-slate-700 dark:text-slate-200 tabular-nums">
                          {formatCurrency(perArticle, currency)} por artigo
                        </span>
                        {tier.descontoPct > 0 ? (
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                            · {tier.descontoPct}% off vs. avulso
                          </span>
                        ) : (
                          <span className="text-slate-500 dark:text-slate-400">
                            · Compra avulsa sem assinatura
                          </span>
                        )}
                      </div>

                      <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500 tabular-nums">
                        Equivalente a {formatCurrency(altTotal, altCurrency)}
                      </p>

                      <ul className="mt-6 space-y-2.5 text-sm text-slate-600 dark:text-slate-300">
                        <li className="flex items-center gap-2.5">
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                          <span>
                            {tier.artigos === 1
                              ? "1 artigo completo (~2.500 palavras)"
                              : `${tier.artigos} créditos de artigo (~2.500 palavras cada)`}
                          </span>
                        </li>
                        <li className="flex items-center gap-2.5">
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                          <span>Até 7 imagens em qualidade 1K por artigo</span>
                        </li>
                        <li className="flex items-center gap-2.5">
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                          <span>Pesquisa web, SEO e exportação HTML</span>
                        </li>
                      </ul>
                    </div>

                    <Link
                      href={`/studio?comprar=${tier.id}`}
                      className={`mt-8 inline-flex w-full items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold transition-all whitespace-nowrap ${
                        isPopular
                          ? "bg-gradient-to-r from-[#5B4AF4] to-[#2563EB] text-white shadow-md shadow-indigo-600/20 hover:brightness-110"
                          : "border border-indigo-600/30 bg-indigo-50/60 text-indigo-700 hover:bg-indigo-100/70 dark:border-indigo-500/40 dark:bg-indigo-950/40 dark:text-indigo-300 dark:hover:bg-indigo-950/70"
                      }`}
                    >
                      {tier.artigos === 1
                        ? "Comprar com Stripe"
                        : "Comprar Pacote · Stripe"}
                    </Link>
                  </div>
                );
              })}
            </div>

            <div className="mt-8 flex flex-col items-start justify-between gap-4 rounded-2xl border border-slate-200/90 bg-white px-6 py-5 sm:flex-row sm:items-center dark:border-slate-800 dark:bg-slate-900">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Precisa de alto volume ou pacotes personalizados para sua agência?
                </h3>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  Também disponibilizamos volumes sob medida e suporte dedicado
                  para redações e equipas de SEO.
                </p>
              </div>
              <button
                type="button"
                onClick={handleSelectEnterprise}
                className="inline-flex shrink-0 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 whitespace-nowrap"
              >
                Falar com Vendas
              </button>
            </div>
          </div>
        </section>

        {/* SECTION 6: FAQ */}
        <section
          id="faq"
          className="mx-auto max-w-[920px] px-4 py-16 sm:px-6 lg:px-8 lg:py-20"
        >
          <div className="text-center">
            <h2 className="text-[clamp(1.75rem,2.8vw,2.35rem)] font-bold tracking-tight text-slate-950 dark:text-white text-balance">
              Perguntas Frequentes
            </h2>
            <p className="mt-2.5 text-base text-slate-600 dark:text-slate-400">
              Respostas rápidas sobre o funcionamento do estúdio.
            </p>
          </div>

          <div className="mt-10 divide-y divide-slate-200/80 rounded-2xl border border-slate-200/80 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
            {FAQS.map((item, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div key={item.q}>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="flex w-full items-center justify-between gap-4 px-6 py-4.5 text-left text-sm sm:text-[15px] font-semibold text-slate-900 transition-colors hover:bg-slate-50/70 dark:text-white dark:hover:bg-slate-800/40"
                  >
                    <span>{item.q}</span>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-150 ${
                        isOpen ? "rotate-180 text-indigo-600 dark:text-indigo-400" : ""
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-6 pb-5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* SECTION 7: CONTATO */}
        <section
          id="contato"
          className="border-t border-slate-200/70 bg-white/70 py-16 lg:py-20 dark:border-slate-800/80 dark:bg-slate-900/35"
        >
          <div className="mx-auto grid max-w-[1120px] grid-cols-1 gap-10 px-4 sm:px-6 lg:grid-cols-12 lg:px-8">
            <div className="lg:col-span-5 space-y-4">
              <h2 className="text-[clamp(1.75rem,2.6vw,2.2rem)] font-bold tracking-tight text-slate-950 dark:text-white text-balance">
                Fale com nossa equipa
              </h2>
              <p className="text-sm sm:text-base leading-relaxed text-slate-600 dark:text-slate-300">
                Tem dúvidas sobre planos empresariais, integrações ou fluxo
                editorial? Envie uma mensagem e retornaremos rapidamente.
              </p>
              <div className="pt-2 text-xs font-medium text-slate-500 dark:text-slate-400 space-y-1.5">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  <span>Atendimento dedicado em português</span>
                </div>
                <p>Resposta em até 1 dia útil · Segunda a Sexta</p>
              </div>
            </div>

            <div className="lg:col-span-7">
              {formEnviado ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-6 dark:border-emerald-900/60 dark:bg-emerald-950/30">
                  <div className="flex items-center gap-2.5 text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 className="h-5 w-5 shrink-0" />
                    <h3 className="text-base font-bold">
                      Mensagem enviada com sucesso
                    </h3>
                  </div>
                  <p className="mt-2 text-sm text-emerald-800/90 dark:text-emerald-200/90">
                    Obrigado pelo contacto. Enquanto nossa equipa responde, você
                    já pode testar gratuitamente o estúdio de artigos.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Link
                      href="/studio"
                      className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
                    >
                      <span>Abrir Estúdio</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                    <button
                      type="button"
                      onClick={() => setFormEnviado(false)}
                      className="rounded-xl border border-emerald-300 px-4 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100/60 dark:border-emerald-800 dark:text-emerald-300"
                    >
                      Enviar outra mensagem
                    </button>
                  </div>
                </div>
              ) : (
                <form
                  onSubmit={handleSubmitContact}
                  noValidate
                  className="space-y-4 rounded-2xl border border-slate-200/90 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor="contato-nome"
                        className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                      >
                        Nome
                      </label>
                      <input
                        id="contato-nome"
                        type="text"
                        value={nome}
                        onChange={(e) => setNome(e.target.value)}
                        placeholder="Seu nome completo"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="contato-email"
                        className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                      >
                        E-mail
                      </label>
                      <input
                        id="contato-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="voce@empresa.com"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="contato-assunto"
                      className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                    >
                      Assunto
                    </label>
                    <select
                      id="contato-assunto"
                      value={assunto}
                      onChange={(e) => setAssunto(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    >
                      <option value="Dúvida geral">Dúvida geral</option>
                      <option value="Pacote de Artigos">Pacote de Artigos</option>
                      <option value="Pacote Personalizado">Pacote Personalizado</option>
                      <option value="Suporte técnico">Suporte técnico</option>
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="contato-mensagem"
                      className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                    >
                      Mensagem
                    </label>
                    <textarea
                      id="contato-mensagem"
                      rows={3}
                      value={mensagem}
                      onChange={(e) => setMensagem(e.target.value)}
                      placeholder="Conte como pretende usar o Gerador de Artigos…"
                      className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    />
                  </div>

                  {formErro && (
                    <p
                      role="alert"
                      className="text-xs font-medium text-rose-600 dark:text-rose-400"
                    >
                      {formErro}
                    </p>
                  )}

                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#5B4AF4] to-[#2563EB] px-5 py-2.5 text-sm font-semibold text-white transition-all hover:brightness-110"
                  >
                    <span>Enviar Mensagem</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </form>
              )}
            </div>
          </div>
        </section>

        {/* FINAL CTA BANNER */}
        <section className="mx-auto max-w-[1280px] px-4 py-12 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#0E162E] via-[#131F44] to-[#1E3A8A] px-6 py-8 sm:px-10 sm:py-10 text-white">
            <div className="relative z-10 flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
              <div className="flex items-center gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/10">
                  <BrandLogo className="size-7 text-white" />
                </span>
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-balance">
                    Pronto para transformar sua forma de criar conteúdo?
                  </h2>
                  <p className="mt-1 text-sm text-slate-300">
                    Comece agora mesmo no estúdio e publique o seu próximo
                    artigo completo em minutos.
                  </p>
                </div>
              </div>
              <Link
                href="/studio"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#5B4AF4] to-[#2563EB] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-950/40 transition-all hover:brightness-110 whitespace-nowrap shrink-0"
              >
                <span>Começar Agora</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* QUIET FOOTER */}
      <footer className="bg-[#0B1124] text-slate-300 border-t border-slate-800/80">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-6 px-4 py-10 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#5B4AF4] to-[#2563EB] text-white">
              <BrandLogo className="size-5 text-white" />
            </span>
            <div>
              <span className="block text-sm font-bold text-white">
                Artigen
              </span>
              <span className="block text-xs text-slate-400">
                Gerador de Artigos com IA
              </span>
            </div>
          </div>

          <nav
            aria-label="Navegação do rodapé"
            className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-medium text-slate-400"
          >
            {NAV_LINKS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="hover:text-white transition-colors whitespace-nowrap"
              >
                {item.label}
              </a>
            ))}
            <a href="#faq" className="hover:text-white transition-colors whitespace-nowrap">
              Perguntas Frequentes
            </a>
            <Link
              href="/mascote"
              className="text-cyan-300 hover:text-white transition-colors whitespace-nowrap"
            >
              Mascote 3D
            </Link>
            <Link
              href="/studio"
              className="text-indigo-300 hover:text-white transition-colors whitespace-nowrap"
            >
              Abrir Estúdio
            </Link>
          </nav>

          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={
                theme === "dark" ? "Ativar modo claro" : "Ativar modo escuro"
              }
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white whitespace-nowrap shrink-0"
            >
              {theme === "dark" ? (
                <>
                  <Sun className="h-3.5 w-3.5 text-amber-400" />
                  <span>Tema claro</span>
                </>
              ) : (
                <>
                  <Moon className="h-3.5 w-3.5" />
                  <span>Tema escuro</span>
                </>
              )}
            </button>
            <span className="text-xs text-slate-500">
              © 2026 Artigen. Todos os direitos reservados.
            </span>
          </div>
        </div>
      </footer>

      <FloatingRobotAssistant context="landing" />
    </div>
  );
}
