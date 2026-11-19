"use client";

import { X, Crown, Check, HelpCircle, Info } from "lucide-react";
import { motion } from "motion/react";

type InfoModalProps = {
  tipo: "upgrade" | "ajuda" | "sobre" | null;
  onClose: () => void;
};

export default function InfoModal({ tipo, onClose }: InfoModalProps) {
  if (!tipo) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.16 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            {tipo === "upgrade" && (
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
                <Crown className="h-5 w-5" />
              </span>
            )}
            {tipo === "ajuda" && (
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
                <HelpCircle className="h-5 w-5" />
              </span>
            )}
            {tipo === "sobre" && (
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                <Info className="h-5 w-5" />
              </span>
            )}
            <h2 className="text-lg font-bold text-slate-900">
              {tipo === "upgrade"
                ? "Plano Pro — Estúdio Completo"
                : tipo === "ajuda"
                ? "Como usar o Gerador de Artigos"
                : "Sobre o Gerador de Artigos"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar janela"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 text-sm leading-relaxed text-slate-600">
          {tipo === "upgrade" && (
            <div className="space-y-4">
              <p>
                Desbloqueie fluxos avançados de produção editorial com controle
                completo de estrutura, tom e exportação.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-xs font-semibold text-slate-500">
                    Plano Atual
                  </p>
                  <p className="mt-1 text-base font-bold text-slate-900">
                    Essencial
                  </p>
                  <ul className="mt-3 space-y-2 text-xs text-slate-600">
                    <li className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                      Até 3.200 palavras por artigo
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                      Ilustração automática por secção
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                      Exportação em HTML & Texto
                    </li>
                  </ul>
                </div>
                <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-4">
                  <p className="text-xs font-semibold text-indigo-600">
                    Para equipas editoriais
                  </p>
                  <p className="mt-1 text-base font-bold text-slate-900">
                    Plano Pro
                  </p>
                  <ul className="mt-3 space-y-2 text-xs text-slate-700">
                    <li className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-indigo-600" />
                      Modelos dedicados de alta velocidade
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-indigo-600" />
                      Geração em lote e perfis de marca
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-indigo-600" />
                      Auditoria SEO multi-idiomas
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {tipo === "ajuda" && (
            <ol className="space-y-3 list-decimal pl-5">
              <li>
                <strong className="text-slate-800">Defina o tema:</strong>{" "}
                Escreva o assunto principal e, se quiser, adicione palavras-chave
                pressionando Enter ou vírgula.
              </li>
              <li>
                <strong className="text-slate-800">
                  Personalize tom, idioma e extensão:
                </strong>{" "}
                Escolha entre artigos curtos (800–1.200 palavras) ou guias
                longos (2.000+ palavras) com imagens por secção.
              </li>
              <li>
                <strong className="text-slate-800">
                  Revise, edite e analise o SEO:
                </strong>{" "}
                Alterne entre os separadores Prévia, Editor e SEO a qualquer
                momento antes de copiar ou descarregar em HTML.
              </li>
            </ol>
          )}

          {tipo === "sobre" && (
            <div className="space-y-3">
              <p>
                O <strong>Gerador de Artigos</strong> cria esboços estruturados,
                redige secção por secção mantendo a coerência do texto anterior e
                gera ilustrações editoriais para cada capítulo.
              </p>
              <p className="text-xs text-slate-500">
                Os artigos guardados ficam disponíveis localmente no seu
                navegador nas secções Meus Artigos, Favoritos e Estatísticas.
              </p>
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
          >
            Entendido
          </button>
        </div>
      </motion.div>
    </div>
  );
}
