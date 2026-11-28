import { readFile } from "node:fs/promises";
import path from "node:path";
import { Type, type Schema } from "@google/genai";
import {
  formatGeminiError,
  generateArticleText,
  getGeminiClient,
} from "@/lib/ai-providers";
import {
  GEMINI_TTS_MODELS,
  GEMINI_TTS_VOICES,
  OFFICIAL_COURSE_MODULES,
  TTS_STYLE_PRESETS,
  YOUTUBE_LEAD_PRESETS,
  estimateSpeechSeconds,
  formatDurationMmSs,
  sanitizeForTtsNarration,
  splitTextForTts,
  type CourseModuleBlueprint,
  type GeminiTtsModelId,
  type GeminiTtsVoiceName,
  type GeneratedYoutubeScript,
  type LeadGoalPreset,
  type ScriptCreationMode,
  type ScriptSceneCue,
  type VideoDurationPreset,
} from "@/lib/admin-scripts-shared";

export {
  GEMINI_TTS_MODELS,
  GEMINI_TTS_VOICES,
  OFFICIAL_COURSE_MODULES,
  TTS_STYLE_PRESETS,
  YOUTUBE_LEAD_PRESETS,
  estimateSpeechSeconds,
  formatDurationMmSs,
  sanitizeForTtsNarration,
  splitTextForTts,
  type CourseModuleBlueprint,
  type GeminiTtsModelId,
  type GeminiTtsVoiceName,
  type GeneratedYoutubeScript,
  type LeadGoalPreset,
  type ScriptCreationMode,
  type ScriptSceneCue,
  type VideoDurationPreset,
};

const SCRIPT_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    tituloModulo: { type: Type.STRING },
    resumoAula: { type: Type.STRING },
    hookInicial: { type: Type.STRING },
    cenasGravacao: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          ordem: { type: Type.INTEGER },
          tempoEstimado: { type: Type.STRING },
          telaRota: { type: Type.STRING },
          acaoNaTela: { type: Type.STRING },
          locucao: { type: Type.STRING },
        },
        required: [
          "ordem",
          "tempoEstimado",
          "telaRota",
          "acaoNaTela",
          "locucao",
        ],
      },
    },
    textoNarracaoPuro: { type: Type.STRING },
    titulosYoutube: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    descricaoYoutube: { type: Type.STRING },
    comentarioFixado: { type: Type.STRING },
    tagsYoutube: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
  },
  required: [
    "tituloModulo",
    "resumoAula",
    "hookInicial",
    "cenasGravacao",
    "textoNarracaoPuro",
    "titulosYoutube",
    "descricaoYoutube",
    "comentarioFixado",
    "tagsYoutube",
  ],
};

export async function loadPlatformLlmsContext(): Promise<string> {
  try {
    const filePath = path.join(process.cwd(), "public", "llms.txt");
    const content = await readFile(filePath, "utf8");
    return content.slice(0, 26000);
  } catch {
    return [
      "Artigen (https://criador.artificializar.site): gerador de artigos para blogs com IA.",
      "Rotas: / (landing), /studio (estúdio principal), /mascote (Mulébi 3D), /parceiro.",
      "Funcionalidades: Sugestão com IA, até 5 links primários, Narração por Voz (Groq Whisper + Gemini), 6 estilos de imagem (NVIDIA FLUX.3 Klein 1024x1024), Editor com pré-visualização de imagem e regeneração, Auditoria SEO, Baixar HTML limpo.",
      "Planos Cakto BRL: Grátis (2 artigos/mês, 14 imagens), Starter (R$ 34,90/mês, 14 artigos, 98 imagens), Pro (R$ 94,90/mês, 33 artigos, 231 imagens), Agência (R$ 149,90/mês, 48 artigos, 336 imagens).",
    ].join("\n");
  }
}

export type GenerateAdminScriptInput = {
  modo: ScriptCreationMode;
  numeroModulo?: number;
  tituloModulo?: string;
  tema?: string;
  objetivoConversao?: LeadGoalPreset;
  duracao?: VideoDurationPreset;
  tomLocucao?: string;
  idioma?: string;
  linkDestino?: string;
  notasAdmin?: string;
};

function describeDurationTarget(duracao: VideoDurationPreset): {
  label: string;
  wordRange: string;
  sceneRange: string;
} {
  if (duracao === "short_60s") {
    return {
      label: "Curto / YouTube Shorts (45 a 60 segundos)",
      wordRange: "120 a 160 palavras faladas",
      sceneRange: "3 a 4 cenas rápidas",
    };
  }
  if (duracao === "completo_8_12m") {
    return {
      label: "Aula / Tutorial Completo (6 a 10 minutos)",
      wordRange: "750 a 1.150 palavras faladas",
      sceneRange: "7 a 10 cenas detalhadas",
    };
  }
  return {
    label: "Vídeo Direto YouTube (3 a 5 minutos)",
    wordRange: "420 a 680 palavras faladas",
    sceneRange: "5 a 7 cenas bem sincronizadas",
  };
}

function describeConversionGoal(goal: LeadGoalPreset, linkDestino: string): string {
  switch (goal) {
    case "assinatura_planos":
      return `Converter espectadores interessados em escala editorial para conhecer os planos Starter (R$ 34,90/mês), Pro (R$ 94,90/mês) ou Agência (R$ 149,90/mês) no site ${linkDestino}.`;
    case "programa_parceiros":
      return `Apresentar o sistema e convidar criadores/afiliados a conhecer o Artigen e o Programa de Parceiros (comissões recorrentes de 20% a 35% sobre planos pagos) através de ${linkDestino}.`;
    case "teste_gratis_studio":
    default:
      return `Captar leads levando o espectador a acessar ${linkDestino} e testar o estúdio gratuitamente sem precisar de cartão de crédito (2 artigos grátis por mês).`;
  }
}

export async function generateAdminYoutubeScript(
  input: GenerateAdminScriptInput
): Promise<GeneratedYoutubeScript> {
  const llmsDoc = await loadPlatformLlmsContext();
  const modo: ScriptCreationMode =
    input.modo === "curso_modulo" ? "curso_modulo" : "video_leads";
  const duracao: VideoDurationPreset =
    input.duracao === "short_60s" ||
    input.duracao === "completo_8_12m" ||
    input.duracao === "direto_3_5m"
      ? input.duracao
      : modo === "curso_modulo"
      ? "completo_8_12m"
      : "direto_3_5m";

  const idioma = input.idioma?.trim() || "Português (Brasil)";
  const tomLocucao =
    input.tomLocucao?.trim() || "Didático, claro e envolvente";
  const linkDestino =
    input.linkDestino?.trim() || "https://criador.artificializar.site";
  const objetivoConversao: LeadGoalPreset =
    input.objetivoConversao === "assinatura_planos" ||
    input.objetivoConversao === "programa_parceiros"
      ? input.objetivoConversao
      : "teste_gratis_studio";

  const moduleBlueprint =
    modo === "curso_modulo"
      ? OFFICIAL_COURSE_MODULES.find((m) => m.numero === input.numeroModulo) ??
        null
      : null;

  const tituloBase =
    input.tituloModulo?.trim() ||
    moduleBlueprint?.titulo ||
    input.tema?.trim() ||
    "Como usar o Artigen para criar artigos completos com IA";

  const durSpec = describeDurationTarget(duracao);
  const convSpec = describeConversionGoal(objetivoConversao, linkDestino);

  const prompt = `Você é um roteirista sênior de YouTube, diretor de screencast e designer instrucional criando material oficial para o administrador da plataforma Artigen.

DOCUMENTAÇÃO REAL E COMPLETA DO SISTEMA (use exclusivamente estes fatos, rotas, botões, preços e regras — NUNCA invente botões ou recursos que não existam):
"""
${llmsDoc}
"""

OBJETIVO DESTA GERAÇÃO:
- Modo: ${
    modo === "curso_modulo"
      ? "MÓDULO DE CURSO BEM ROTEIRIZADO PARA YOUTUBE (explicando exatamente como o sistema funciona na prática, tela por tela)"
      : "VÍDEO DE CAPTAÇÃO DE LEADS E TRÁFEGO NO YOUTUBE (apresentar dor real -> demonstração em gravação de tela -> convite forte para acessar o site)"
  }
${
  moduleBlueprint
    ? `- Módulo Oficial Selecionado: Módulo ${moduleBlueprint.numero} — ${moduleBlueprint.titulo}\n- Foco de tela sugerido: ${moduleBlueprint.focoTela}\n- Objetivo pedagógico: ${moduleBlueprint.objetivo}`
    : ""
}
- Tema / Título de trabalho: "${tituloBase}"
- Idioma da locução e do texto: ${idioma}
- Estilo / Tom da fala: ${tomLocucao}
- Duração alvo: ${durSpec.label} (${durSpec.wordRange}, dividido em ${durSpec.sceneRange})
- Meta de conversão / Captação de leads: ${convSpec}
${input.notasAdmin?.trim() ? `- Instruções adicionais do administrador: ${input.notasAdmin.trim()}` : ""}

REGRAS CRÍTICAS DE QUALIDADE DO ROTEIRO:
1. Cada cena em "cenasGravacao" representa um trecho cronológico da gravação de tela:
   - "ordem": número inteiro sequencial (1, 2, 3...).
   - "tempoEstimado": faixa clara (ex.: "0:00 - 0:25").
   - "telaRota": qual página/aba/painel exato o administrador deve abrir no navegador (ex.: "/studio -> Painel esquerdo -> Links de Referência").
   - "acaoNaTela": o movimento exato do cursor, preenchimento ou clique a ser gravado na tela.
   - "locucao": texto exato que será falado durante essa cena.
2. "textoNarracaoPuro" DEVE ser a junção fluida, contínua e natural de TODA a fala do vídeo ("hookInicial" + todas as locuções das cenas em sequência contínua), escrita em parágrafos limpos para ser colada diretamente em um modelo de IA de geração de áudio (TTS):
   - PROIBIDO incluir colchetes [...], parênteses de direção cênica, marcações Markdown (#, **, *), bullet points ou timestamps dentro de "textoNarracaoPuro".
   - Use pontuação natural (vírgulas, pontos, pausas naturais) para que a voz sintética respire e soe humana.
   - Ao citar o site na fala, diga de forma natural (ex.: "acesse o link na descrição para testar no site do Artigen").
3. O vídeo precisa funcionar como canal de aquisição de leads no YouTube:
   - Hook inicial forte prendendo a atenção nos primeiros segundos.
   - Demonstração visual honesta e precisa de como o Artigen resolve o problema.
   - CTA claro no meio/final levando o espectador a clicar no link da descrição (${linkDestino}) e conhecer o site.
4. No "pacoteYoutube":
   - "titulosYoutube": 3 variações fortes de título para YouTube (atraentes e otimizadas para busca).
   - "descricaoYoutube": descrição pronta para YouTube contendo resumo, capítulos baseados nas cenas e chamada clara com o link ${linkDestino}.
   - "comentarioFixado": comentário pronto para fixar no topo do vídeo convidando a acessar o site.
   - "tagsYoutube": 8 a 12 tags relevantes para YouTube SEO.

Responda APENAS com JSON válido seguindo o schema.`;

  const result = await generateArticleText(prompt, {
    responseSchema: SCRIPT_SCHEMA,
  });

  const jsonMatch = result.text.match(/\{[\s\S]*\}/)?.[0];
  if (!jsonMatch) {
    throw new Error(
      "O modelo não retornou um roteiro estruturado válido. Tente novamente."
    );
  }

  const parsed = JSON.parse(jsonMatch) as Partial<GeneratedYoutubeScript>;

  const cenasRaw = Array.isArray(parsed.cenasGravacao)
    ? parsed.cenasGravacao
    : [];
  const cenasGravacao: ScriptSceneCue[] = cenasRaw.map((cena, idx) => ({
    ordem:
      typeof cena?.ordem === "number" && Number.isFinite(cena.ordem)
        ? cena.ordem
        : idx + 1,
    tempoEstimado:
      typeof cena?.tempoEstimado === "string" && cena.tempoEstimado.trim()
        ? cena.tempoEstimado.trim()
        : `Cena ${idx + 1}`,
    telaRota:
      typeof cena?.telaRota === "string" && cena.telaRota.trim()
        ? cena.telaRota.trim()
        : "/studio",
    acaoNaTela:
      typeof cena?.acaoNaTela === "string" && cena.acaoNaTela.trim()
        ? cena.acaoNaTela.trim()
        : "Mostrar painel correspondente na tela",
    locucao: sanitizeForTtsNarration(
      typeof cena?.locucao === "string" ? cena.locucao : ""
    ),
  }));

  const rawNarracao =
    typeof parsed.textoNarracaoPuro === "string" &&
    parsed.textoNarracaoPuro.trim()
      ? parsed.textoNarracaoPuro
      : cenasGravacao
          .map((c) => c.locucao)
          .filter(Boolean)
          .join("\n\n");

  const textoNarracaoPuro = sanitizeForTtsNarration(rawNarracao);

  return {
    id: `scr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    modo,
    numeroModulo:
      modo === "curso_modulo"
        ? input.numeroModulo ?? moduleBlueprint?.numero
        : undefined,
    tituloModulo:
      typeof parsed.tituloModulo === "string" && parsed.tituloModulo.trim()
        ? parsed.tituloModulo.trim()
        : tituloBase,
    resumoAula:
      typeof parsed.resumoAula === "string" ? parsed.resumoAula.trim() : "",
    hookInicial:
      typeof parsed.hookInicial === "string"
        ? sanitizeForTtsNarration(parsed.hookInicial)
        : "",
    cenasGravacao,
    textoNarracaoPuro,
    titulosYoutube: Array.isArray(parsed.titulosYoutube)
      ? parsed.titulosYoutube
          .filter((t): t is string => typeof t === "string" && Boolean(t.trim()))
          .slice(0, 5)
      : [tituloBase],
    descricaoYoutube:
      typeof parsed.descricaoYoutube === "string"
        ? parsed.descricaoYoutube.trim()
        : "",
    comentarioFixado:
      typeof parsed.comentarioFixado === "string"
        ? parsed.comentarioFixado.trim()
        : "",
    tagsYoutube: Array.isArray(parsed.tagsYoutube)
      ? parsed.tagsYoutube
          .filter((t): t is string => typeof t === "string" && Boolean(t.trim()))
          .slice(0, 15)
      : ["artigen", "gerador de artigos", "blog com ia"],
    idioma,
    duracao,
    criadoEm: new Date().toISOString(),
    modeloTexto: result.modelo,
  };
}

function extractWavPcmPayload(wavBuffer: Buffer): {
  header: Buffer;
  pcmData: Buffer;
} {
  if (
    wavBuffer.length >= 44 &&
    wavBuffer.toString("ascii", 0, 4) === "RIFF" &&
    wavBuffer.toString("ascii", 8, 12) === "WAVE"
  ) {
    let offset = 12;
    while (offset + 8 <= wavBuffer.length) {
      const subchunkId = wavBuffer.toString("ascii", offset, offset + 4);
      const subchunkSize = wavBuffer.readUInt32LE(offset + 4);
      const dataStart = offset + 8;
      if (subchunkId === "data") {
        const safeEnd = Math.min(wavBuffer.length, dataStart + subchunkSize);
        return {
          header: wavBuffer.subarray(0, dataStart),
          pcmData: wavBuffer.subarray(dataStart, safeEnd),
        };
      }
      offset = dataStart + subchunkSize + (subchunkSize % 2);
    }
    return {
      header: wavBuffer.subarray(0, 44),
      pcmData: wavBuffer.subarray(44),
    };
  }

  const fallbackHeader = Buffer.alloc(44);
  fallbackHeader.write("RIFF", 0);
  fallbackHeader.writeUInt32LE(36 + wavBuffer.length, 4);
  fallbackHeader.write("WAVE", 8);
  fallbackHeader.write("fmt ", 12);
  fallbackHeader.writeUInt32LE(16, 16);
  fallbackHeader.writeUInt16LE(1, 20);
  fallbackHeader.writeUInt16LE(1, 22);
  fallbackHeader.writeUInt32LE(24000, 24);
  fallbackHeader.writeUInt32LE(48000, 28);
  fallbackHeader.writeUInt16LE(2, 32);
  fallbackHeader.writeUInt16LE(16, 34);
  fallbackHeader.write("data", 36);
  fallbackHeader.writeUInt32LE(wavBuffer.length, 40);
  return {
    header: fallbackHeader,
    pcmData: wavBuffer,
  };
}

export function mergeWavBuffers(wavBuffers: Buffer[]): Buffer {
  if (wavBuffers.length === 0) {
    throw new Error("Nenhum segmento de áudio foi retornado pelo Google TTS.");
  }
  if (wavBuffers.length === 1) {
    const { header, pcmData } = extractWavPcmPayload(wavBuffers[0]);
    if (header.length >= 44) {
      const copy = Buffer.from(header);
      copy.writeUInt32LE(copy.length - 8 + pcmData.length, 4);
      copy.writeUInt32LE(pcmData.length, copy.length - 4);
      return Buffer.concat([copy, pcmData]);
    }
    return wavBuffers[0];
  }

  const parsed = wavBuffers.map(extractWavPcmPayload);
  const baseHeader = Buffer.from(parsed[0].header);
  const pcmParts = parsed.map((p) => p.pcmData);
  const totalPcmLength = pcmParts.reduce((acc, buf) => acc + buf.length, 0);

  if (
    baseHeader.length >= 44 &&
    baseHeader.toString("ascii", 0, 4) === "RIFF"
  ) {
    baseHeader.writeUInt32LE(baseHeader.length - 8 + totalPcmLength, 4);
    baseHeader.writeUInt32LE(totalPcmLength, baseHeader.length - 4);
  }

  return Buffer.concat([baseHeader, ...pcmParts]);
}

export type SynthesizeTtsResult = {
  audioBase64: string;
  mimeType: "audio/wav";
  chunksCount: number;
  model: GeminiTtsModelId;
  voiceName: GeminiTtsVoiceName;
  durationApproxSeconds: number;
};

export async function synthesizeScriptSpeechWithGoogle(params: {
  text: string;
  voiceName?: GeminiTtsVoiceName;
  model?: GeminiTtsModelId;
  styleInstruction?: string;
}): Promise<SynthesizeTtsResult> {
  const voiceName: GeminiTtsVoiceName = GEMINI_TTS_VOICES.some(
    (v) => v.id === params.voiceName
  )
    ? (params.voiceName as GeminiTtsVoiceName)
    : "Kore";

  const model: GeminiTtsModelId =
    params.model === "gemini-3.8-flash-tts"
      ? "gemini-3.8-flash-tts"
      : "gemini-3.8-flash-lite-tts";

  const chunks = splitTextForTts(params.text, 1200);
  if (chunks.length === 0) {
    throw new Error("Informe um texto de roteiro válido para gerar o áudio.");
  }

  const ai = getGeminiClient();
  const style = params.styleInstruction?.trim() || "";
  const clipBuffers: Buffer[] = [];

  for (const chunkText of chunks) {
    try {
      const partPayload = style
        ? {
            text: chunkText,
            speechMetadata: {
              style,
            },
          }
        : { text: chunkText };

      const response = await ai.models.generateContent({
        model,
        contents: [
          {
            role: "user",
            parts: [partPayload],
          },
        ],
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
          },
        },
      });

      const parts = response.candidates?.[0]?.content?.parts ?? [];
      const audioPart = parts.find(
        (p) =>
          typeof p?.inlineData?.data === "string" &&
          p.inlineData.data.length > 0
      );
      const base64Audio = audioPart?.inlineData?.data;

      if (!base64Audio) {
        throw new Error(
          `O modelo ${model} não retornou dados de áudio para o bloco do roteiro.`
        );
      }

      clipBuffers.push(Buffer.from(base64Audio, "base64"));
    } catch (err) {
      throw formatGeminiError(err);
    }
  }

  const combinedWav = mergeWavBuffers(clipBuffers);
  const { pcmData } = extractWavPcmPayload(combinedWav);
  const durationApproxSeconds = Math.max(
    1,
    Math.round(pcmData.length / 48000)
  );

  return {
    audioBase64: combinedWav.toString("base64"),
    mimeType: "audio/wav",
    chunksCount: chunks.length,
    model,
    voiceName,
    durationApproxSeconds,
  };
}
