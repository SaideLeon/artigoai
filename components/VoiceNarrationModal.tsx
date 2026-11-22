"use client";

import { useEffect, useRef, useState } from "react";
import {
  Mic,
  Square,
  Pause,
  Play,
  Upload,
  Sparkles,
  Wand2,
  X,
  Search,
  Image as ImageIcon,
  UserCheck,
  Loader2,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Plus,
} from "lucide-react";
import MicMascotScene from "@/components/mascot/MicMascotScene";
import {
  FAIXAS_PALAVRAS,
  IDIOMAS,
  TONS_TEXTO,
  type FaixaPalavrasId,
  type ModoPesquisa,
  type PlanoGeracao,
} from "@/lib/types";

export type VoiceNarrationApplyPayload = {
  tema: string;
  descricao: string;
  palavrasChave: string[];
  tom: string;
  idioma: string;
  faixaPalavras: FaixaPalavrasId;
  incluirImagens: boolean;
  primeiraPessoa: boolean;
  pesquisaWeb: ModoPesquisa;
  narracao: string;
  autoGenerate: boolean;
};

type VoiceNarrationModalProps = {
  open: boolean;
  initialTema: string;
  initialIdioma: string;
  initialTom: string;
  initialFaixaPalavras: FaixaPalavrasId;
  initialIncluirImagens: boolean;
  initialPrimeiraPessoa: boolean;
  initialPesquisaWeb: ModoPesquisa;
  initialNarracao: string;
  planoGeracao: PlanoGeracao;
  onRecordingStateChange?: (recording: boolean) => void;
  onClose: () => void;
  onApply: (payload: VoiceNarrationApplyPayload) => void;
};

type ModalPhase = "setup" | "recording" | "processing" | "review";

function formatTimer(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function pickSupportedRecorderMime(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  for (const mime of candidates) {
    if (MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return undefined;
}

export default function VoiceNarrationModal({
  open,
  initialTema,
  initialIdioma,
  initialTom,
  initialFaixaPalavras,
  initialIncluirImagens,
  initialPrimeiraPessoa,
  initialPesquisaWeb,
  initialNarracao,
  planoGeracao,
  onRecordingStateChange,
  onClose,
  onApply,
}: VoiceNarrationModalProps) {
  const [phase, setPhase] = useState<ModalPhase>(
    initialNarracao.trim() ? "review" : "setup"
  );
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [statusMsg, setStatusMsg] = useState("");
  const [erro, setErro] = useState("");

  // Narration pre-config options
  const [pesquisaWeb, setPesquisaWeb] = useState<ModoPesquisa>(
    initialPesquisaWeb === "desativada" ? "sempre" : initialPesquisaWeb
  );
  const [faixaPalavras, setFaixaPalavras] = useState<FaixaPalavrasId>(
    initialFaixaPalavras === "800-1200" ? "2000-2500" : initialFaixaPalavras
  );
  const [idioma, setIdioma] = useState(initialIdioma);
  const [incluirImagens, setIncluirImagens] = useState(initialIncluirImagens);
  const [primeiraPessoa, setPrimeiraPessoa] = useState(initialPrimeiraPessoa);

  // Reviewed / organized narration outputs
  const [tema, setTema] = useState(initialTema);
  const [descricao, setDescricao] = useState("");
  const [palavrasChaveText, setPalavrasChaveText] = useState("");
  const [tom, setTom] = useState(initialTom || TONS_TEXTO[0]);
  const [transcricaoBruta, setTranscricaoBruta] = useState("");
  const [narracaoOrganizada, setNarracaoOrganizada] = useState(initialNarracao);
  const [appendMode, setAppendMode] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const levelRafRef = useRef<number>(0);
  const chunksRef = useRef<Blob[]>([]);
  const discardOnStopRef = useRef<boolean>(false);
  const mountedRef = useRef<boolean>(true);
  const appendModeRef = useRef<boolean>(false);

  useEffect(() => {
    appendModeRef.current = appendMode;
  }, [appendMode]);

  function releaseHardwareResources() {
    cancelAnimationFrame(levelRafRef.current);
    levelRafRef.current = 0;

    if (mediaRecorderRef.current) {
      try {
        if (mediaRecorderRef.current.state !== "inactive") {
          mediaRecorderRef.current.stop();
        }
      } catch {
        // ignore
      }
      mediaRecorderRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    if (audioCtxRef.current) {
      void audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
  }

  function cleanupAudioHardware() {
    releaseHardwareResources();
    setAudioLevel(0);
    onRecordingStateChange?.(false);
  }

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      discardOnStopRef.current = true;
      releaseHardwareResources();
    };
  }, []);

  useEffect(() => {
    if (!open) {
      discardOnStopRef.current = true;
      releaseHardwareResources();
    }
  }, [open]);

  // Recording elapsed timer
  useEffect(() => {
    if (phase !== "recording" || isPaused) return;
    const id = window.setInterval(() => {
      setElapsedSec((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [phase, isPaused]);

  async function processarAudioBlob(audioBlob: Blob, filename: string) {
    if (!mountedRef.current) return;
    setPhase("processing");
    setErro("");
    setStatusMsg("1/2 — A transcrever sua narração com Whisper…");

    try {
      const formData = new FormData();
      formData.append("file", audioBlob, filename);
      formData.append("idioma", idioma);

      const transcribeRes = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });
      const transcribeJson = (await transcribeRes.json()) as {
        text?: string;
        erro?: string;
      };
      if (!transcribeRes.ok || !transcribeJson.text) {
        throw new Error(
          transcribeJson.erro ?? "Não foi possível transcrever o áudio."
        );
      }

      if (!mountedRef.current) return;

      const combinedTranscript =
        appendModeRef.current && narracaoOrganizada.trim()
          ? `${narracaoOrganizada.trim()}\n\n${transcribeJson.text.trim()}`
          : transcribeJson.text.trim();

      setTranscricaoBruta(combinedTranscript);
      setStatusMsg(
        "2/2 — Mascote a revisar, melhorar e organizar sua história…"
      );

      const organizeRes = await fetch("/api/narrate-organize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          narracao: combinedTranscript,
          idioma,
          plano: planoGeracao,
          primeiraPessoa,
        }),
      });
      const organizeJson = (await organizeRes.json()) as {
        tema?: string;
        descricao?: string;
        palavrasChave?: string[];
        tom?: string;
        narracaoOrganizada?: string;
        erro?: string;
      };

      if (!mountedRef.current) return;

      if (organizeRes.ok && organizeJson.narracaoOrganizada) {
        if (!tema.trim() || !appendModeRef.current) {
          setTema(organizeJson.tema ?? "");
        }
        setDescricao(organizeJson.descricao ?? "");
        setPalavrasChaveText(
          Array.isArray(organizeJson.palavrasChave)
            ? organizeJson.palavrasChave.join(", ")
            : ""
        );
        if (organizeJson.tom) setTom(organizeJson.tom);
        setNarracaoOrganizada(organizeJson.narracaoOrganizada);
      } else {
        setNarracaoOrganizada(combinedTranscript);
        if (!tema.trim()) {
          setTema(combinedTranscript.slice(0, 80).trim());
        }
      }

      setAppendMode(false);
      setStatusMsg("");
      setPhase("review");
    } catch (e) {
      if (!mountedRef.current) return;
      setErro(
        e instanceof Error
          ? e.message
          : "Erro ao processar a narração em áudio."
      );
      setPhase(narracaoOrganizada.trim() ? "review" : "setup");
      setStatusMsg("");
    }
  }

  async function iniciarGravacao(isAppend = false) {
    setErro("");
    setAppendMode(isAppend);
    appendModeRef.current = isAppend;

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setErro(
        "Este navegador não suporta gravação de microfone. Pode carregar um ficheiro de áudio."
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      if (!mountedRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      mediaStreamRef.current = stream;
      chunksRef.current = [];
      discardOnStopRef.current = false;

      // Setup Web Audio AnalyserNode for real-time 3D wave amplitude
      const AudioContextCtor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (AudioContextCtor) {
        const ctx = new AudioContextCtor();
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.72;
        source.connect(analyser);
        audioCtxRef.current = ctx;
        analyserRef.current = analyser;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const updateMeter = () => {
          if (!mountedRef.current || !analyserRef.current) return;
          analyserRef.current.getByteTimeDomainData(dataArray);
          let sumSq = 0;
          for (let i = 0; i < dataArray.length; i++) {
            const v = (dataArray[i] - 128) / 128;
            sumSq += v * v;
          }
          const rms = Math.sqrt(sumSq / dataArray.length);
          const normalized = Math.min(1, Math.max(0, rms * 4.2));
          setAudioLevel(normalized);
          levelRafRef.current = requestAnimationFrame(updateMeter);
        };
        levelRafRef.current = requestAnimationFrame(updateMeter);
      }

      const mimeType = pickSupportedRecorderMime();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          chunksRef.current.push(ev.data);
        }
      };

      recorder.onstop = () => {
        const mime = recorder.mimeType || mimeType || "audio/webm";
        const recordedBlob = new Blob(chunksRef.current, { type: mime });
        const shouldDiscard = discardOnStopRef.current;
        chunksRef.current = [];

        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((t) => t.stop());
          mediaStreamRef.current = null;
        }
        if (audioCtxRef.current) {
          void audioCtxRef.current.close().catch(() => {});
          audioCtxRef.current = null;
        }
        analyserRef.current = null;
        cancelAnimationFrame(levelRafRef.current);
        levelRafRef.current = 0;
        setAudioLevel(0);
        onRecordingStateChange?.(false);

        if (!shouldDiscard && recordedBlob.size > 0 && mountedRef.current) {
          const ext = mime.includes("mp4")
            ? "m4a"
            : mime.includes("ogg")
            ? "ogg"
            : "webm";
          void processarAudioBlob(recordedBlob, `narracao.${ext}`);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start(250);
      setElapsedSec(0);
      setIsPaused(false);
      setPhase("recording");
      onRecordingStateChange?.(true);
    } catch (e) {
      cleanupAudioHardware();
      const errName = e instanceof Error ? e.name : "";
      if (errName === "NotAllowedError" || errName === "PermissionDeniedError") {
        setErro(
          "Permissão do microfone negada no navegador. Autorize o microfone ou envie um ficheiro de áudio."
        );
      } else {
        setErro(
          e instanceof Error
            ? e.message
            : "Não foi possível aceder ao microfone."
        );
      }
    }
  }

  function alternarPausaGravacao() {
    const rec = mediaRecorderRef.current;
    if (!rec) return;
    if (rec.state === "recording") {
      rec.pause();
      setIsPaused(true);
      setAudioLevel(0);
      onRecordingStateChange?.(false);
    } else if (rec.state === "paused") {
      rec.resume();
      setIsPaused(false);
      onRecordingStateChange?.(true);
    }
  }

  function concluirGravacao() {
    const rec = mediaRecorderRef.current;
    if (!rec || rec.state === "inactive") return;
    discardOnStopRef.current = false;
    rec.stop();
  }

  function cancelarGravacao() {
    discardOnStopRef.current = true;
    cleanupAudioHardware();
    setIsPaused(false);
    setElapsedSec(0);
    setPhase(narracaoOrganizada.trim() ? "review" : "setup");
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    void processarAudioBlob(file, file.name);
  }

  function finalizarAplicacao(autoGenerate: boolean) {
    const tags = palavrasChaveText
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 10);

    onApply({
      tema: tema.trim() || narracaoOrganizada.slice(0, 80).trim(),
      descricao: descricao.trim(),
      palavrasChave: tags,
      tom,
      idioma,
      faixaPalavras,
      incluirImagens,
      primeiraPessoa,
      pesquisaWeb,
      narracao: narracaoOrganizada.trim(),
      autoGenerate,
    });
  }

  if (!open) return null;

  const isWaveActive =
    (phase === "recording" && !isPaused) || phase === "processing";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="voice-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 sm:p-5"
    >
      <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-indigo-200/80 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        {/* Top Modal Header */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#5B4AF4] to-[#2563EB] text-white shadow-xs">
              <Mic className="h-4.5 w-4.5" />
            </span>
            <div>
              <h2
                id="voice-modal-title"
                className="text-base font-bold tracking-tight text-slate-900 dark:text-white"
              >
                Narrar Artigo por Voz
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Explique com as suas próprias palavras — o mascote organiza,
                verifica na web e cria o artigo completo com imagens.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              discardOnStopRef.current = true;
              cleanupAudioHardware();
              onClose();
            }}
            aria-label="Fechar narração por voz"
            className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body: 2-column responsive layout */}
        <div className="studio-scroll grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[340px_minmax(0,1fr)]">
          {/* Left Stage: 3D Mascot Holding Microphone + Sound Waves (zero backdrop-filter!) */}
          <div className="flex flex-col items-center justify-between border-b border-indigo-100/80 bg-gradient-to-b from-[#DCE3FF] via-[#EEF2FF] to-[#F8FAFF] p-5 dark:border-slate-800 dark:from-[#121A3A] dark:via-[#111936] dark:to-slate-900 lg:border-b-0 lg:border-r">
            <div className="w-full text-center">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/85 px-3 py-1 text-xs font-semibold text-indigo-700 shadow-xs dark:bg-slate-800 dark:text-indigo-300">
                <Mic className="h-3.5 w-3.5" />
                {phase === "recording"
                  ? isPaused
                    ? "Gravação em pausa"
                    : "A gravar tudo ao vivo"
                  : phase === "processing"
                  ? "A transcrever e organizar…"
                  : phase === "review"
                  ? "Narração revisada e pronta"
                  : "Pronto para ouvir você"}
              </span>
            </div>

            <div className="relative my-2 h-64 w-full max-w-[290px] sm:h-72">
              <MicMascotScene
                isRecording={isWaveActive}
                audioLevel={
                  phase === "processing"
                    ? 0.55
                    : phase === "recording" && !isPaused
                    ? Math.max(0.2, audioLevel)
                    : 0.05
                }
                cameraZ={4.65}
                scale={1.04}
                className="h-full w-full"
                ariaLabel="Mascote 3D Artigen segurando um microfone com ondas sonoras ao redor"
              />
            </div>

            {/* Live Acoustic Level Bars & Timer */}
            <div className="w-full space-y-2.5 text-center">
              <div
                aria-hidden="true"
                className="flex h-7 items-end justify-center gap-1"
              >
                {[0.35, 0.6, 0.9, 1.0, 0.85, 0.55, 0.35].map((mult, idx) => {
                  const base =
                    phase === "recording" && !isPaused
                      ? Math.max(0.18, audioLevel * mult)
                      : phase === "processing"
                      ? 0.45 * mult
                      : 0.14;
                  return (
                    <span
                      key={idx}
                      style={{ height: `${Math.round(base * 26)}px` }}
                      className="w-1.5 rounded-full bg-gradient-to-t from-indigo-600 to-cyan-400 transition-[height] duration-75"
                    />
                  );
                })}
              </div>

              {phase === "recording" ? (
                <p className="font-mono text-lg font-bold text-indigo-950 dark:text-white tabular-nums">
                  {formatTimer(elapsedSec)}
                </p>
              ) : (
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  {phase === "processing"
                    ? statusMsg
                    : "Fale naturalmente como se estivesse a explicar a um escritor."}
                </p>
              )}
            </div>
          </div>

          {/* Right Column: Configuration / Recording Controls / Review */}
          <div className="flex min-w-0 flex-col justify-between p-5 sm:p-6">
            {erro && (
              <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/50 dark:text-rose-300">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{erro}</span>
              </div>
            )}

            {(phase === "setup" || phase === "recording") && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Configurações iniciais da narração
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    Defina como o mascote deve conciliar os seus factos e
                    estruturar o artigo antes ou durante a gravação.
                  </p>
                </div>

                {/* Search reconciliation mode */}
                <div>
                  <label
                    htmlFor="voice-pesquisa"
                    className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200"
                  >
                    <Search className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>
                      Buscar na internet para conciliar factos da sua narração?
                    </span>
                  </label>
                  <select
                    id="voice-pesquisa"
                    value={pesquisaWeb}
                    onChange={(e) =>
                      setPesquisaWeb(e.target.value as ModoPesquisa)
                    }
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-xs font-medium text-slate-800 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  >
                    <option value="sempre">
                      Sim, pesquisar na internet e conciliar factos atuais
                    </option>
                    <option value="auto">
                      Automático (pesquisar se houver factos, datas ou notícias)
                    </option>
                    <option value="desativada">
                      Não, basear-se apenas na minha narração
                    </option>
                  </select>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="voice-palavras"
                      className="mb-1 block text-xs font-semibold text-slate-800 dark:text-slate-200"
                    >
                      Extensão desejada do artigo
                    </label>
                    <select
                      id="voice-palavras"
                      value={faixaPalavras}
                      onChange={(e) =>
                        setFaixaPalavras(e.target.value as FaixaPalavrasId)
                      }
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs font-medium text-slate-800 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    >
                      {FAIXAS_PALAVRAS.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="voice-idioma"
                      className="mb-1 block text-xs font-semibold text-slate-800 dark:text-slate-200"
                    >
                      Idioma da narração e artigo
                    </label>
                    <select
                      id="voice-idioma"
                      value={idioma}
                      onChange={(e) => setIdioma(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs font-medium text-slate-800 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    >
                      {IDIOMAS.map((lang) => (
                        <option key={lang.id} value={lang.id}>
                          {lang.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Toggles: Imagens + Primeira pessoa */}
                <div className="space-y-2.5 rounded-2xl border border-slate-200/80 bg-slate-50/60 p-3.5 dark:border-slate-800 dark:bg-slate-800/40">
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
                      <ImageIcon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                      <span>Gerar imagens para capa e todas as secções</span>
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={incluirImagens}
                      onClick={() => setIncluirImagens((v) => !v)}
                      className={`relative inline-flex h-5.5 w-10 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
                        incluirImagens
                          ? "bg-indigo-600"
                          : "bg-slate-300 dark:bg-slate-700"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                          incluirImagens ? "translate-x-5" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
                      <UserCheck className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                      <span>Manter narrativa em primeira pessoa (&quot;eu&quot;)</span>
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={primeiraPessoa}
                      onClick={() => setPrimeiraPessoa((v) => !v)}
                      className={`relative inline-flex h-5.5 w-10 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
                        primeiraPessoa
                          ? "bg-indigo-600"
                          : "bg-slate-300 dark:bg-slate-700"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                          primeiraPessoa ? "translate-x-5" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Recording Action Buttons */}
                <div className="pt-2">
                  {phase === "setup" ? (
                    <div className="flex flex-col gap-2.5">
                      <button
                        type="button"
                        onClick={() => void iniciarGravacao(false)}
                        className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-[#6344F5] via-[#4F46E5] to-[#2563EB] px-5 py-3.5 text-sm font-semibold text-white shadow-md shadow-indigo-600/20 transition-all hover:brightness-105"
                      >
                        <Mic className="h-4.5 w-4.5" />
                        <span>Ligar Microfone e Começar a Narrar</span>
                      </button>

                      <div className="flex items-center justify-between gap-2">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="audio/*,.m4a,.mp3,.wav,.webm,.ogg,.flac"
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                        >
                          <Upload className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                          <span>
                            Ou enviar áudio já gravado (.m4a, .mp3, .wav)
                          </span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 px-4 py-3 text-xs text-indigo-900 dark:border-indigo-800/60 dark:bg-indigo-950/40 dark:text-indigo-200">
                        {isPaused
                          ? "Gravação em pausa. Clique em Retomar para continuar a falar ou em Concluir para organizar o artigo."
                          : "Pode falar livremente sobre a sua história, contexto, detalhes e exemplos. As ondas ao redor do mascote confirmam que está a gravar."}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={alternarPausaGravacao}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                        >
                          {isPaused ? (
                            <>
                              <Play className="h-3.5 w-3.5 text-emerald-600" />
                              <span>Retomar</span>
                            </>
                          ) : (
                            <>
                              <Pause className="h-3.5 w-3.5 text-amber-500" />
                              <span>Pausar</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={cancelarGravacao}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 dark:border-rose-900/60 dark:bg-rose-950/50 dark:text-rose-300"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          <span>Cancelar</span>
                        </button>

                        <button
                          type="button"
                          onClick={concluirGravacao}
                          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-indigo-600 px-5 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-sm hover:brightness-105"
                        >
                          <Square className="h-3.5 w-3.5 fill-current" />
                          <span>Concluir Narração e Organizar</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {phase === "processing" && (
              <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
                <Loader2 className="h-9 w-9 animate-spin text-indigo-600 dark:text-indigo-400" />
                <h3 className="mt-4 text-base font-bold text-slate-900 dark:text-white">
                  O mascote está a preparar a sua história
                </h3>
                <p className="mt-1.5 max-w-sm text-xs text-slate-500 dark:text-slate-400">
                  {statusMsg}
                </p>
              </div>
            )}

            {phase === "review" && (
              <div className="space-y-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Narração transcrita e revisada pelo mascote</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => void iniciarGravacao(true)}
                    className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300"
                  >
                    <Plus className="h-3 w-3" />
                    <span>Falar mais detalhes</span>
                  </button>
                </div>

                <div>
                  <label
                    htmlFor="review-tema"
                    className="mb-1 block text-xs font-semibold text-slate-800 dark:text-slate-200"
                  >
                    Título sugerido para o artigo
                  </label>
                  <input
                    id="review-tema"
                    type="text"
                    maxLength={100}
                    value={tema}
                    onChange={(e) => setTema(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2 text-sm font-semibold text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="review-keywords"
                      className="mb-1 block text-xs font-semibold text-slate-800 dark:text-slate-200"
                    >
                      Palavras-chave
                    </label>
                    <input
                      id="review-keywords"
                      type="text"
                      value={palavrasChaveText}
                      onChange={(e) => setPalavrasChaveText(e.target.value)}
                      placeholder="palavra 1, palavra 2..."
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs text-slate-800 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="review-tom"
                      className="mb-1 block text-xs font-semibold text-slate-800 dark:text-slate-200"
                    >
                      Tom editorial
                    </label>
                    <select
                      id="review-tom"
                      value={tom}
                      onChange={(e) => setTom(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs font-medium text-slate-800 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    >
                      {TONS_TEXTO.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <label
                      htmlFor="review-narracao"
                      className="text-xs font-semibold text-slate-800 dark:text-slate-200"
                    >
                      Explicação organizada (pode editar antes de gerar)
                    </label>
                    {transcricaoBruta && (
                      <button
                        type="button"
                        onClick={() => setNarracaoOrganizada(transcricaoBruta)}
                        className="text-[11px] font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                      >
                        Usar transcrição literal
                      </button>
                    )}
                  </div>
                  <textarea
                    id="review-narracao"
                    rows={6}
                    value={narracaoOrganizada}
                    onChange={(e) => setNarracaoOrganizada(e.target.value)}
                    className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs leading-relaxed text-slate-800 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>

                {/* Final Review Actions */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => finalizarAplicacao(false)}
                    disabled={!narracaoOrganizada.trim()}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>Aplicar no formulário</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => finalizarAplicacao(true)}
                    disabled={!narracaoOrganizada.trim()}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#6344F5] via-[#4F46E5] to-[#2563EB] px-5 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-md shadow-indigo-600/20 hover:brightness-105 disabled:opacity-50"
                  >
                    <Wand2 className="h-4 w-4" />
                    <span>Criar Artigo Completo e Imagens</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
