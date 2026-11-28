"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  BookOpen,
  Check,
  Clapperboard,
  Copy,
  Download,
  FileAudio,
  GraduationCap,
  Layers,
  Loader2,
  Mic,
  MonitorPlay,
  Play,
  RefreshCw,
  Sparkles,
  Square,
  Trash2,
  Video,
  Volume2,
} from "lucide-react";
import {
  estimateSpeechSeconds,
  formatDurationMmSs,
  GEMINI_TTS_MODELS,
  GEMINI_TTS_VOICES,
  OFFICIAL_COURSE_MODULES,
  TTS_STYLE_PRESETS,
  YOUTUBE_LEAD_PRESETS,
  type GeminiTtsModelId,
  type GeminiTtsVoiceName,
  type GeneratedYoutubeScript,
  type LeadGoalPreset,
  type ScriptCreationMode,
  type VideoDurationPreset,
} from "@/lib/admin-scripts-shared";
import { IDIOMAS } from "@/lib/types";

const LOCAL_STORAGE_KEY = "artigen_admin_youtube_scripts_v1";

type WorkspaceSubTab = "tts" | "cenas" | "youtube";

type GeneratedAudioClip = {
  dataUrl: string;
  voiceName: GeminiTtsVoiceName;
  model: GeminiTtsModelId;
  durationApproxSeconds: number;
  chunksCount: number;
  filename: string;
};

function base64WavToObjectUrl(base64: string): string {
  const byteChars = atob(base64);
  const byteNumbers = new Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    byteNumbers[i] = byteChars.charCodeAt(i);
  }
  const blob = new Blob([new Uint8Array(byteNumbers)], { type: "audio/wav" });
  return URL.createObjectURL(blob);
}

function slugifyFilename(value: string): string {
  return (
    value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "roteiro-artigen"
  );
}

export default function AdminScriptsWorkspace() {
  // Generator Form State
  const [modo, setModo] = useState<ScriptCreationMode>("curso_modulo");
  const [numeroModulo, setNumeroModulo] = useState<number>(1);
  const [tituloPersonalizado, setTituloPersonalizado] = useState("");
  const [temaLeads, setTemaLeads] = useState(YOUTUBE_LEAD_PRESETS[0].tema);
  const [objetivoConversao, setObjetivoConversao] =
    useState<LeadGoalPreset>("teste_gratis_studio");
  const [duracao, setDuracao] = useState<VideoDurationPreset>("completo_8_12m");
  const [idioma, setIdioma] = useState<string>("Português (Brasil)");
  const [tomLocucao, setTomLocucao] = useState(
    "Didático, claro, objetivo e orientado à demonstração na tela"
  );
  const [linkDestino, setLinkDestino] = useState(
    "https://criador.artificializar.site"
  );
  const [notasAdmin, setNotasAdmin] = useState("");

  // Generation State
  const [scripts, setScripts] = useState<GeneratedYoutubeScript[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [subTab, setSubTab] = useState<WorkspaceSubTab>("tts");
  const [gerando, setGerando] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const batchAbortRef = useRef(false);
  const [erro, setErro] = useState("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Google TTS Native Audio State
  const [ttsVoice, setTtsVoice] = useState<GeminiTtsVoiceName>("Kore");
  const [ttsModel, setTtsModel] = useState<GeminiTtsModelId>(
    "gemini-3.8-flash-lite-tts"
  );
  const [ttsStyle, setTtsStyle] = useState<string>(TTS_STYLE_PRESETS[0]);
  const [ttsLoadingKey, setTtsLoadingKey] = useState<string | null>(null);
  const [ttsErro, setTtsErro] = useState("");
  const [audioClips, setAudioClips] = useState<
    Record<string, GeneratedAudioClip>
  >({});

  const [hydrated, setHydrated] = useState(false);

  // Load persisted scripts from admin localStorage
  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (!active) return;
      try {
        const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as GeneratedYoutubeScript[];
          if (Array.isArray(parsed) && parsed.length > 0) {
            setScripts(parsed);
            setSelectedId(parsed[0].id);
          }
        }
      } catch {
        // ignora erro de parse local
      } finally {
        if (active) setHydrated(true);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(scripts.slice(0, 30)));
    } catch {
      // ignora quota excedida no localStorage
    }
  }, [hydrated, scripts]);

  const activeScript =
    scripts.find((s) => s.id === selectedId) ?? scripts[0] ?? null;

  function handleCopy(key: string, value: string) {
    if (!value) return;
    navigator.clipboard
      .writeText(value)
      .then(() => {
        setCopiedKey(key);
        setTimeout(() => {
          setCopiedKey((curr) => (curr === key ? null : curr));
        }, 2000);
      })
      .catch(() => {});
  }

  function updateActiveNarracao(novoTexto: string) {
    if (!activeScript) return;
    setScripts((prev) =>
      prev.map((item) =>
        item.id === activeScript.id
          ? { ...item, textoNarracaoPuro: novoTexto }
          : item
      )
    );
  }

  function deleteScript(id: string) {
    setScripts((prev) => {
      const next = prev.filter((item) => item.id !== id);
      if (selectedId === id) {
        setSelectedId(next[0]?.id ?? null);
      }
      return next;
    });
  }

  async function requestScriptGeneration(payload: Record<string, unknown>) {
    const res = await fetch("/api/admin/scripts/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await res.json()) as {
      ok?: boolean;
      script?: GeneratedYoutubeScript;
      erro?: string;
    };
    if (!res.ok || !data.script) {
      throw new Error(data.erro || "Falha ao gerar roteiro.");
    }
    return data.script;
  }

  async function handleGenerateSingle() {
    setErro("");
    setTtsErro("");
    setGerando(true);
    try {
      const selectedModule = OFFICIAL_COURSE_MODULES.find(
        (m) => m.numero === numeroModulo
      );
      const created = await requestScriptGeneration(
        modo === "curso_modulo"
          ? {
              modo: "curso_modulo",
              numeroModulo,
              tituloModulo:
                tituloPersonalizado.trim() || selectedModule?.titulo,
              objetivoConversao,
              duracao,
              tomLocucao,
              idioma,
              linkDestino,
              notasAdmin,
            }
          : {
              modo: "video_leads",
              tema: temaLeads,
              objetivoConversao,
              duracao,
              tomLocucao,
              idioma,
              linkDestino,
              notasAdmin,
            }
      );
      setScripts((prev) => [created, ...prev]);
      setSelectedId(created.id);
      setSubTab("tts");
    } catch (err) {
      setErro(
        err instanceof Error ? err.message : "Erro ao gerar o roteiro."
      );
    } finally {
      setGerando(false);
    }
  }

  async function handleGenerateAllCourseModules() {
    setErro("");
    setTtsErro("");
    batchAbortRef.current = false;
    setGerando(true);
    setBatchProgress({ current: 0, total: OFFICIAL_COURSE_MODULES.length });

    try {
      for (let i = 0; i < OFFICIAL_COURSE_MODULES.length; i++) {
        if (batchAbortRef.current) break;
        const mod = OFFICIAL_COURSE_MODULES[i];
        setBatchProgress({
          current: i + 1,
          total: OFFICIAL_COURSE_MODULES.length,
        });
        const created = await requestScriptGeneration({
          modo: "curso_modulo",
          numeroModulo: mod.numero,
          tituloModulo: mod.titulo,
          objetivoConversao,
          duracao,
          tomLocucao,
          idioma,
          linkDestino,
          notasAdmin,
        });
        setScripts((prev) => [created, ...prev]);
        setSelectedId(created.id);
      }
    } catch (err) {
      setErro(
        err instanceof Error
          ? err.message
          : "Erro durante a geração em sequência dos módulos."
      );
    } finally {
      setGerando(false);
      setBatchProgress(null);
      batchAbortRef.current = false;
    }
  }

  async function handleSynthesizeAudio(
    clipKey: string,
    text: string,
    filenameBase: string
  ) {
    if (!text.trim()) {
      setTtsErro("O texto da locução está vazio.");
      return;
    }
    setTtsErro("");
    setTtsLoadingKey(clipKey);

    try {
      const res = await fetch("/api/admin/scripts/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          voiceName: ttsVoice,
          model: ttsModel,
          styleInstruction: ttsStyle,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        audioBase64?: string;
        durationApproxSeconds?: number;
        chunksCount?: number;
        model?: GeminiTtsModelId;
        voiceName?: GeminiTtsVoiceName;
        erro?: string;
      };
      if (!res.ok || !data.audioBase64) {
        throw new Error(
          data.erro || "Falha ao gerar áudio com o Google TTS."
        );
      }

      const objectUrl = base64WavToObjectUrl(data.audioBase64);
      setAudioClips((prev) => ({
        ...prev,
        [clipKey]: {
          dataUrl: objectUrl,
          voiceName: data.voiceName ?? ttsVoice,
          model: data.model ?? ttsModel,
          durationApproxSeconds: data.durationApproxSeconds ?? 1,
          chunksCount: data.chunksCount ?? 1,
          filename: `${slugifyFilename(filenameBase)}-${(data.voiceName ?? ttsVoice).toLowerCase()}.wav`,
        },
      }));
    } catch (err) {
      setTtsErro(
        err instanceof Error
          ? err.message
          : "Erro ao gerar áudio nativo via Google TTS."
      );
    } finally {
      setTtsLoadingKey(null);
    }
  }

  function downloadTextFile(filename: string, textContent: string) {
    const blob = new Blob([textContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportFullMarkdown(script: GeneratedYoutubeScript) {
    const lines = [
      `# ${script.tituloModulo}`,
      "",
      `> ${script.resumoAula}`,
      "",
      `## Hook Inicial`,
      script.hookInicial,
      "",
      `## Texto Limpo para Locução / TTS`,
      script.textoNarracaoPuro,
      "",
      `## Guia de Gravação de Tela (Cenas)`,
      ...script.cenasGravacao.flatMap((c) => [
        `### Cena ${c.ordem} (${c.tempoEstimado}) — Tela: ${c.telaRota}`,
        `- **Ação na tela:** ${c.acaoNaTela}`,
        `- **Locução:** ${c.locucao}`,
        "",
      ]),
      `## Pacote YouTube SEO`,
      `### Sugestões de Título`,
      ...script.titulosYoutube.map((t, i) => `${i + 1}. ${t}`),
      "",
      `### Descrição`,
      script.descricaoYoutube,
      "",
      `### Comentário Fixado`,
      script.comentarioFixado,
      "",
      `### Tags`,
      script.tagsYoutube.join(", "),
    ];
    downloadTextFile(
      `${slugifyFilename(script.tituloModulo)}.md`,
      lines.join("\n")
    );
  }

  const activeFullClipKey = activeScript ? `full_${activeScript.id}` : "";
  const activeFullClip = activeFullClipKey
    ? audioClips[activeFullClipKey]
    : undefined;
  const activeWordCount = activeScript
    ? activeScript.textoNarracaoPuro.trim().split(/\s+/).filter(Boolean).length
    : 0;
  const activeEstimatedSec = activeScript
    ? estimateSpeechSeconds(activeScript.textoNarracaoPuro)
    : 0;

  return (
    <div className="space-y-6">
      {/* Hero / Page Header */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-[#0F172A]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
              <Video className="h-3.5 w-3.5" />
              <span>Exclusivo Administrativo · Estúdio de YouTube, Cursos & TTS</span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
              Roteiros de Vídeo, Módulos de Curso & Áudio Nativo Google
            </h1>
            <p className="max-w-3xl text-sm text-slate-600 dark:text-slate-300">
              Gere roteiros sincronizados com gravações de tela e módulos
              didáticos completos baseados na arquitetura real do Artigen, com
              texto limpo pronto para copiar/colar em qualquer IA de voz ou
              sintetizar áudio diretamente pelo sistema Google TTS.
            </p>
          </div>
          {scripts.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-right dark:border-slate-800 dark:bg-slate-900/70">
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Roteiros salvos
              </p>
              <p className="text-lg font-bold text-slate-900 dark:text-white tabular-nums">
                {scripts.length}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Main 2-column grid */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* LEFT PANEL: Generator Controls */}
        <section className="space-y-5 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-[#0F172A] xl:col-span-5">
          {/* Mode Switcher */}
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1 dark:bg-slate-900">
            <button
              type="button"
              onClick={() => {
                setModo("curso_modulo");
                setDuracao("completo_8_12m");
              }}
              className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
                modo === "curso_modulo"
                  ? "bg-white text-indigo-700 shadow-xs dark:bg-slate-800 dark:text-indigo-300"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              }`}
            >
              <GraduationCap className="h-4 w-4 shrink-0" />
              <span>Módulos de Curso</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setModo("video_leads");
                setDuracao("direto_3_5m");
              }}
              className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
                modo === "video_leads"
                  ? "bg-white text-indigo-700 shadow-xs dark:bg-slate-800 dark:text-indigo-300"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              }`}
            >
              <Video className="h-4 w-4 shrink-0" />
              <span>Vídeo Captação Leads</span>
            </button>
          </div>

          {modo === "curso_modulo" ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Escolha o módulo do curso YouTube
                </label>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  8 aulas oficiais baseadas no sistema real
                </span>
              </div>
              <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                {OFFICIAL_COURSE_MODULES.map((mod) => {
                  const selected = numeroModulo === mod.numero;
                  return (
                    <button
                      key={mod.numero}
                      type="button"
                      onClick={() => setNumeroModulo(mod.numero)}
                      className={`w-full rounded-xl border p-3 text-left transition-all ${
                        selected
                          ? "border-indigo-500 bg-indigo-50/70 dark:border-indigo-500/70 dark:bg-indigo-950/40"
                          : "border-slate-200 bg-slate-50/60 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900/50 dark:hover:border-slate-700"
                      }`}
                    >
                      <p className="text-xs font-bold text-slate-900 dark:text-white">
                        {mod.titulo}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-400">
                        {mod.objetivo}
                      </p>
                      <p className="mt-1 font-mono text-[10px] text-indigo-700 dark:text-indigo-300">
                        Tela: {mod.focoTela}
                      </p>
                    </button>
                  );
                })}
              </div>

              <div>
                <label
                  htmlFor="script-custom-module"
                  className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  Título personalizado do módulo (opcional)
                </label>
                <input
                  id="script-custom-module"
                  type="text"
                  value={tituloPersonalizado}
                  onChange={(e) => setTituloPersonalizado(e.target.value)}
                  placeholder="Deixe vazio para usar o título oficial do módulo selecionado"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <p className="mb-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Ângulos rápidos de captação de leads
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {YOUTUBE_LEAD_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        setTemaLeads(preset.tema);
                        setObjetivoConversao(preset.objetivo);
                        setDuracao(preset.duracao);
                      }}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-indigo-700 dark:hover:bg-indigo-950/50"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label
                  htmlFor="script-lead-tema"
                  className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  Tema / Gancho principal do vídeo *
                </label>
                <textarea
                  id="script-lead-tema"
                  rows={3}
                  value={temaLeads}
                  onChange={(e) => setTemaLeads(e.target.value)}
                  placeholder="Ex.: Como criar artigos completos de blog com fontes reais e imagens em 3 minutos"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>
            </div>
          )}

          {/* Shared Controls */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="script-goal"
                className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Meta de captação de leads
              </label>
              <select
                id="script-goal"
                value={objetivoConversao}
                onChange={(e) =>
                  setObjetivoConversao(e.target.value as LeadGoalPreset)
                }
                className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="teste_gratis_studio">
                  Levar p/ Teste Grátis (/studio)
                </option>
                <option value="assinatura_planos">
                  Converter Assinantes (Starter / Pro)
                </option>
                <option value="programa_parceiros">
                  Atrair Parceiros (20%–35% recorrente)
                </option>
              </select>
            </div>

            <div>
              <label
                htmlFor="script-duration"
                className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Formato / Duração
              </label>
              <select
                id="script-duration"
                value={duracao}
                onChange={(e) =>
                  setDuracao(e.target.value as VideoDurationPreset)
                }
                className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="short_60s">Curto / Shorts (45–60s)</option>
                <option value="direto_3_5m">Vídeo Direto (3–5 min)</option>
                <option value="completo_8_12m">Aula Completa (6–10 min)</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="script-idioma"
                className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Idioma da locução
              </label>
              <select
                id="script-idioma"
                value={idioma}
                onChange={(e) => setIdioma(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                {IDIOMAS.map((lang) => (
                  <option key={lang.id} value={lang.id}>
                    {lang.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="script-link"
                className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Link CTA para descrição
              </label>
              <input
                id="script-link"
                type="text"
                value={linkDestino}
                onChange={(e) => setLinkDestino(e.target.value)}
                placeholder="https://criador.artificializar.site"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="script-tom"
              className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              Estilo de apresentação / fala
            </label>
            <input
              id="script-tom"
              type="text"
              value={tomLocucao}
              onChange={(e) => setTomLocucao(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label
              htmlFor="script-notas"
              className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              Notas extras para a IA (opcional)
            </label>
            <textarea
              id="script-notas"
              rows={2}
              value={notasAdmin}
              onChange={(e) => setNotasAdmin(e.target.value)}
              placeholder="Ex.: Enfatizar que não precisa cartão de crédito e mostrar o estilo Fotografia Realista..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50/70 p-2.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>

          {erro && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{erro}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-2.5 pt-1">
            <button
              type="button"
              disabled={gerando}
              onClick={() => void handleGenerateSingle()}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#5B4AF4] to-[#2563EB] px-4 py-3 text-xs font-semibold text-white shadow-xs transition-all hover:brightness-110 disabled:opacity-60"
            >
              {gerando && !batchProgress ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>A gerar roteiro sincronizado…</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span>
                    {modo === "curso_modulo"
                      ? `Gerar Roteiro do Módulo ${numeroModulo}`
                      : "Gerar Roteiro para YouTube"}
                  </span>
                </>
              )}
            </button>

            {modo === "curso_modulo" && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={gerando}
                  onClick={() => void handleGenerateAllCourseModules()}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 py-2.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-60 dark:border-indigo-800/70 dark:bg-indigo-950/50 dark:text-indigo-300 dark:hover:bg-indigo-900/50"
                >
                  {batchProgress ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>
                        A gerar módulo {batchProgress.current} de{" "}
                        {batchProgress.total}…
                      </span>
                    </>
                  ) : (
                    <>
                      <Layers className="h-3.5 w-3.5" />
                      <span>Gerar Curso Completo (Todos os 8 Módulos)</span>
                    </>
                  )}
                </button>
                {batchProgress && (
                  <button
                    type="button"
                    onClick={() => {
                      batchAbortRef.current = true;
                    }}
                    className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-300"
                  >
                    <Square className="h-3.5 w-3.5" />
                    <span>Parar</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Saved Scripts List */}
          {scripts.length > 0 && (
            <div className="border-t border-slate-100 pt-4 dark:border-slate-800">
              <div className="mb-2.5 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Histórico de roteiros gerados
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setScripts([]);
                    setSelectedId(null);
                  }}
                  className="text-[11px] font-medium text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400"
                >
                  Limpar tudo
                </button>
              </div>
              <div className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
                {scripts.map((item) => {
                  const isActive = activeScript?.id === item.id;
                  return (
                    <div
                      key={item.id}
                      className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs transition-colors ${
                        isActive
                          ? "border-indigo-400 bg-indigo-50/70 dark:border-indigo-600 dark:bg-indigo-950/40"
                          : "border-slate-200 bg-slate-50/50 hover:bg-slate-100/70 dark:border-slate-800 dark:bg-slate-900/50 dark:hover:bg-slate-800/70"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedId(item.id)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <p className="truncate font-semibold text-slate-900 dark:text-slate-100">
                          {item.tituloModulo}
                        </p>
                        <p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                          {item.modo === "curso_modulo"
                            ? "Módulo de Curso"
                            : "Vídeo Leads"}{" "}
                          · {item.cenasGravacao.length} cenas ·{" "}
                          {formatDurationMmSs(
                            estimateSpeechSeconds(item.textoNarracaoPuro)
                          )}
                        </p>
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteScript(item.id)}
                        aria-label="Excluir roteiro"
                        className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/50 dark:hover:text-rose-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* RIGHT PANEL: Script Output + Native Google TTS */}
        <section className="flex flex-col rounded-2xl border border-slate-200/90 bg-white shadow-xs dark:border-slate-800 dark:bg-[#0F172A] xl:col-span-7">
          {!activeScript ? (
            <div className="flex flex-1 flex-col items-center justify-center p-10 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
                <Clapperboard className="h-7 w-7" />
              </div>
              <h2 className="mt-4 text-base font-bold text-slate-900 dark:text-white">
                Nenhum roteiro selecionado ainda
              </h2>
              <p className="mt-1.5 max-w-md text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                Escolha um dos 8 módulos oficiais do curso ou configure um vídeo
                de captação de leads ao lado para gerar o texto limpo para IA
                de voz, o roteiro cena a cena para gravação de tela e o áudio
                nativo via Google TTS.
              </p>
            </div>
          ) : (
            <div className="flex flex-col">
              {/* Top Bar of Active Script */}
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 p-5 dark:border-slate-800">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                      {activeScript.modo === "curso_modulo"
                        ? "Curso YouTube"
                        : "Captação de Leads"}
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                      {activeWordCount} palavras · ~
                      {formatDurationMmSs(activeEstimatedSec)} de fala
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                      · {activeScript.cenasGravacao.length} cenas
                    </span>
                  </div>
                  <h2 className="mt-1.5 text-lg font-bold text-slate-900 dark:text-white">
                    {activeScript.tituloModulo}
                  </h2>
                  {activeScript.resumoAula && (
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                      {activeScript.resumoAula}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      handleCopy("tts-top", activeScript.textoNarracaoPuro)
                    }
                    className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
                  >
                    {copiedKey === "tts-top" ? (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        <span>Texto Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>Copiar Texto p/ Áudio</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => exportFullMarkdown(activeScript)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Exportar .md</span>
                  </button>
                </div>
              </div>

              {/* Sub-tabs */}
              <div className="flex flex-wrap gap-1 border-b border-slate-100 px-5 py-2.5 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setSubTab("tts")}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                    subTab === "tts"
                      ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300"
                      : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                  }`}
                >
                  <Volume2 className="h-3.5 w-3.5" />
                  <span>Locução (IA Externa + Google TTS)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSubTab("cenas")}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                    subTab === "cenas"
                      ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300"
                      : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                  }`}
                >
                  <MonitorPlay className="h-3.5 w-3.5" />
                  <span>
                    Gravação de Tela ({activeScript.cenasGravacao.length} cenas)
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setSubTab("youtube")}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                    subTab === "youtube"
                      ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300"
                      : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                  }`}
                >
                  <Video className="h-3.5 w-3.5" />
                  <span>Título, Descrição & CTA Leads</span>
                </button>
              </div>

              {/* Tab Content */}
              <div className="space-y-5 p-5">
                {subTab === "tts" && (
                  <>
                    {/* Clean Copy-Paste TTS Box */}
                    <div className="space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                            Texto Limpo de Narração (Pronto para Copiar e Colar em IA de Áudio)
                          </h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Sem marcações de cena, colchetes ou markdown — você
                            pode editar diretamente antes de copiar ou sintetizar.
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              handleCopy("tts-box", activeScript.textoNarracaoPuro)
                            }
                            className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300"
                          >
                            {copiedKey === "tts-box" ? (
                              <>
                                <Check className="h-3.5 w-3.5" />
                                <span>Copiado!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="h-3.5 w-3.5" />
                                <span>Copiar Texto Limpo</span>
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              downloadTextFile(
                                `${slugifyFilename(activeScript.tituloModulo)}-narracao.txt`,
                                activeScript.textoNarracaoPuro
                              )
                            }
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                          >
                            <Download className="h-3.5 w-3.5" />
                            <span>.txt</span>
                          </button>
                        </div>
                      </div>

                      <textarea
                        rows={11}
                        value={activeScript.textoNarracaoPuro}
                        onChange={(e) => updateActiveNarracao(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50/70 p-4 font-sans text-sm leading-relaxed text-slate-800 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      />
                    </div>

                    {/* Native Google TTS Generator */}
                    <div className="space-y-4 rounded-2xl border border-indigo-200/80 bg-indigo-50/40 p-4 dark:border-indigo-800/60 dark:bg-indigo-950/20">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white">
                            <FileAudio className="h-4 w-4" />
                          </span>
                          <div>
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                              Gerador Nativo de Áudio Google TTS (Exclusivo Admin)
                            </h3>
                            <p className="text-xs text-slate-600 dark:text-slate-300">
                              Sintetize o roteiro completo diretamente em WAV (24 kHz) para juntar com sua gravação de tela.
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <label
                            htmlFor="tts-voice"
                            className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-200"
                          >
                            Voz Google Gemini
                          </label>
                          <select
                            id="tts-voice"
                            value={ttsVoice}
                            onChange={(e) =>
                              setTtsVoice(e.target.value as GeminiTtsVoiceName)
                            }
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                          >
                            {GEMINI_TTS_VOICES.map((v) => (
                              <option key={v.id} value={v.id}>
                                {v.label}
                              </option>
                            ))}
                          </select>
                          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                            {
                              GEMINI_TTS_VOICES.find((v) => v.id === ttsVoice)
                                ?.perfil
                            }
                          </p>
                        </div>

                        <div>
                          <label
                            htmlFor="tts-model"
                            className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-200"
                          >
                            Modelo Google TTS
                          </label>
                          <select
                            id="tts-model"
                            value={ttsModel}
                            onChange={(e) =>
                              setTtsModel(e.target.value as GeminiTtsModelId)
                            }
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                          >
                            {GEMINI_TTS_MODELS.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.label}
                              </option>
                            ))}
                          </select>
                          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                            {
                              GEMINI_TTS_MODELS.find((m) => m.id === ttsModel)
                                ?.detalhe
                            }
                          </p>
                        </div>
                      </div>

                      <div>
                        <label
                          htmlFor="tts-style"
                          className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-200"
                        >
                          Direção de estilo vocal (opcional)
                        </label>
                        <input
                          id="tts-style"
                          type="text"
                          value={ttsStyle}
                          onChange={(e) => setTtsStyle(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                        />
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {TTS_STYLE_PRESETS.map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => setTtsStyle(preset)}
                              className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-600 hover:border-indigo-300 hover:text-indigo-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                            >
                              {preset.slice(0, 44)}…
                            </button>
                          ))}
                        </div>
                      </div>

                      {ttsErro && (
                        <div
                          role="alert"
                          className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300"
                        >
                          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                          <span>{ttsErro}</span>
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          disabled={Boolean(ttsLoadingKey)}
                          onClick={() =>
                            void handleSynthesizeAudio(
                              activeFullClipKey,
                              activeScript.textoNarracaoPuro,
                              activeScript.tituloModulo
                            )
                          }
                          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-indigo-600 dark:hover:bg-indigo-500"
                        >
                          {ttsLoadingKey === activeFullClipKey ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              <span>A sintetizar áudio completo via Google…</span>
                            </>
                          ) : activeFullClip ? (
                            <>
                              <RefreshCw className="h-4 w-4" />
                              <span>Regenerar Áudio Completo</span>
                            </>
                          ) : (
                            <>
                              <Mic className="h-4 w-4" />
                              <span>Gerar Áudio Nativo com Google TTS</span>
                            </>
                          )}
                        </button>
                      </div>

                      {activeFullClip && (
                        <div className="space-y-2.5 rounded-xl border border-emerald-200 bg-white p-3.5 dark:border-emerald-800/60 dark:bg-slate-900">
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                            <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-400">
                              <Volume2 className="h-4 w-4" />
                              <span>
                                Áudio pronto · Voz {activeFullClip.voiceName} ·{" "}
                                {formatDurationMmSs(
                                  activeFullClip.durationApproxSeconds
                                )}{" "}
                                ({activeFullClip.chunksCount}{" "}
                                {activeFullClip.chunksCount === 1
                                  ? "bloco"
                                  : "blocos"}
                                )
                              </span>
                            </span>
                            <a
                              href={activeFullClip.dataUrl}
                              download={activeFullClip.filename}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                            >
                              <Download className="h-3.5 w-3.5" />
                              <span>Baixar Áudio (.wav)</span>
                            </a>
                          </div>
                          <audio
                            controls
                            src={activeFullClip.dataUrl}
                            className="w-full"
                          />
                        </div>
                      )}
                    </div>
                  </>
                )}

                {subTab === "cenas" && (
                  <div className="space-y-4">
                    {activeScript.hookInicial && (
                      <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-800/60 dark:bg-amber-950/30">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-amber-800 dark:text-amber-300">
                          Hook Inicial (Primeiros Segundos de Retenção)
                        </p>
                        <p className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">
                          {activeScript.hookInicial}
                        </p>
                      </div>
                    )}

                    <div className="space-y-3">
                      {activeScript.cenasGravacao.map((cena) => {
                        const sceneClipKey = `scene_${activeScript.id}_${cena.ordem}`;
                        const sceneClip = audioClips[sceneClipKey];
                        return (
                          <div
                            key={cena.ordem}
                            className="space-y-2.5 rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/50"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-md bg-indigo-600 px-2 py-0.5 text-[11px] font-bold text-white tabular-nums">
                                  Cena {cena.ordem}
                                </span>
                                <span className="font-mono text-xs font-semibold text-slate-600 dark:text-slate-300 tabular-nums">
                                  {cena.tempoEstimado}
                                </span>
                                <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 font-mono text-[11px] text-indigo-700 dark:border-slate-700 dark:bg-slate-800 dark:text-indigo-300">
                                  {cena.telaRota}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleCopy(
                                      `cena_${cena.ordem}`,
                                      cena.locucao
                                    )
                                  }
                                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                >
                                  {copiedKey === `cena_${cena.ordem}` ? (
                                    <Check className="h-3 w-3 text-emerald-600" />
                                  ) : (
                                    <Copy className="h-3 w-3" />
                                  )}
                                  <span>Copiar fala</span>
                                </button>
                                <button
                                  type="button"
                                  disabled={Boolean(ttsLoadingKey)}
                                  onClick={() =>
                                    void handleSynthesizeAudio(
                                      sceneClipKey,
                                      cena.locucao,
                                      `${activeScript.tituloModulo}-cena-${cena.ordem}`
                                    )
                                  }
                                  className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50 dark:border-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300"
                                >
                                  {ttsLoadingKey === sceneClipKey ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <Play className="h-3 w-3" />
                                  )}
                                  <span>Áudio Google</span>
                                </button>
                              </div>
                            </div>

                            <div className="rounded-lg border border-slate-200/80 bg-white px-3 py-2 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                              <strong className="text-slate-900 dark:text-white">
                                Gravar na tela:
                              </strong>{" "}
                              {cena.acaoNaTela}
                            </div>

                            <p className="text-sm leading-relaxed text-slate-800 dark:text-slate-200">
                              {cena.locucao}
                            </p>

                            {sceneClip && (
                              <div className="flex flex-wrap items-center gap-3 rounded-lg border border-emerald-200 bg-white p-2.5 dark:border-emerald-800/60 dark:bg-slate-900">
                                <audio
                                  controls
                                  src={sceneClip.dataUrl}
                                  className="h-8 flex-1"
                                />
                                <a
                                  href={sceneClip.dataUrl}
                                  download={sceneClip.filename}
                                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-700"
                                >
                                  <Download className="h-3 w-3" />
                                  <span>.wav</span>
                                </a>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {subTab === "youtube" && (
                  <div className="space-y-5">
                    {/* YouTube Titles */}
                    <div className="space-y-2">
                      <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                        <BookOpen className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                        <span>Opções de Título para YouTube (SEO + Cliques)</span>
                      </h3>
                      <div className="space-y-2">
                        {activeScript.titulosYoutube.map((t, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-xs dark:border-slate-800 dark:bg-slate-900/60"
                          >
                            <span className="font-semibold text-slate-900 dark:text-slate-100">
                              {t}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopy(`yt-title-${idx}`, t)}
                              className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                            >
                              {copiedKey === `yt-title-${idx}` ? (
                                <Check className="h-3 w-3 text-emerald-600" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                              <span>Copiar</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                          Descrição Pronta (com CTA para o Site e Capítulos)
                        </h3>
                        <button
                          type="button"
                          onClick={() =>
                            handleCopy("yt-desc", activeScript.descricaoYoutube)
                          }
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        >
                          {copiedKey === "yt-desc" ? (
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                          <span>Copiar descrição</span>
                        </button>
                      </div>
                      <pre className="whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50/70 p-4 font-sans text-xs leading-relaxed text-slate-800 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-200">
                        {activeScript.descricaoYoutube}
                      </pre>
                    </div>

                    {/* Pinned Comment */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                          Comentário Fixado (Captação Direta de Leads)
                        </h3>
                        <button
                          type="button"
                          onClick={() =>
                            handleCopy(
                              "yt-comment",
                              activeScript.comentarioFixado
                            )
                          }
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        >
                          {copiedKey === "yt-comment" ? (
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                          <span>Copiar comentário</span>
                        </button>
                      </div>
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3.5 text-xs leading-relaxed text-slate-800 dark:border-emerald-800/60 dark:bg-emerald-950/30 dark:text-slate-200">
                        {activeScript.comentarioFixado}
                      </div>
                    </div>

                    {/* Tags */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                          Tags YouTube SEO
                        </h3>
                        <button
                          type="button"
                          onClick={() =>
                            handleCopy(
                              "yt-tags",
                              activeScript.tagsYoutube.join(", ")
                            )
                          }
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        >
                          {copiedKey === "yt-tags" ? (
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                          <span>Copiar tags</span>
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {activeScript.tagsYoutube.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
