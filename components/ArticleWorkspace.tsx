"use client";

import { useState } from "react";
import {
  Eye,
  PenLine,
  BarChart2,
  Copy,
  Check,
  Download,
  Heart,
  RefreshCw,
  Image as ImageIcon,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Loader2,
  BookOpen,
  ExternalLink,
  SearchCheck,
  Info,
  Link2,
} from "lucide-react";
import { motion } from "motion/react";
import BrandLogo from "@/components/BrandLogo";
import RobotScene from "@/components/mascot/RobotScene";
import WritingMascotScene from "@/components/mascot/WritingMascotScene";
import type { FontePesquisa, Secao, WorkspaceTab } from "@/lib/types";

type ArticleWorkspaceProps = {
  titulo: string;
  descricao: string;
  palavrasChave: string[];
  tom: string;
  idioma: string;
  primeiraPessoa: boolean;
  pesquisaUsada: boolean;
  fontes: FontePesquisa[];
  alvoPalavras: number;
  secoes: Secao[];
  estado: string;
  erroGeral: string;
  ocupado: boolean;
  favorito: boolean;
  temArtigoSalvo: boolean;
  onToggleFavorito: () => void;
  onUpdateTitulo: (novo: string) => void;
  onUpdateSecao: (index: number, patch: Partial<Secao>) => void;
  onAddSecao: () => void;
  onRemoveSecao: (index: number) => void;
  onRegenerarImagem: (index: number, prompt: string) => void;
  onExportarHtml: () => void;
  onAplicarSugestao: (tema: string, tags: string[], desc: string) => void;
};

const EXEMPLOS_RAPIDOS = [
  {
    tema: "Como criar aplicativos Android no Google",
    tags: ["Android", "Google Play", "desenvolvimento"],
    desc: "Guia completo e atualizado para criar apps Android e publicar na Google Play Store.",
  },
  {
    tema: "Como funciona o pagamento por telemóvel em Moçambique",
    tags: ["M-Pesa", "pagamentos móveis", "inclusão financeira"],
    desc: "Explicação prática de como funcionam as carteiras móveis, segurança, taxas e impacto no comércio local.",
  },
  {
    tema: "Guia prático de produtividade com inteligência artificial no trabalho",
    tags: ["produtividade", "automação", "fluxos de trabalho"],
    desc: "Estratégias reais para usar ferramentas de IA na escrita, análise e organização diária sem perder qualidade.",
  },
];

function contarPalavrasTexto(texto?: string) {
  if (!texto) return 0;
  return texto.trim().split(/\s+/).filter(Boolean).length;
}

export default function ArticleWorkspace({
  titulo,
  descricao,
  palavrasChave,
  tom,
  idioma,
  primeiraPessoa,
  pesquisaUsada,
  fontes,
  alvoPalavras,
  secoes,
  estado,
  erroGeral,
  ocupado,
  favorito,
  temArtigoSalvo,
  onToggleFavorito,
  onUpdateTitulo,
  onUpdateSecao,
  onAddSecao,
  onRemoveSecao,
  onRegenerarImagem,
  onExportarHtml,
  onAplicarSugestao,
}: ArticleWorkspaceProps) {
  const [tab, setTab] = useState<WorkspaceTab>("previa");
  const [copiado, setCopiado] = useState(false);

  const totalPalavras = secoes.reduce(
    (acc, s) => acc + contarPalavrasTexto(s.texto),
    0
  );
  const minutosLeitura = Math.max(1, Math.ceil(totalPalavras / 200));
  const secoesProntas = secoes.filter((s) => Boolean(s.texto)).length;
  const imagensProntas = secoes.filter((s) => Boolean(s.img)).length;
  const primeiraImagem = secoes.find((s) => s.img)?.img;
  const temConteudo = Boolean(titulo || secoes.length > 0);
  const activeWritingIndex = ocupado ? secoes.findIndex((s) => !s.texto) : -1;
  const primarySourcesCount = fontes.filter((f) => f.tipo === "primaria").length;
  const secondarySourcesCount = fontes.length - primarySourcesCount;

  async function copiarTexto() {
    if (!temConteudo) return;
    const partes = [
      `# ${titulo}`,
      descricao ? `\n${descricao}` : "",
      ...secoes.map(
        (s, idx) => `\n## ${idx + 1}. ${s.titulo}\n\n${s.texto ?? ""}`
      ),
    ];
    try {
      await navigator.clipboard.writeText(partes.join("\n").trim());
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Fallback silencioso se clipboard API não estiver disponível
    }
  }

  // Real SEO computation
  const textoCompleto = [
    titulo,
    descricao,
    ...secoes.map((s) => `${s.titulo} ${s.texto ?? ""}`),
  ]
    .join(" ")
    .toLowerCase();

  const keywordStats = palavrasChave.map((kw) => {
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const matches = textoCompleto.match(new RegExp(escaped, "gi"));
    const count = matches ? matches.length : 0;
    const noTitulo = titulo.toLowerCase().includes(kw.toLowerCase());
    const nosSubtitulos = secoes.some((s) =>
      s.titulo.toLowerCase().includes(kw.toLowerCase())
    );
    return { kw, count, noTitulo, nosSubtitulos };
  });

  const seoChecks = [
    {
      label: "Título principal definido (30–80 caracteres ideal)",
      ok: titulo.trim().length >= 20 && titulo.trim().length <= 95,
      detalhe: `${titulo.trim().length} caracteres`,
    },
    {
      label: "Meta descrição informativa (80–160 caracteres ideal)",
      ok: descricao.trim().length >= 50 && descricao.trim().length <= 300,
      detalhe:
        descricao.trim().length > 0
          ? `${descricao.trim().length} caracteres`
          : "Opcional — não preenchida",
    },
    {
      label: "Extensão adequada para ranqueamento (800+ palavras)",
      ok: totalPalavras >= 800,
      detalhe: `${totalPalavras} palavras`,
    },
    {
      label: "Estrutura dividida em múltiplas secções H2",
      ok: secoes.length >= 4,
      detalhe: `${secoes.length} secções`,
    },
    {
      label: "Imagens com texto alternativo (alt) presentes",
      ok: imagensProntas > 0,
      detalhe: `${imagensProntas} de ${secoes.length} secções`,
    },
  ];

  return (
    <section
      aria-label="Área de trabalho do artigo"
      className="flex max-h-[78vh] min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 xl:h-full xl:max-h-none"
    >
      {/* Top Toolbar */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5 dark:border-slate-800">
        {/* Segmented tabs */}
        <div
          role="tablist"
          aria-label="Modo de visualização do artigo"
          className="inline-flex items-center gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800"
        >
          {(
            [
              { id: "previa", label: "Prévia", icon: Eye },
              { id: "editor", label: "Editor", icon: PenLine },
              { id: "seo", label: "SEO", icon: BarChart2 },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            const ativo = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={ativo}
                onClick={() => setTab(item.id)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all duration-150 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-indigo-600 ${
                  ativo
                    ? "bg-gradient-to-r from-[#5B4AF4] to-[#3B82F6] text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {temArtigoSalvo && (
            <button
              type="button"
              onClick={onToggleFavorito}
              aria-label={
                favorito ? "Remover dos favoritos" : "Adicionar aos favoritos"
              }
              title={
                favorito ? "Remover dos favoritos" : "Adicionar aos favoritos"
              }
              className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border transition-colors ${
                favorito
                  ? "border-rose-200 bg-rose-50 text-rose-600 dark:border-rose-900/60 dark:bg-rose-950/50 dark:text-rose-400"
                  : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-rose-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-rose-400"
              }`}
            >
              <Heart
                className={`h-4 w-4 ${favorito ? "fill-current" : ""}`}
              />
            </button>
          )}

          <button
            type="button"
            onClick={copiarTexto}
            disabled={!temConteudo}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 whitespace-nowrap shrink-0"
          >
            {copiado ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                <span className="text-emerald-700 dark:text-emerald-300">
                  Copiado!
                </span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
                <span>Copiar Texto</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onExportarHtml}
            disabled={!temConteudo || ocupado}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#5B4AF4] to-[#3B82F6] px-4 py-2 text-xs font-semibold text-white shadow-xs transition-all hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-45 whitespace-nowrap shrink-0"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Baixar HTML</span>
          </button>
        </div>
      </div>

      {/* Live Generation Status / Error Strip */}
      {(ocupado || estado || erroGeral) && (
        <div
          aria-live="polite"
          className={`flex shrink-0 flex-wrap items-center justify-between gap-3 border-b px-5 py-2.5 text-xs ${
            erroGeral
              ? "border-rose-100 bg-rose-50/70 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300"
              : "border-indigo-100 bg-indigo-50/50 text-indigo-900 dark:border-indigo-900/40 dark:bg-indigo-950/30 dark:text-indigo-200"
          }`}
        >
          <div className="flex items-center gap-2.5 font-medium">
            {ocupado ? (
              <BrandLogo
                variant="write"
                className="size-5 shrink-0 text-indigo-600 dark:text-indigo-400"
              />
            ) : erroGeral ? (
              <AlertCircle className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            )}
            <span>{erroGeral || estado}</span>
          </div>
          {secoes.length > 0 && (
            <span className="font-mono text-[11px] text-slate-600 dark:text-slate-400 tabular-nums">
              {secoesProntas}/{secoes.length} secções · {totalPalavras} palavras
              {alvoPalavras > 0 ? ` (meta ~${alvoPalavras})` : ""}
            </span>
          )}
        </div>
      )}

      {/* Workspace Body (independent internal scroll) */}
      <div className="studio-scroll min-h-0 flex-1 overflow-y-auto p-5 sm:p-7">
        {!temConteudo && ocupado ? (
          /* Generating Outline / Research State */
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-4 h-40 w-40 overflow-hidden rounded-3xl border border-indigo-100 bg-gradient-to-b from-indigo-50/70 to-white shadow-xs dark:border-indigo-900/50 dark:from-indigo-950/40 dark:to-slate-900">
              <RobotScene
                animation="thinking"
                expression="curious"
                cameraZ={4.45}
                className="h-full w-full"
                ariaLabel="Mulébi a preparar o esboço do artigo"
              />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              A preparar o seu artigo…
            </h3>
            <p className="mt-1.5 max-w-md text-sm text-slate-500 dark:text-slate-400">
              {estado || "A estruturar secções e a preparar a redação."}
            </p>
          </div>
        ) : !temConteudo ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/70 dark:text-indigo-400">
              <BookOpen className="h-7 w-7" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Pronto para criar o seu próximo artigo
            </h3>
            <p className="mt-1.5 max-w-md text-sm text-slate-500 dark:text-slate-400">
              Preencha o tema ao lado ou selecione um dos modelos abaixo para
              testar a geração secção a secção com ilustrações.
            </p>

            <div className="mt-7 grid w-full max-w-2xl gap-3 text-left">
              {EXEMPLOS_RAPIDOS.map((ex) => (
                <button
                  key={ex.tema}
                  type="button"
                  onClick={() =>
                    onAplicarSugestao(ex.tema, ex.tags, ex.desc)
                  }
                  className="group flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 transition-colors hover:border-indigo-300 hover:bg-indigo-50/40 dark:border-slate-800 dark:bg-slate-800/50 dark:hover:border-indigo-500/50 dark:hover:bg-indigo-950/30"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-800 group-hover:text-indigo-700 dark:text-slate-200 dark:group-hover:text-indigo-300">
                      {ex.tema}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                      {ex.desc}
                    </p>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                    <Sparkles className="h-3.5 w-3.5" />
                    Usar
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : tab === "previa" ? (
          /* PRÉVIA TAB */
          <motion.article
            key="previa"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.16 }}
            className="mx-auto max-w-3xl"
          >
            {/* Cover Banner Image if available */}
            {primeiraImagem && (
              <div className="relative mb-7 overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-900 dark:border-slate-800">
                <img
                  src={primeiraImagem}
                  alt={titulo}
                  referrerPolicy="no-referrer"
                  className="h-56 w-full object-cover opacity-85 sm:h-64"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/35 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-6 text-white">
                  <h1 className="text-2xl font-bold leading-tight sm:text-3xl text-balance">
                    {titulo}
                  </h1>
                  {descricao && (
                    <p className="mt-2 max-w-2xl text-sm text-slate-200 line-clamp-2">
                      {descricao}
                    </p>
                  )}
                </div>
              </div>
            )}

            {!primeiraImagem && (
              <header className="mb-6">
                <h1 className="font-serif text-3xl font-bold leading-tight text-slate-900 dark:text-white sm:text-4xl text-balance">
                  {titulo}
                </h1>
                {descricao && (
                  <p className="mt-2.5 text-base leading-relaxed text-slate-600 dark:text-slate-300">
                    {descricao}
                  </p>
                )}
              </header>
            )}

            {/* Clean Unboxed Metadata Bar (Zero-Pill Discipline) */}
            <div className="mb-7 flex flex-wrap items-center gap-x-2.5 gap-y-1 border-b border-slate-100 pb-4 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
              <span className="font-medium text-slate-700 dark:text-slate-200 tabular-nums">
                {totalPalavras} palavras
              </span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">~{minutosLeitura} min de leitura</span>
              <span aria-hidden="true">·</span>
              <span>{idioma}</span>
              <span aria-hidden="true">·</span>
              <span>{tom}</span>
              <span aria-hidden="true">·</span>
              <span>
                {primeiraPessoa ? "Primeira pessoa" : "Terceira pessoa"}
              </span>
              {(pesquisaUsada || fontes.length > 0) && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex flex-wrap items-center gap-1.5 font-medium">
                    <SearchCheck className="h-3.5 w-3.5 text-indigo-700 dark:text-indigo-400" />
                    {fontes.length > 0 ? (
                      <span className="tabular-nums">
                        {primarySourcesCount > 0 && (
                          <span className="text-emerald-700 dark:text-emerald-400">
                            {primarySourcesCount}{" "}
                            {primarySourcesCount === 1
                              ? "primária"
                              : "primárias"}
                          </span>
                        )}
                        {primarySourcesCount > 0 && secondarySourcesCount > 0 && (
                          <span className="mx-1 text-slate-400" aria-hidden="true">
                            ·
                          </span>
                        )}
                        {secondarySourcesCount > 0 && (
                          <span className="text-slate-600 dark:text-slate-300">
                            {secondarySourcesCount}{" "}
                            {secondarySourcesCount === 1
                              ? "secundária"
                              : "secundárias"}
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-indigo-700 dark:text-indigo-400">
                        Pesquisa web
                      </span>
                    )}
                  </span>
                </>
              )}
            </div>

            {/* Sections */}
            <div className="space-y-9">
              {secoes.map((sec, i) => (
                <section key={i} className="space-y-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white tabular-nums">
                      {i + 1}
                    </span>
                    <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                      {sec.titulo}
                    </h2>
                  </div>

                  {/* Section illustration */}
                  {sec.img && i > 0 ? (
                    <figure className="overflow-hidden rounded-xl border border-slate-200/80 bg-slate-50 dark:border-slate-800 dark:bg-slate-800">
                      <img
                        src={sec.img}
                        alt={sec.titulo}
                        referrerPolicy="no-referrer"
                        className="w-full max-h-80 object-cover"
                      />
                    </figure>
                  ) : sec.texto && (i > 0 || !primeiraImagem) ? (
                    sec.aGerarImagem ? (
                      <div className="flex items-center gap-2.5 rounded-xl border border-dashed border-indigo-200 bg-indigo-50/40 px-4 py-3 text-xs font-medium text-indigo-700 dark:border-indigo-800/60 dark:bg-indigo-950/30 dark:text-indigo-300">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>A gerar ilustração para esta secção…</span>
                      </div>
                    ) : sec.erro ? (
                      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-rose-200 bg-rose-50/50 px-4 py-3 text-xs text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
                        <span>{sec.erro}</span>
                        {sec.prompt && (
                          <button
                            type="button"
                            onClick={() => onRegenerarImagem(i, sec.prompt!)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-1.5 font-semibold text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:bg-slate-900 dark:text-rose-300 dark:hover:bg-slate-800"
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                            <span>Tentar imagem de novo</span>
                          </button>
                        )}
                      </div>
                    ) : !sec.img && sec.prompt ? (
                      <div className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-2.5 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400">
                        <span className="flex items-center gap-2">
                          <ImageIcon className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                          <span>Secção sem ilustração</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => onRegenerarImagem(i, sec.prompt!)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                        >
                          <Sparkles className="h-3 w-3 text-indigo-600 dark:text-indigo-400" />
                          <span>Gerar imagem</span>
                        </button>
                      </div>
                    ) : null
                  ) : null}

                  {sec.texto ? (
                    <div className="space-y-4 font-serif text-[17px] leading-[1.78] text-slate-800 dark:text-slate-200">
                      {sec.texto.split(/\n\s*\n/).map((paragrafo, pIdx) => (
                        <p key={pIdx}>{paragrafo}</p>
                      ))}
                    </div>
                  ) : i === activeWritingIndex ? (
                    <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 overflow-hidden rounded-2xl border border-indigo-200/80 bg-gradient-to-r from-[#DCE3FF] via-[#EEF2FF] to-[#F8FAFF] p-4 sm:py-3 sm:pr-6 dark:border-indigo-500/25 dark:from-[#131C3D] dark:via-[#111936] dark:to-slate-900">
                      <div className="h-52 w-52 sm:h-56 sm:w-60 shrink-0">
                        <WritingMascotScene
                          cameraZ={4.35}
                          scale={1.04}
                          className="h-full w-full"
                          ariaLabel={`Mulébi sentado nos livros a escrever a secção ${i + 1}`}
                        />
                      </div>
                      <div className="min-w-0 flex-1 space-y-2 text-center sm:text-left">
                        <div className="inline-flex items-center gap-2 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                          <BrandLogo
                            variant="write"
                            className="size-4 shrink-0"
                          />
                          <span>Mulébi está a escrever…</span>
                        </div>
                        <p className="text-sm font-semibold leading-relaxed text-slate-800 dark:text-slate-100">
                          {sec.objetivo ||
                            "A redigir os parágrafos desta secção com fluidez e contexto."}
                        </p>
                        <p className="inline-flex items-center justify-center sm:justify-start gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                          <Info className="h-3.5 w-3.5 shrink-0 text-indigo-500 dark:text-indigo-400" />
                          <span>
                            O texto aparecerá aqui assim que a secção ficar pronta.
                          </span>
                        </p>
                      </div>
                    </div>
                  ) : ocupado ? (
                    <div className="flex items-center gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-3 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-800/35 dark:text-slate-400">
                      <BrandLogo
                        variant="write"
                        className="size-5 shrink-0 text-indigo-500 dark:text-indigo-400"
                      />
                      <div className="min-w-0">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          Na fila de escrita — o Mulébi vai redigir a seguir
                        </span>
                        {sec.objetivo && (
                          <p className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400">
                            {sec.objetivo}
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-3 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-800/30 dark:text-slate-400">
                      <span>Secção ainda sem texto.</span>
                      <button
                        type="button"
                        onClick={() => setTab("editor")}
                        className="inline-flex items-center gap-1.5 font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
                      >
                        <PenLine className="h-3.5 w-3.5" />
                        <span>Escrever no Editor</span>
                      </button>
                    </div>
                  )}
                </section>
              ))}
            </div>

            {fontes.length > 0 && (
              <aside className="mt-10 border-t border-slate-200 pt-6 dark:border-slate-800">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Fontes consultadas
                  </h3>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold tabular-nums">
                    <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200/80 bg-emerald-50 px-2 py-0.5 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/60 dark:text-emerald-300">
                      <Link2 className="h-3 w-3" />
                      <span>
                        {primarySourcesCount}{" "}
                        {primarySourcesCount === 1 ? "primária" : "primárias"}
                      </span>
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      <SearchCheck className="h-3 w-3 text-indigo-600 dark:text-indigo-400" />
                      <span>
                        {secondarySourcesCount}{" "}
                        {secondarySourcesCount === 1 ? "secundária" : "secundárias"}
                      </span>
                    </span>
                  </div>
                </div>
                <ol className="mt-3 space-y-2.5 text-xs text-slate-600 dark:text-slate-400">
                  {fontes.map((fonte, idx) => {
                    const safeHref = /^https?:\/\//i.test(fonte.url)
                      ? fonte.url
                      : "#";
                    const isPrimaria = fonte.tipo === "primaria";
                    return (
                      <li key={fonte.url} className="flex flex-wrap items-start gap-2">
                        <span className="font-mono text-slate-400 dark:text-slate-500 tabular-nums">
                          {idx + 1}.
                        </span>
                        {fonte.tipo && (
                          <span
                            className={`inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                              isPrimaria
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300"
                                : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                            }`}
                          >
                            {isPrimaria ? "Fonte primária" : "Apoio secundário"}
                          </span>
                        )}
                        <a
                          href={safeHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-medium text-indigo-700 hover:underline dark:text-indigo-400 break-all"
                        >
                          <span>{fonte.titulo}</span>
                          <ExternalLink className="h-3 w-3 shrink-0" />
                        </a>
                      </li>
                    );
                  })}
                </ol>
              </aside>
            )}
          </motion.article>
        ) : tab === "editor" ? (
          /* EDITOR TAB */
          <motion.div
            key="editor"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.16 }}
            className="mx-auto max-w-3xl space-y-6"
          >
            <div>
              <label
                htmlFor="editor-titulo"
                className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-400"
              >
                Título do artigo
              </label>
              <input
                id="editor-titulo"
                type="text"
                value={titulo}
                onChange={(e) => onUpdateTitulo(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-2.5 text-lg font-bold text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-100 dark:focus:bg-slate-800"
              />
            </div>

            <div className="space-y-5">
              {secoes.map((sec, idx) => (
                <div
                  key={idx}
                  className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/40 p-4 dark:border-slate-800 dark:bg-slate-800/40"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-400 tabular-nums">
                      Secção {idx + 1} · {contarPalavrasTexto(sec.texto)} palavras
                    </span>
                    <div className="flex items-center gap-2">
                      {sec.prompt && (
                        <button
                          type="button"
                          disabled={sec.aGerarImagem}
                          onClick={() => onRegenerarImagem(idx, sec.prompt!)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                        >
                          <RefreshCw
                            className={`h-3 w-3 ${
                              sec.aGerarImagem ? "animate-spin" : ""
                            }`}
                          />
                          <span>{sec.img ? "Nova imagem" : "Gerar imagem"}</span>
                        </button>
                      )}
                      {secoes.length > 1 && (
                        <button
                          type="button"
                          onClick={() => onRemoveSecao(idx)}
                          aria-label={`Remover secção ${idx + 1}`}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/60 dark:hover:text-rose-400"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  <input
                    type="text"
                    value={sec.titulo}
                    onChange={(e) =>
                      onUpdateSecao(idx, { titulo: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />

                  <textarea
                    rows={6}
                    value={sec.texto ?? ""}
                    onChange={(e) =>
                      onUpdateSecao(idx, { texto: e.target.value })
                    }
                    placeholder="Conteúdo da secção..."
                    className="w-full rounded-lg border border-slate-200 bg-white p-3 text-sm leading-relaxed text-slate-800 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  />
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={onAddSecao}
              className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-indigo-300 bg-indigo-50/40 px-4 py-2.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 dark:border-indigo-700/60 dark:bg-indigo-950/30 dark:text-indigo-300 dark:hover:bg-indigo-950/50"
            >
              <Plus className="h-4 w-4" />
              <span>Adicionar nova secção</span>
            </button>
          </motion.div>
        ) : (
          /* SEO TAB */
          <motion.div
            key="seo"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.16 }}
            className="mx-auto max-w-3xl space-y-6"
          >
            {/* Summary numbers */}
            <div className="grid grid-cols-2 gap-4 border-b border-slate-100 pb-5 dark:border-slate-800 sm:grid-cols-4">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Total de palavras
                </p>
                <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
                  {totalPalavras}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Tempo de leitura
                </p>
                <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
                  {minutosLeitura} min
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Secções H2
                </p>
                <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
                  {secoes.length}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Imagens geradas
                </p>
                <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
                  {imagensProntas}/{secoes.length}
                </p>
              </div>
            </div>

            {/* Checklist */}
            <div>
              <h3 className="mb-3 text-sm font-bold text-slate-900 dark:text-slate-100">
                Auditoria editorial e estrutura
              </h3>
              <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                {seoChecks.map((check) => (
                  <div
                    key={check.label}
                    className="flex items-center justify-between gap-4 px-4 py-3 text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      {check.ok ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <AlertCircle className="h-4 w-4 shrink-0 text-amber-500" />
                      )}
                      <span className="font-medium text-slate-800 dark:text-slate-200">
                        {check.label}
                      </span>
                    </div>
                    <span className="font-mono text-slate-500 dark:text-slate-400 tabular-nums shrink-0">
                      {check.detalhe}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Keywords Density */}
            <div>
              <h3 className="mb-3 text-sm font-bold text-slate-900 dark:text-slate-100">
                Cobertura de palavras-chave
              </h3>
              {keywordStats.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-200 p-4 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  Nenhuma palavra-chave informada na configuração. Adicione
                  palavras-chave no painel ao lado para acompanhar a densidade
                  no texto.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-800/70 dark:text-slate-300">
                      <tr>
                        <th className="px-4 py-2.5 font-semibold">
                          Palavra-chave
                        </th>
                        <th className="px-4 py-2.5 font-semibold">No título</th>
                        <th className="px-4 py-2.5 font-semibold">
                          Nos subtítulos
                        </th>
                        <th className="px-4 py-2.5 text-right font-semibold">
                          Ocorrências
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {keywordStats.map((item) => (
                        <tr
                          key={item.kw}
                          className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                        >
                          <td className="px-4 py-2.5 font-semibold text-slate-800 dark:text-slate-200">
                            {item.kw}
                          </td>
                          <td className="px-4 py-2.5">
                            {item.noTitulo ? (
                              <span className="font-medium text-emerald-700 dark:text-emerald-400">
                                Presente
                              </span>
                            ) : (
                              <span className="text-slate-400 dark:text-slate-500">
                                Ausente
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2.5">
                            {item.nosSubtitulos ? (
                              <span className="font-medium text-emerald-700 dark:text-emerald-400">
                                Presente
                              </span>
                            ) : (
                              <span className="text-slate-400 dark:text-slate-500">
                                Ausente
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
                            {item.count}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </section>
  );
}
