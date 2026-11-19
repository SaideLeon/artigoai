"use client";

import { useState } from "react";
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
} from "lucide-react";
import {
  FAIXAS_PALAVRAS,
  TONS_TEXTO,
  IDIOMAS,
  type ArtigoSalvo,
  type ConfiguracoesPadrao,
  type FaixaPalavrasId,
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
    <section className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            {apenasFavoritos ? (
              <Heart className="h-5 w-5" />
            ) : (
              <FileText className="h-5 w-5" />
            )}
          </span>
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {apenasFavoritos ? "Artigos Favoritos" : "Meus Artigos"}
            </h2>
            <p className="text-xs text-slate-500 tabular-nums">
              {filtrados.length}{" "}
              {filtrados.length === 1
                ? "artigo disponível"
                : "artigos disponíveis"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Pesquisar título ou tema..."
              className="w-56 rounded-xl border border-slate-200 bg-slate-50/70 py-2 pl-9 pr-3 text-xs text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none"
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

      {filtrados.length === 0 ? (
        <div className="py-14 text-center">
          <p className="text-sm font-semibold text-slate-700">
            {apenasFavoritos
              ? "Nenhum artigo marcado como favorito ainda."
              : "Nenhum artigo guardado no histórico."}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Gere um artigo no painel principal para salvá-lo automaticamente
            aqui.
          </p>
        </div>
      ) : (
        <div className="mt-4 divide-y divide-slate-100">
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
                  <h3 className="truncate text-sm font-bold text-slate-900">
                    {artigo.titulo}
                  </h3>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
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
                        ? "border-rose-200 bg-rose-50 text-rose-600"
                        : "border-slate-200 text-slate-400 hover:text-rose-600"
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
                    className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onAbrirArtigo(artigo)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span>Abrir</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onExcluirArtigo(artigo.id)}
                    aria-label="Excluir artigo"
                    className="rounded-lg border border-slate-200 p-2 text-slate-400 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export function StatisticsView({
  artigos,
  onAbrirArtigo,
}: {
  artigos: ArtigoSalvo[];
  onAbrirArtigo: (artigo: ArtigoSalvo) => void;
}) {
  const totalArtigos = artigos.length;
  const totalPalavras = artigos.reduce((n, a) => n + a.totalPalavras, 0);
  const totalImagens = artigos.reduce(
    (n, a) => n + a.secoes.filter((s) => s.img).length,
    0
  );
  const totalFavoritos = artigos.filter((a) => a.favorito).length;

  return (
    <section className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs space-y-6">
      <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
          <BarChart3 className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Estatísticas de Produção
          </h2>
          <p className="text-xs text-slate-500">
            Resumo real dos artigos gerados e guardados neste navegador
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-medium text-slate-500">Artigos criados</p>
          <p className="mt-1.5 text-2xl font-bold text-slate-900 tabular-nums">
            {totalArtigos}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-medium text-slate-500">
            Palavras geradas
          </p>
          <p className="mt-1.5 text-2xl font-bold text-slate-900 tabular-nums">
            {totalPalavras.toLocaleString("pt-PT")}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-medium text-slate-500">
            Imagens geradas
          </p>
          <p className="mt-1.5 text-2xl font-bold text-slate-900 tabular-nums">
            {totalImagens}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-medium text-slate-500">Favoritos</p>
          <p className="mt-1.5 text-2xl font-bold text-slate-900 tabular-nums">
            {totalFavoritos}
          </p>
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-bold text-slate-900">
          Histórico recente
        </h3>
        {artigos.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500">
            As métricas aparecerão aqui assim que o primeiro artigo for gerado.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
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
              <tbody className="divide-y divide-slate-100">
                {artigos.map((a) => (
                  <tr
                    key={a.id}
                    onClick={() => onAbrirArtigo(a)}
                    className="cursor-pointer hover:bg-slate-50"
                  >
                    <td className="px-4 py-2.5 font-semibold text-indigo-700">
                      {a.titulo}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{a.idioma}</td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-700">
                      {a.secoes.length}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums font-semibold text-slate-900">
                      {a.totalPalavras}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
  const [draft, setDraft] = useState<ConfiguracoesPadrao>(config);
  const [salvo, setSalvo] = useState(false);

  function salvar() {
    onSaveConfig(draft);
    setSalvo(true);
    setTimeout(() => setSalvo(false), 2000);
  }

  return (
    <section className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs space-y-6 max-w-2xl">
      <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
          <Settings className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Configurações Padrão
          </h2>
          <p className="text-xs text-slate-500">
            Defina as preferências iniciais para novos artigos
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-700">
            Tom padrão
          </label>
          <select
            value={draft.tomPadrao}
            onChange={(e) => setDraft({ ...draft, tomPadrao: e.target.value })}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 focus:border-indigo-500 focus:bg-white focus:outline-none"
          >
            {TONS_TEXTO.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-700">
            Idioma padrão
          </label>
          <select
            value={draft.idiomaPadrao}
            onChange={(e) =>
              setDraft({ ...draft, idiomaPadrao: e.target.value })
            }
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 focus:border-indigo-500 focus:bg-white focus:outline-none"
          >
            {IDIOMAS.map((lang) => (
              <option key={lang.id} value={lang.id}>
                {lang.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-700">
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
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 focus:border-indigo-500 focus:bg-white focus:outline-none"
          >
            {FAIXAS_PALAVRAS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-slate-200 px-3.5 py-2.5">
          <span className="text-xs font-semibold text-slate-800">
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
              draft.incluirImagensPadrao ? "bg-indigo-600" : "bg-slate-300"
            }`}
          >
            <span
              className={`inline-block h-4.5 w-4.5 rounded-full bg-white transition-transform ${
                draft.incluirImagensPadrao ? "translate-x-5.5" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-slate-200 px-3.5 py-2.5 sm:col-span-2">
          <span className="text-xs font-semibold text-slate-800">
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
              draft.primeiraPessoaPadrao ? "bg-indigo-600" : "bg-slate-300"
            }`}
          >
            <span
              className={`inline-block h-4.5 w-4.5 rounded-full bg-white transition-transform ${
                draft.primeiraPessoaPadrao ? "translate-x-5.5" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <button
          type="button"
          onClick={onLimparHistorico}
          disabled={totalArtigos === 0}
          className="rounded-xl border border-rose-200 px-3.5 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-40"
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
