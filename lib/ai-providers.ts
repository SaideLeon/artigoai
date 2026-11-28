import { GoogleGenAI, type Schema } from "@google/genai";
import type { PlanoGeracao } from "@/lib/types";

// Geração de texto gratuita com Google Gemini (modelos 3.5/3.1 gratuitos — sem usar modelos pagos da série 4)
export const GEMINI_TEXT_MODEL =
  process.env.GEMINI_TEXT_MODEL?.trim() || "gemini-3.5-flash-lite";
export const GEMINI_TEXT_FALLBACK_MODEL = "gemini-3.1-flash-lite";
export const GEMINI_TEXT_CANDIDATE_MODELS = Array.from(
  new Set([GEMINI_TEXT_MODEL, GEMINI_TEXT_FALLBACK_MODEL, "gemini-3.5-flash"])
);

// Pesquisa na web gratuita com Google Search grounding (sem modelos 2.5 descontinuados nem série 4)
export const GEMINI_RESEARCH_MODEL =
  process.env.GEMINI_RESEARCH_MODEL?.trim() || "gemini-3.5-flash-lite";
export const GEMINI_RESEARCH_FALLBACK_MODEL = "gemini-3.5-flash";
export const GEMINI_RESEARCH_CANDIDATE_MODELS = Array.from(
  new Set([
    GEMINI_RESEARCH_MODEL,
    GEMINI_RESEARCH_FALLBACK_MODEL,
    "gemini-3.1-flash-lite",
  ])
);

// Geração de imagem via NVIDIA NIM (black-forest-labs/flux-3-image-klein)
export const NVIDIA_IMAGE_URL =
  process.env.NVIDIA_IMAGE_URL?.trim() ||
  "https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux-3-image-klein";
export const NVIDIA_IMAGE_MODEL =
  process.env.NVIDIA_IMAGE_MODEL?.trim() ||
  "black-forest-labs/flux-3-image-klein";
export const NVIDIA_IMAGE_STEPS = (() => {
  const parsed = Number(process.env.NVIDIA_IMAGE_STEPS ?? "50");
  return Number.isFinite(parsed) && parsed >= 1 && parsed <= 100
    ? Math.round(parsed)
    : 50;
})();

// Transcrição de áudio (Whisper via Groq)
export const GROQ_RESEARCH_MODEL =
  process.env.GROQ_RESEARCH_MODEL?.trim() || "openai/gpt-oss-120b";

export function normalizePlano(raw: unknown): PlanoGeracao {
  return raw === "paid" ? "paid" : "free";
}

export function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY não configurada no servidor para geração de texto e pesquisa na web com Gemini gratuito."
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

function extractReadableGeminiMessage(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as {
        error?: { message?: string; code?: number; status?: string };
        message?: string;
      };
      if (parsed?.error?.message) {
        return parsed.error.message;
      }
      if (parsed?.message) {
        return parsed.message;
      }
    } catch {
      // segue com texto bruto
    }
  }
  return trimmed;
}

export function formatGeminiError(error: unknown): Error {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  const readable = extractReadableGeminiMessage(raw);
  const lower = readable.toLowerCase();

  if (
    lower.includes("permission_denied") ||
    lower.includes("api_key_invalid") ||
    lower.includes("api key") ||
    lower.includes("403")
  ) {
    return new Error(
      `Falha de autenticação ou permissão na API Gemini (${readable}). Verifique sua GEMINI_API_KEY nas variáveis de ambiente do servidor.`
    );
  }

  if (
    lower.includes("not_found") ||
    lower.includes("no longer available") ||
    lower.includes("404")
  ) {
    return new Error(
      `Modelo Gemini indisponível ou descontinuado para esta chave (${readable}).`
    );
  }

  if (
    lower.includes("resource_exhausted") ||
    lower.includes("429") ||
    lower.includes("quota") ||
    lower.includes("billing")
  ) {
    return new Error(
      `Limite diário ou cota excedida na API Gemini (${readable}). Tente novamente em alguns instantes ou verifique sua GEMINI_API_KEY.`
    );
  }

  return new Error(readable || "Erro na API Gemini.");
}

export function stripReasoningTags(rawText: string): string {
  return rawText.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

export type ArticleTextGenerationResult = {
  text: string;
  provedor: "gemini";
  modelo: string;
};

/**
 * Gera texto de artigos (esboço, seções, sugestões e organização de narração)
 * usando modelos gratuitos do Google Gemini (gemini-3.5-flash-lite, gemini-3.1-flash-lite, gemini-3.5-flash).
 */
export async function generateArticleText(
  prompt: string,
  options?: {
    responseSchema?: Schema;
    systemInstruction?: string;
    tentativas?: number;
    inlineImages?: Array<{ mimeType: string; data: string }>;
  }
): Promise<ArticleTextGenerationResult> {
  const ai = getGeminiClient();
  const candidateModels = GEMINI_TEXT_CANDIDATE_MODELS;

  const config: Record<string, unknown> = {};
  if (options?.systemInstruction?.trim()) {
    config.systemInstruction = options.systemInstruction.trim();
  }
  if (options?.responseSchema) {
    config.responseMimeType = "application/json";
    config.responseSchema = options.responseSchema;
  }

  const contents =
    options?.inlineImages && options.inlineImages.length > 0
      ? {
          parts: [
            ...options.inlineImages.map((img) => ({
              inlineData: {
                mimeType: img.mimeType,
                data: img.data,
              },
            })),
            { text: prompt },
          ],
        }
      : prompt;

  let lastError: unknown = null;

  for (const modelName of candidateModels) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents,
        ...(Object.keys(config).length > 0 ? { config } : {}),
      });

      const text = stripReasoningTags(response.text?.trim() ?? "");
      if (!text) {
        throw new Error(
          `O modelo Gemini (${modelName}) retornou uma resposta vazia.`
        );
      }

      return {
        text,
        provedor: "gemini",
        modelo: modelName,
      };
    } catch (err) {
      lastError = err;
    }
  }

  throw formatGeminiError(lastError);
}

/**
 * Aliases mantidos para compatibilidade: toda geração de texto usa Gemini gratuito.
 */
export async function generateFreeText(
  prompt: string,
  tentativas = 3
): Promise<ArticleTextGenerationResult> {
  return generateArticleText(prompt, { tentativas });
}

export async function generatePaidGeminiText(
  prompt: string,
  options?: {
    responseSchema?: Schema;
    systemInstruction?: string;
  }
): Promise<ArticleTextGenerationResult> {
  return generateArticleText(prompt, options);
}
