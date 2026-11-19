"use client";

import { useState, KeyboardEvent } from "react";
import {
  Settings,
  Tag,
  AlignLeft,
  Smile,
  Globe,
  Hash,
  Image as ImageIcon,
  Wand2,
  ChevronRight,
  X,
  Loader2,
  Square,
  Asterisk,
  UserCheck,
  Search,
} from "lucide-react";
import {
  FAIXAS_PALAVRAS,
  TONS_TEXTO,
  IDIOMAS,
  type FaixaPalavrasId,
  type ModoPesquisa,
} from "@/lib/types";

type ArticleConfigFormProps = {
  tema: string;
  onChangeTema: (val: string) => void;
  palavrasChave: string[];
  onChangePalavrasChave: (tags: string[]) => void;
  descricao: string;
  onChangeDescricao: (val: string) => void;
  tom: string;
  onChangeTom: (val: string) => void;
  idioma: string;
  onChangeIdioma: (val: string) => void;
  faixaPalavras: FaixaPalavrasId;
  onChangeFaixaPalavras: (val: FaixaPalavrasId) => void;
  incluirImagens: boolean;
  onChangeIncluirImagens: (val: boolean) => void;
  primeiraPessoa: boolean;
  onChangePrimeiraPessoa: (val: boolean) => void;
  pesquisaWeb: ModoPesquisa;
  onChangePesquisaWeb: (val: ModoPesquisa) => void;
  ocupado: boolean;
  onGerar: () => void;
  onCancelar: () => void;
};

export default function ArticleConfigForm({
  tema,
  onChangeTema,
  palavrasChave,
  onChangePalavrasChave,
  descricao,
  onChangeDescricao,
  tom,
  onChangeTom,
  idioma,
  onChangeIdioma,
  faixaPalavras,
  onChangeFaixaPalavras,
  incluirImagens,
  onChangeIncluirImagens,
  primeiraPessoa,
  onChangePrimeiraPessoa,
  pesquisaWeb,
  onChangePesquisaWeb,
  ocupado,
  onGerar,
  onCancelar,
}: ArticleConfigFormProps) {
  const [novaTag, setNovaTag] = useState("");

  function adicionarTag(raw: string) {
    const limpa = raw.trim().replace(/,$/, "");
    if (!limpa) return;
    if (
      palavrasChave.some((t) => t.toLowerCase() === limpa.toLowerCase()) ||
      palavrasChave.length >= 10
    ) {
      setNovaTag("");
      return;
    }
    onChangePalavrasChave([...palavrasChave, limpa]);
    setNovaTag("");
  }

  function handleTagKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      adicionarTag(novaTag);
    } else if (e.key === "Backspace" && !novaTag && palavrasChave.length > 0) {
      onChangePalavrasChave(palavrasChave.slice(0, -1));
    }
  }

  function removerTag(idx: number) {
    onChangePalavrasChave(palavrasChave.filter((_, i) => i !== idx));
  }

  return (
    <section
      aria-label="Configuração do artigo"
      className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="mb-5 flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/70 dark:text-indigo-400">
          <Settings className="h-[18px] w-[18px]" />
        </span>
        <h2 className="text-[17px] font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Configurar seu artigo
        </h2>
      </div>

      <div className="space-y-4">
        {/* Tema ou Título Principal */}
        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <label
              htmlFor="campo-tema"
              className="flex items-center gap-1 text-[13px] font-semibold text-slate-800 dark:text-slate-200"
            >
              <Asterisk className="h-3 w-3 text-rose-500" />
              <span>Tema ou Título Principal</span>
            </label>
            <span className="text-xs font-medium text-slate-400 dark:text-slate-500 tabular-nums">
              {tema.length}/100
            </span>
          </div>
          <input
            id="campo-tema"
            type="text"
            maxLength={100}
            value={tema}
            onChange={(e) => onChangeTema(e.target.value)}
            disabled={ocupado}
            placeholder="Ex.: Como criar aplicativos Android no Google"
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/15 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:bg-slate-800"
          />
        </div>

        {/* Palavras-chave */}
        <div>
          <label
            htmlFor="campo-tags"
            className="mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-slate-800 dark:text-slate-200"
          >
            <Tag className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>Palavras-chave</span>
            <span className="font-normal text-slate-400 dark:text-slate-500">
              (opcional)
            </span>
          </label>
          <div className="flex min-h-[44px] flex-wrap items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50/50 px-2.5 py-1.5 focus-within:border-indigo-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-indigo-500/15 dark:border-slate-700 dark:bg-slate-800/70 dark:focus-within:bg-slate-800">
            {palavrasChave.map((tag, idx) => (
              <span
                key={`${tag}-${idx}`}
                className="inline-flex items-center gap-1 rounded-lg border border-indigo-100 bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-800 dark:border-indigo-800/60 dark:bg-indigo-950/70 dark:text-indigo-200"
              >
                <span>{tag}</span>
                <button
                  type="button"
                  disabled={ocupado}
                  onClick={() => removerTag(idx)}
                  aria-label={`Remover palavra-chave ${tag}`}
                  className="rounded p-0.5 text-indigo-500 hover:bg-indigo-100 hover:text-indigo-800 dark:text-indigo-300 dark:hover:bg-indigo-900 dark:hover:text-white disabled:opacity-50"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            <input
              id="campo-tags"
              type="text"
              value={novaTag}
              disabled={ocupado}
              onChange={(e) => setNovaTag(e.target.value)}
              onKeyDown={handleTagKeyDown}
              onBlur={() => {
                if (novaTag.trim()) adicionarTag(novaTag);
              }}
              placeholder={
                palavrasChave.length === 0
                  ? "Digite e pressione Enter..."
                  : "Adicione mais..."
              }
              className="min-w-[110px] flex-1 bg-transparent py-1 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none dark:text-slate-100 dark:placeholder:text-slate-500 disabled:opacity-60"
            />
          </div>
        </div>

        {/* Descrição */}
        <div>
          <label
            htmlFor="campo-descricao"
            className="mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-slate-800 dark:text-slate-200"
          >
            <AlignLeft className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>Descrição</span>
            <span className="font-normal text-slate-400 dark:text-slate-500">
              (opcional)
            </span>
          </label>
          <div className="relative">
            <textarea
              id="campo-descricao"
              rows={3}
              maxLength={300}
              value={descricao}
              onChange={(e) => onChangeDescricao(e.target.value)}
              disabled={ocupado}
              placeholder="Guia completo e atualizado para o leitor, destacando pontos-chave e público-alvo..."
              className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 pb-7 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/15 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:bg-slate-800"
            />
            <span className="pointer-events-none absolute bottom-2.5 right-3 text-[11px] font-medium text-slate-400 dark:text-slate-500 tabular-nums">
              {descricao.length}/300
            </span>
          </div>
        </div>

        {/* Tom do texto */}
        <div>
          <label
            htmlFor="campo-tom"
            className="mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-slate-800 dark:text-slate-200"
          >
            <Smile className="h-3.5 w-3.5 text-amber-500" />
            <span>Tom do texto</span>
          </label>
          <select
            id="campo-tom"
            value={tom}
            disabled={ocupado}
            onChange={(e) => onChangeTom(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-medium text-slate-800 transition-colors focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/15 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-100 dark:focus:bg-slate-800"
          >
            {TONS_TEXTO.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        {/* Idioma */}
        <div>
          <label
            htmlFor="campo-idioma"
            className="mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-slate-800 dark:text-slate-200"
          >
            <Globe className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Idioma</span>
          </label>
          <select
            id="campo-idioma"
            value={idioma}
            disabled={ocupado}
            onChange={(e) => onChangeIdioma(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-medium text-slate-800 transition-colors focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/15 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-100 dark:focus:bg-slate-800"
          >
            {IDIOMAS.map((lang) => (
              <option key={lang.id} value={lang.id}>
                {lang.label}
              </option>
            ))}
          </select>
        </div>

        {/* Número de palavras */}
        <div>
          <label
            htmlFor="campo-palavras"
            className="mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-slate-800 dark:text-slate-200"
          >
            <Hash className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
            <span>Número de palavras</span>
            <span className="font-normal text-slate-400 dark:text-slate-500">
              (aprox.)
            </span>
          </label>
          <select
            id="campo-palavras"
            value={faixaPalavras}
            disabled={ocupado}
            onChange={(e) =>
              onChangeFaixaPalavras(e.target.value as FaixaPalavrasId)
            }
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-medium text-slate-800 transition-colors focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/15 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-100 dark:focus:bg-slate-800"
          >
            {FAIXAS_PALAVRAS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </div>

        {/* Incluir imagens toggle */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2 text-[13px] font-semibold text-slate-800 dark:text-slate-200">
            <ImageIcon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            <span id="label-incluir-imagens">Incluir imagens</span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={incluirImagens}
            aria-labelledby="label-incluir-imagens"
            disabled={ocupado}
            onClick={() => onChangeIncluirImagens(!incluirImagens)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-60 ${
              incluirImagens ? "bg-indigo-600" : "bg-slate-300 dark:bg-slate-700"
            }`}
          >
            <span
              className={`inline-block h-4.5 w-4.5 rounded-full bg-white shadow-xs transition-transform duration-150 ${
                incluirImagens ? "translate-x-5.5" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        {/* Primeira pessoa toggle */}
        <div className="flex items-center justify-between pt-0.5">
          <div className="flex items-center gap-2 text-[13px] font-semibold text-slate-800 dark:text-slate-200">
            <UserCheck className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            <span id="label-primeira-pessoa">Escrever em primeira pessoa</span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={primeiraPessoa}
            aria-labelledby="label-primeira-pessoa"
            disabled={ocupado}
            onClick={() => onChangePrimeiraPessoa(!primeiraPessoa)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-60 ${
              primeiraPessoa ? "bg-indigo-600" : "bg-slate-300 dark:bg-slate-700"
            }`}
          >
            <span
              className={`inline-block h-4.5 w-4.5 rounded-full bg-white shadow-xs transition-transform duration-150 ${
                primeiraPessoa ? "translate-x-5.5" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        {/* Pesquisa na web */}
        <div className="pt-0.5">
          <label
            htmlFor="campo-pesquisa-web"
            className="mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-slate-800 dark:text-slate-200"
          >
            <Search className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>Pesquisa na web</span>
          </label>
          <select
            id="campo-pesquisa-web"
            value={pesquisaWeb}
            disabled={ocupado}
            onChange={(e) =>
              onChangePesquisaWeb(e.target.value as ModoPesquisa)
            }
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-medium text-slate-800 transition-colors focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/15 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-100 dark:focus:bg-slate-800"
          >
            <option value="auto">
              Automática (se informativo ou notícia)
            </option>
            <option value="sempre">Sempre pesquisar fontes atuais</option>
            <option value="desativada">Desativada</option>
          </select>
        </div>

        {/* Submit / Cancel CTA */}
        <div className="pt-2">
          {ocupado ? (
            <div className="flex gap-2">
              <button
                type="button"
                disabled
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#6344F5] to-[#2563EB] px-4 py-3 text-sm font-semibold text-white opacity-85"
              >
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>A gerar artigo…</span>
              </button>
              <button
                type="button"
                onClick={onCancelar}
                title="Interromper geração"
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-xs font-semibold text-rose-700 hover:bg-rose-100 dark:border-rose-900/60 dark:bg-rose-950/60 dark:text-rose-300 dark:hover:bg-rose-950 whitespace-nowrap"
              >
                <Square className="h-3.5 w-3.5 fill-current" />
                <span>Parar</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onGerar}
              disabled={!tema.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#6344F5] via-[#4F46E5] to-[#2563EB] px-5 py-3 text-sm font-semibold text-white shadow-md shadow-indigo-600/20 transition-all duration-150 hover:brightness-105 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            >
              <Wand2 className="h-4 w-4 shrink-0" />
              <span>Gerar Artigo</span>
              <ChevronRight className="h-4 w-4 shrink-0" />
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
