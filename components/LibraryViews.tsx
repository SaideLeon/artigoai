"use client";

import { useMemo, useState } from "react";
import {
  FileText,
  Heart,
  Search,
  Trash2,
  ExternalLink,
  Download,
  BarChart3,
  Settings,
  Plus,
  Check,
  Sun,
  Moon,
  TrendingUp,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { useTheme } from "@/components/ThemeProvider";
import PWAInstallButton from "@/components/PWAInstallButton";
import {
  FAIXAS_PALAVRAS,
  TONS_TEXTO,
  IDIOMAS,
  type ArtigoSalvo,
  type ConfiguracoesPadrao,
  type FaixaPalavrasId,
  type ModoPesquisa,
} from "@/lib/types";

type ArticlesListViewProps = {
  apenasFavoritos: boolean;
  artigos: ArtigoSalvo[];
  onAbrirArtigo: (artigo: ArtigoSalvo) => void;
  onToggleFavorito: (id: string) => void;
  onExcluirArtigo: (id: string) => void;
  onBaixarHtml: (artigo: ArtigoSalvo) => void;
  onIrParaInicio: () => void;
};

export function ArticlesListView({
  apenasFavoritos,
  artigos,
  onAbrirArtigo,
  onToggleFavorito,
  onExcluirArtigo,
  onBaixarHtml,
  onIrParaInicio,
}: ArticlesListViewProps) {
  const [busca, setBusca] = useState("");

  const filtrados = artigos
    .filter((a) => (apenasFavoritos ? a.favorito : true))
    .filter(
      (a) =>
        a.titulo.toLowerCase().includes(busca.toLowerCase()) ||
        a.tema.toLowerCase().includes(busca.toLowerCase())
    );

  return (
    <section className="flex max-h-[78vh] flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 xl:h-full xl:max-h-none">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-6 py-4 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/70 dark:text-indigo-400">
            {apenasFavoritos ? (
              <Heart className="h-5 w-5" />
            ) : (
              <FileText className="h-5 w-5" />
            )}
          </span>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              {apenasFavoritos ? "Artigos Favoritos" : "Meus Artigos"}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              {filtrados.length}{" "}
              {filtrados.length === 1
                ? "artigo disponível"
                : "artigos disponíveis"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Pesquisar título ou tema..."
              className="w-56 rounded-xl border border-slate-200 bg-slate-50/70 py-2 pl-9 pr-3 text-xs text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:bg-slate-800"
            />
          </div>
          <button
            type="button"
            onClick={onIrParaInicio}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-700 whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            <span>Novo artigo</span>
          </button>
        </div>
      </div>

      <div className="studio-scroll min-h-0 flex-1 overflow-y-auto px-6 py-4">
        {filtrados.length === 0 ? (
          <div className="py-14 text-center">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              {apenasFavoritos
                ? "Nenhum artigo marcado como favorito ainda."
                : "Nenhum artigo guardado no histórico."}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Gere um artigo no painel principal para salvá-lo automaticamente
              aqui.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {filtrados.map((artigo) => {
            const imagens = artigo.secoes.filter((s) => s.img).length;
            const dataFmt = new Date(artigo.criadoEm).toLocaleDateString(
              "pt-PT",
              {
                day: "2-digit",
                month: "short",
                year: "numeric",
              }
            );
            return (
              <div
                key={artigo.id}
                className="flex flex-col justify-between gap-4 py-4 sm:flex-row sm:items-center"
              >
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">
                    {artigo.titulo}
                  </h3>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-slate-500 dark:text-slate-400">
                    <span className="tabular-nums">
                      {artigo.totalPalavras} palavras
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">
                      {artigo.secoes.length} secções
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">{imagens} imagens</span>
                    <span aria-hidden="true">·</span>
                    <span>{artigo.idioma}</span>
                    <span aria-hidden="true">·</span>
                    <span>{dataFmt}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => onToggleFavorito(artigo.id)}
                    aria-label="Alternar favorito"
                    className={`rounded-lg border p-2 transition-colors ${
                      artigo.favorito
                        ? "border-rose-200 bg-rose-50 text-rose-600 dark:border-rose-900/60 dark:bg-rose-950/50 dark:text-rose-400"
                        : "border-slate-200 text-slate-400 hover:text-rose-600 dark:border-slate-700 dark:text-slate-400 dark:hover:text-rose-400"
                    }`}
                  >
                    <Heart
                      className={`h-4 w-4 ${
                        artigo.favorito ? "fill-current" : ""
                      }`}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => onBaixarHtml(artigo)}
                    aria-label="Baixar HTML"
                    className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onAbrirArtigo(artigo)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 dark:border-indigo-800/60 dark:bg-indigo-950/60 dark:text-indigo-300 dark:hover:bg-indigo-900/60"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span>Abrir</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onExcluirArtigo(artigo.id)}
                    aria-label="Excluir artigo"
                    className="rounded-lg border border-slate-200 p-2 text-slate-400 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 dark:border-slate-700 dark:text-slate-400 dark:hover:border-rose-900/60 dark:hover:bg-rose-950/50 dark:hover:text-rose-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
          </div>
        )}
      </div>
    </section>
  );
}

type ChartRange = "6m" | "12m" | "all";
type ChartKind = "area" | "bar";

type MonthlyWordPoint = {
  monthKey: string;
  label: string;
  fullLabel: string;
  palavras: number;
  artigos: number;
};

function getArticleWordCount(a: ArtigoSalvo): number {
  if (typeof a.totalPalavras === "number" && a.totalPalavras > 0) {
    return a.totalPalavras;
  }
  return a.secoes.reduce(
    (sum, s) => sum + (s.texto?.trim().split(/\s+/).filter(Boolean).length ?? 0),
    0
  );
}

function buildMonthlyWordSeries(
  artigos: ArtigoSalvo[],
  range: ChartRange
): MonthlyWordPoint[] {
  const buckets = new Map<string, { palavras: number; artigos: number }>();
  let earliestYm: number | null = null;
  let latestYm: number | null = null;

  for (const artigo of artigos) {
    const dt = new Date(artigo.criadoEm);
    if (Number.isNaN(dt.getTime())) continue;
    const year = dt.getFullYear();
    const month = dt.getMonth();
    const ym = year * 12 + month;
    const key = `${year}-${String(month + 1).padStart(2, "0")}`;
    const prev = buckets.get(key) ?? { palavras: 0, artigos: 0 };
    buckets.set(key, {
      palavras: prev.palavras + getArticleWordCount(artigo),
      artigos: prev.artigos + 1,
    });
    if (earliestYm === null || ym < earliestYm) earliestYm = ym;
    if (latestYm === null || ym > latestYm) latestYm = ym;
  }

  if (earliestYm === null || latestYm === null) return [];

  const now = new Date();
  const currentYm = now.getFullYear() * 12 + now.getMonth();
  const endYm = Math.max(currentYm, latestYm);
  const startYm =
    range === "6m"
      ? endYm - 5
      : range === "12m"
      ? endYm - 11
      : Math.min(earliestYm, endYm - 5);

  const points: MonthlyWordPoint[] = [];
  for (let ym = startYm; ym <= endYm; ym++) {
    const year = Math.floor(ym / 12);
    const month = ym % 12;
    const key = `${year}-${String(month + 1).padStart(2, "0")}`;
    const refDate = new Date(year, month, 1);
    const shortMonth = refDate
      .toLocaleDateString("pt-BR", { month: "short" })
      .replace(".", "");
    const label = `${shortMonth}/${String(year).slice(-2)}`;
    const fullLabel = refDate.toLocaleDateString("pt-BR", {
      month: "long",
      year: "numeric",
    });
    const data = buckets.get(key) ?? { palavras: 0, artigos: 0 };
    points.push({
      monthKey: key,
      label,
      fullLabel,
      palavras: data.palavras,
      artigos: data.artigos,
    });
  }

  return points;
}

function MonthlyWordsTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: MonthlyWordPoint }>;
}) {
  if (!active || !payload?.length || !payload[0]?.payload) return null;
  const item = payload[0].payload;
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs shadow-md dark:border-slate-700 dark:bg-slate-900">
      <p className="font-bold capitalize text-slate-900 dark:text-white">
        {item.fullLabel}
      </p>
      <div className="mt-1 space-y-0.5 tabular-nums text-slate-600 dark:text-slate-300">
        <p>
          <span className="font-mono font-semibold text-indigo-600 dark:text-indigo-400">
            {item.palavras.toLocaleString("pt-BR")}
          </span>{" "}
          palavras produzidas
        </p>
        <p>
          <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
            {item.artigos}
          </span>{" "}
          {item.artigos === 1 ? "artigo criado" : "artigos criados"}
        </p>
      </div>
    </div>
  );
}

export function StatisticsView({
  artigos,
  onAbrirArtigo,
  onIrParaInicio,
}: {
  artigos: ArtigoSalvo[];
  onAbrirArtigo: (artigo: ArtigoSalvo) => void;
  onIrParaInicio?: () => void;
}) {
  const { theme } = useTheme();
  const [range, setRange] = useState<ChartRange>("6m");
  const [chartKind, setChartKind] = useState<ChartKind>("area");

  const totalArtigos = artigos.length;
  const totalPalavras = artigos.reduce(
    (n, a) => n + getArticleWordCount(a),
    0
  );
  const totalImagens = artigos.reduce(
    (n, a) => n + a.secoes.filter((s) => s.img).length,
    0
  );
  const totalFavoritos = artigos.filter((a) => a.favorito).length;

  const monthlySeries = useMemo(
    () => buildMonthlyWordSeries(artigos, range),
    [artigos, range]
  );

  const activeMonths = monthlySeries.filter((m) => m.palavras > 0);
  const peakWords = monthlySeries.reduce(
    (max, m) => (m.palavras > max ? m.palavras : max),
    0
  );
  const avgWordsPerActiveMonth =
    activeMonths.length > 0
      ? Math.round(
          activeMonths.reduce((s, m) => s + m.palavras, 0) /
            activeMonths.length
        )
      : 0;

  const isDark = theme === "dark";
  const gridColor = isDark ? "#1E293B" : "#E2E8F0";
  const axisTextColor = isDark ? "#94A3B8" : "#64748B";
  const strokeColor = isDark ? "#818CF8" : "#4F46E5";
  const barColor = isDark ? "#6366F1" : "#4F46E5";

  return (
    <section className="flex max-h-[78vh] flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 xl:h-full xl:max-h-none">
      <div className="flex shrink-0 items-center gap-2.5 border-b border-slate-100 px-6 py-4 dark:border-slate-800">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/70 dark:text-indigo-400">
          <BarChart3 className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Estatísticas de Produção
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Resumo real dos artigos gerados e guardados na sua biblioteca
          </p>
        </div>
      </div>

      <div className="studio-scroll min-h-0 flex-1 space-y-6 overflow-y-auto p-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800 dark:bg-slate-950/40">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Artigos criados
            </p>
            <p className="mt-1.5 text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
              {totalArtigos}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800 dark:bg-slate-950/40">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Palavras geradas
            </p>
            <p className="mt-1.5 text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
              {totalPalavras.toLocaleString("pt-BR")}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800 dark:bg-slate-950/40">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Imagens geradas
            </p>
            <p className="mt-1.5 text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
              {totalImagens}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800 dark:bg-slate-950/40">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Favoritos
            </p>
            <p className="mt-1.5 text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
              {totalFavoritos}
            </p>
          </div>
        </div>

        {/* Gráfico mensal de contagem de palavras */}
        <div className="rounded-xl border border-slate-200 p-5 dark:border-slate-800 dark:bg-slate-950/40">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Volume de Palavras por Mês
                </h3>
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                {artigos.length > 0 ? (
                  <>
                    Média ativa: {avgWordsPerActiveMonth.toLocaleString("pt-BR")}{" "}
                    palavras/mês · Pico mensal:{" "}
                    {peakWords.toLocaleString("pt-BR")} palavras
                  </>
                ) : (
                  "Contagem total de palavras produzidas ao longo do tempo"
                )}
              </p>
            </div>

            {artigos.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <div
                  role="group"
                  aria-label="Período do gráfico"
                  className="inline-flex items-center gap-0.5 rounded-lg border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-800/80"
                >
                  {(
                    [
                      { id: "6m", label: "6 meses" },
                      { id: "12m", label: "12 meses" },
                      { id: "all", label: "Tudo" },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setRange(opt.id)}
                      className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 ${
                        range === opt.id
                          ? "bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white"
                          : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                <div
                  role="group"
                  aria-label="Tipo de visualização"
                  className="inline-flex items-center gap-0.5 rounded-lg border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-800/80"
                >
                  {(
                    [
                      { id: "area", label: "Área" },
                      { id: "bar", label: "Barras" },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setChartKind(opt.id)}
                      className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 ${
                        chartKind === opt.id
                          ? "bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white"
                          : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {monthlySeries.length === 0 ? (
            <div className="flex h-[220px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 p-6 text-center dark:border-slate-800">
              <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Gere seu primeiro artigo para visualizar o volume de palavras
                produzido por mês.
              </p>
              {onIrParaInicio && (
                <button
                  type="button"
                  onClick={onIrParaInicio}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-700 whitespace-nowrap"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Criar primeiro artigo</span>
                </button>
              )}
            </div>
          ) : (
            <div className="h-[260px] w-full min-w-0">
              <ResponsiveContainer width="100%" height={260} minWidth={0}>
                {chartKind === "area" ? (
                  <AreaChart
                    data={monthlySeries}
                    margin={{ top: 10, right: 12, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient
                        id="wordsAreaGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor={strokeColor}
                          stopOpacity={isDark ? 0.36 : 0.24}
                        />
                        <stop
                          offset="95%"
                          stopColor={strokeColor}
                          stopOpacity={0.02}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke={gridColor}
                    />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: axisTextColor, fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      dy={6}
                    />
                    <YAxis
                      tick={{ fill: axisTextColor, fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      width={54}
                      tickFormatter={(v: number) =>
                        v >= 1000
                          ? `${(v / 1000).toLocaleString("pt-BR", {
                              maximumFractionDigits: 1,
                            })}k`
                          : String(v)
                      }
                    />
                    <Tooltip content={<MonthlyWordsTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="palavras"
                      stroke={strokeColor}
                      strokeWidth={2.5}
                      fill="url(#wordsAreaGradient)"
                      activeDot={{
                        r: 5,
                        fill: strokeColor,
                        stroke: isDark ? "#0F172A" : "#FFFFFF",
                        strokeWidth: 2,
                      }}
                    />
                  </AreaChart>
                ) : (
                  <BarChart
                    data={monthlySeries}
                    margin={{ top: 10, right: 12, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke={gridColor}
                    />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: axisTextColor, fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      dy={6}
                    />
                    <YAxis
                      tick={{ fill: axisTextColor, fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      width={54}
                      tickFormatter={(v: number) =>
                        v >= 1000
                          ? `${(v / 1000).toLocaleString("pt-BR", {
                              maximumFractionDigits: 1,
                            })}k`
                          : String(v)
                      }
                    />
                    <Tooltip
                      cursor={{
                        fill: isDark
                          ? "rgba(148, 163, 184, 0.08)"
                          : "rgba(99, 102, 241, 0.06)",
                      }}
                      content={<MonthlyWordsTooltip />}
                    />
                    <Bar
                      dataKey="palavras"
                      fill={barColor}
                      radius={[6, 6, 0, 0]}
                      maxBarSize={44}
                    />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          )}
        </div>

      <div>
        <h3 className="mb-3 text-sm font-bold text-slate-900 dark:text-slate-100">
          Histórico recente
        </h3>
        {artigos.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
            As métricas aparecerão aqui assim que o primeiro artigo for gerado.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-800/70 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Título</th>
                  <th className="px-4 py-2.5 font-semibold">Idioma</th>
                  <th className="px-4 py-2.5 text-right font-semibold">
                    Secções
                  </th>
                  <th className="px-4 py-2.5 text-right font-semibold">
                    Palavras
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {artigos.map((a) => (
                  <tr
                    key={a.id}
                    onClick={() => onAbrirArtigo(a)}
                    className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  >
                    <td className="px-4 py-2.5 font-semibold text-indigo-700 dark:text-indigo-400">
                      {a.titulo}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">
                      {a.idioma}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                      {a.secoes.length}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                      {a.totalPalavras}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        </div>
      </div>
    </section>
  );
}

export function SettingsView({
  config,
  onSaveConfig,
  onLimparHistorico,
  totalArtigos,
}: {
  config: ConfiguracoesPadrao;
  onSaveConfig: (nova: ConfiguracoesPadrao) => void;
  onLimparHistorico: () => void;
  totalArtigos: number;
}) {
  const { theme, setTheme } = useTheme();
  const [draft, setDraft] = useState<ConfiguracoesPadrao>(config);
  const [salvo, setSalvo] = useState(false);

  function salvar() {
    onSaveConfig(draft);
    setSalvo(true);
    setTimeout(() => setSalvo(false), 2000);
  }

  return (
    <section className="flex max-h-[78vh] max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 xl:h-full xl:max-h-none">
      <div className="flex shrink-0 items-center gap-2.5 border-b border-slate-100 px-6 py-4 dark:border-slate-800">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/70 dark:text-indigo-400">
          <Settings className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Configurações Padrão
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Defina a aparência e as preferências iniciais para novos artigos
          </p>
        </div>
      </div>

      <div className="studio-scroll min-h-0 flex-1 space-y-6 overflow-y-auto p-6">
        {/* Aparência / Tema */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-800 dark:bg-slate-950/40">
        <div>
          <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
            Aparência da interface
          </p>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Alterne entre o tema claro e o modo escuro global
          </p>
        </div>
        <div className="inline-flex items-center gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
          <button
            type="button"
            onClick={() => setTheme("light")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              theme === "light"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
            }`}
          >
            <Sun className="h-3.5 w-3.5" />
            <span>Claro</span>
          </button>
          <button
            type="button"
            onClick={() => setTheme("dark")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              theme === "dark"
                ? "bg-indigo-600 text-white shadow-xs"
                : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
            }`}
          >
            <Moon className="h-3.5 w-3.5" />
            <span>Escuro</span>
          </button>
        </div>
      </div>

      <PWAInstallButton variant="card" />

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
            Tom padrão
          </label>
          <select
            value={draft.tomPadrao}
            onChange={(e) => setDraft({ ...draft, tomPadrao: e.target.value })}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            {TONS_TEXTO.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
            Idioma padrão
          </label>
          <select
            value={draft.idiomaPadrao}
            onChange={(e) =>
              setDraft({ ...draft, idiomaPadrao: e.target.value })
            }
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            {IDIOMAS.map((lang) => (
              <option key={lang.id} value={lang.id}>
                {lang.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
            Extensão padrão
          </label>
          <select
            value={draft.faixaPalavrasPadrao}
            onChange={(e) =>
              setDraft({
                ...draft,
                faixaPalavrasPadrao: e.target.value as FaixaPalavrasId,
              })
            }
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            {FAIXAS_PALAVRAS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-slate-200 px-3.5 py-2.5 dark:border-slate-700 dark:bg-slate-800/50">
          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
            Incluir imagens por padrão
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={draft.incluirImagensPadrao}
            onClick={() =>
              setDraft({
                ...draft,
                incluirImagensPadrao: !draft.incluirImagensPadrao,
              })
            }
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              draft.incluirImagensPadrao
                ? "bg-indigo-600"
                : "bg-slate-300 dark:bg-slate-700"
            }`}
          >
            <span
              className={`inline-block h-4.5 w-4.5 rounded-full bg-white transition-transform ${
                draft.incluirImagensPadrao ? "translate-x-5.5" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-slate-200 px-3.5 py-2.5 dark:border-slate-700 dark:bg-slate-800/50">
          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
            Escrever em primeira pessoa por padrão
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={Boolean(draft.primeiraPessoaPadrao)}
            onClick={() =>
              setDraft({
                ...draft,
                primeiraPessoaPadrao: !draft.primeiraPessoaPadrao,
              })
            }
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              draft.primeiraPessoaPadrao
                ? "bg-indigo-600"
                : "bg-slate-300 dark:bg-slate-700"
            }`}
          >
            <span
              className={`inline-block h-4.5 w-4.5 rounded-full bg-white transition-transform ${
                draft.primeiraPessoaPadrao ? "translate-x-5.5" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
            Pesquisa web padrão
          </label>
          <select
            value={draft.pesquisaWebPadrao ?? "auto"}
            onChange={(e) =>
              setDraft({
                ...draft,
                pesquisaWebPadrao: e.target.value as ModoPesquisa,
              })
            }
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            <option value="auto">Automática (informativo/notícia)</option>
            <option value="sempre">Sempre pesquisar</option>
            <option value="desativada">Desativada</option>
          </select>
          </div>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-white/95 px-6 py-4 dark:border-slate-800 dark:bg-slate-900/95">
        <button
          type="button"
          onClick={onLimparHistorico}
          disabled={totalArtigos === 0}
          className="rounded-xl border border-rose-200 px-3.5 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-40 dark:border-rose-900/60 dark:text-rose-400 dark:hover:bg-rose-950/50"
        >
          Limpar histórico ({totalArtigos})
        </button>

        <button
          type="button"
          onClick={salvar}
          className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
        >
          {salvo && <Check className="h-3.5 w-3.5" />}
          <span>{salvo ? "Preferências guardadas" : "Guardar preferências"}</span>
        </button>
      </div>
    </section>
  );
}
