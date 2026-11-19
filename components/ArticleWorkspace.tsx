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
} from "lucide-react";
import { motion } from "motion/react";
import type { Secao, WorkspaceTab } from "@/lib/types";

type ArticleWorkspaceProps = {
  titulo: string;
  descricao: string;
  palavrasChave: string[];
  tom: string;
  idioma: string;
  primeiraPessoa: boolean;
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
      className="flex min-w-0 flex-col rounded-2xl border border-slate-200/90 bg-white shadow-xs"
    >
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
        {/* Segmented tabs */}
        <div
          role="tablist"
          aria-label="Modo de visualização do artigo"
          className="inline-flex items-center gap-1 rounded-xl bg-slate-100 p-1"
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
                    : "text-slate-600 hover:text-slate-900"
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
                  ? "border-rose-200 bg-rose-50 text-rose-600"
                  : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-rose-600"
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
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45 whitespace-nowrap shrink-0"
          >
            {copiado ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-600" />
                <span className="text-emerald-700">Copiado!</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5 text-slate-500" />
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
          className={`flex flex-wrap items-center justify-between gap-3 border-b px-5 py-2.5 text-xs ${
            erroGeral
              ? "border-rose-100 bg-rose-50/70 text-rose-700"
              : "border-indigo-100 bg-indigo-50/50 text-indigo-900"
          }`}
        >
          <div className="flex items-center gap-2 font-medium">
            {ocupado ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-600" />
            ) : erroGeral ? (
              <AlertCircle className="h-3.5 w-3.5 text-rose-600" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            )}
            <span>{erroGeral || estado}</span>
          </div>
          {secoes.length > 0 && (
            <span className="font-mono text-[11px] text-slate-600 tabular-nums">
              {secoesProntas}/{secoes.length} secções · {totalPalavras} palavras
              {alvoPalavras > 0 ? ` (meta ~${alvoPalavras})` : ""}
            </span>
          )}
        </div>
      )}

      {/* Workspace Body */}
      <div className="p-5 sm:p-7">
        {!temConteudo ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
              <BookOpen className="h-7 w-7" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">
              Pronto para criar o seu próximo artigo
            </h3>
            <p className="mt-1.5 max-w-md text-sm text-slate-500">
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
                  className="group flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 transition-colors hover:border-indigo-300 hover:bg-indigo-50/40"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-800 group-hover:text-indigo-700">
                      {ex.tema}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500 line-clamp-1">
                      {ex.desc}
                    </p>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-indigo-600">
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
              <div className="relative mb-7 overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-900">
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
                <h1 className="font-serif text-3xl font-bold leading-tight text-slate-900 sm:text-4xl text-balance">
                  {titulo}
                </h1>
                {descricao && (
                  <p className="mt-2.5 text-base leading-relaxed text-slate-600">
                    {descricao}
                  </p>
                )}
              </header>
            )}

            {/* Clean Unboxed Metadata Bar (Zero-Pill Discipline) */}
            <div className="mb-7 flex flex-wrap items-center gap-x-2.5 gap-y-1 border-b border-slate-100 pb-4 text-xs text-slate-500">
              <span className="font-medium text-slate-700 tabular-nums">
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
            </div>

            {/* Sections */}
            <div className="space-y-9">
              {secoes.map((sec, i) => (
                <section key={i} className="space-y-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white tabular-nums">
                      {i + 1}
                    </span>
                    <h2 className="text-xl font-bold tracking-tight text-slate-900">
                      {sec.titulo}
                    </h2>
                  </div>

                  {/* Section illustration (skip repeating first image if shown as cover, or show subsequent images) */}
                  {sec.img && i > 0 ? (
                    <figure className="overflow-hidden rounded-xl border border-slate-200/80 bg-slate-50">
                      <img
                        src={sec.img}
                        alt={sec.titulo}
                        referrerPolicy="no-referrer"
                        className="w-full max-h-80 object-cover"
                      />
                    </figure>
                  ) : sec.texto && (i > 0 || !primeiraImagem) ? (
                    sec.aGerarImagem ? (
                      <div className="flex items-center gap-2.5 rounded-xl border border-dashed border-indigo-200 bg-indigo-50/40 px-4 py-3 text-xs font-medium text-indigo-700">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>A gerar ilustração para esta secção…</span>
                      </div>
                    ) : sec.erro ? (
                      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-rose-200 bg-rose-50/50 px-4 py-3 text-xs text-rose-700">
                        <span>{sec.erro}</span>
                        {sec.prompt && (
                          <button
                            type="button"
                            onClick={() => onRegenerarImagem(i, sec.prompt!)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-1.5 font-semibold text-rose-700 hover:bg-rose-50"
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                            <span>Tentar imagem de novo</span>
                          </button>
                        )}
                      </div>
                    ) : !sec.img && sec.prompt ? (
                      <div className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-2.5 text-xs text-slate-500">
                        <span className="flex items-center gap-2">
                          <ImageIcon className="h-4 w-4 text-slate-400" />
                          <span>Secção sem ilustração</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => onRegenerarImagem(i, sec.prompt!)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 font-semibold text-slate-700 hover:bg-slate-100"
                        >
                          <Sparkles className="h-3 w-3 text-indigo-600" />
                          <span>Gerar imagem</span>
                        </button>
                      </div>
                    ) : null
                  ) : null}

                  {sec.texto ? (
                    <div className="space-y-4 font-serif text-[17px] leading-[1.78] text-slate-800">
                      {sec.texto.split(/\n\s*\n/).map((paragrafo, pIdx) => (
                        <p key={pIdx}>{paragrafo}</p>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-2.5 py-2">
                      <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
                      <div className="h-4 w-5/6 animate-pulse rounded bg-slate-100" />
                      <div className="h-4 w-4/6 animate-pulse rounded bg-slate-100" />
                    </div>
                  )}
                </section>
              ))}
            </div>
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
                className="mb-1.5 block text-xs font-semibold text-slate-600"
              >
                Título do artigo
              </label>
              <input
                id="editor-titulo"
                type="text"
                value={titulo}
                onChange={(e) => onUpdateTitulo(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-2.5 text-lg font-bold text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-none"
              />
            </div>

            <div className="space-y-5">
              {secoes.map((sec, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-slate-200 bg-slate-50/40 p-4 space-y-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-indigo-700 tabular-nums">
                      Secção {idx + 1} · {contarPalavrasTexto(sec.texto)} palavras
                    </span>
                    <div className="flex items-center gap-2">
                      {sec.prompt && (
                        <button
                          type="button"
                          disabled={sec.aGerarImagem}
                          onClick={() => onRegenerarImagem(idx, sec.prompt!)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
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
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
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
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-900 focus:border-indigo-500 focus:outline-none"
                  />

                  <textarea
                    rows={6}
                    value={sec.texto ?? ""}
                    onChange={(e) =>
                      onUpdateSecao(idx, { texto: e.target.value })
                    }
                    placeholder="Conteúdo da secção..."
                    className="w-full rounded-lg border border-slate-200 bg-white p-3 text-sm leading-relaxed text-slate-800 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={onAddSecao}
              className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-indigo-300 bg-indigo-50/40 px-4 py-2.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
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
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 border-b border-slate-100 pb-5">
              <div>
                <p className="text-xs text-slate-500">Total de palavras</p>
                <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">
                  {totalPalavras}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Tempo de leitura</p>
                <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">
                  {minutosLeitura} min
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Secções H2</p>
                <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">
                  {secoes.length}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Imagens geradas</p>
                <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">
                  {imagensProntas}/{secoes.length}
                </p>
              </div>
            </div>

            {/* Checklist */}
            <div>
              <h3 className="mb-3 text-sm font-bold text-slate-900">
                Auditoria editorial e estrutura
              </h3>
              <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                {seoChecks.map((check) => (
                  <div
                    key={check.label}
                    className="flex items-center justify-between gap-4 px-4 py-3 text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      {check.ok ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                      ) : (
                        <AlertCircle className="h-4 w-4 shrink-0 text-amber-500" />
                      )}
                      <span className="font-medium text-slate-800">
                        {check.label}
                      </span>
                    </div>
                    <span className="font-mono text-slate-500 tabular-nums shrink-0">
                      {check.detalhe}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Keywords Density */}
            <div>
              <h3 className="mb-3 text-sm font-bold text-slate-900">
                Cobertura de palavras-chave
              </h3>
              {keywordStats.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-200 p-4 text-xs text-slate-500">
                  Nenhuma palavra-chave informada na configuração. Adicione
                  palavras-chave no painel ao lado para acompanhar a densidade
                  no texto.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
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
                    <tbody className="divide-y divide-slate-100">
                      {keywordStats.map((item) => (
                        <tr key={item.kw} className="hover:bg-slate-50/70">
                          <td className="px-4 py-2.5 font-semibold text-slate-800">
                            {item.kw}
                          </td>
                          <td className="px-4 py-2.5">
                            {item.noTitulo ? (
                              <span className="font-medium text-emerald-700">
                                Presente
                              </span>
                            ) : (
                              <span className="text-slate-400">Ausente</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5">
                            {item.nosSubtitulos ? (
                              <span className="font-medium text-emerald-700">
                                Presente
                              </span>
                            ) : (
                              <span className="text-slate-400">Ausente</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono font-semibold text-slate-900 tabular-nums">
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
