import { GoogleGenAI, type Schema } from "@google/genai";
import type { PlanoGeracao } from "@/lib/types";

export const GEMINI_TEXT_MODEL =
  process.env.GEMINI_TEXT_MODEL || "gemini-4-hydrogen";
export const GEMINI_IMAGE_MODEL =
  process.env.GEMINI_IMAGE_MODEL || "gemini-nano-banana-2.1";

export const OPENROUTER_CHAT_URL =
  "https://openrouter.ai/api/v1/chat/completions";
export const OPENROUTER_TEXT_MODEL =
  process.env.OPENROUTER_TEXT_MODEL ||
  process.env.TEXT_MODEL ||
  "openrouter/free";

export const GROQ_RESEARCH_MODEL =
  process.env.GROQ_RESEARCH_MODEL || "openai/gpt-oss-120b";

export const NVIDIA_IMAGE_URL =
  "https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.2-klein-4b";

export function normalizePlano(raw: unknown): PlanoGeracao {
  return raw === "paid" ? "paid" : "free";
}

export function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY não configurada. Para usar o plano pago com modelos Google Gemini, configure sua chave em Settings > Secrets."
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

export function formatGeminiError(error: unknown): Error {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  const lower = raw.toLowerCase();

  if (
    lower.includes("permission_denied") ||
    lower.includes("api_key_invalid") ||
    lower.includes("api key") ||
    lower.includes("403")
  ) {
    return new Error(
      `Falha de autenticação ou permissão na API Gemini (${raw}). Verifique sua GEMINI_API_KEY em Settings > Secrets.`
    );
  }

  if (
    lower.includes("resource_exhausted") ||
    lower.includes("429") ||
    lower.includes("quota") ||
    lower.includes("billing")
  ) {
    return new Error(
      `Limite ou faturamento necessário na API Gemini (${raw}). Este modelo pago requer uma chave GEMINI_API_KEY com faturamento ativo em Settings > Secrets.`
    );
  }

  return error instanceof Error
    ? error
    : new Error(raw || "Erro na API Gemini.");
}

/**
 * Plano gratuito (texto): usa EXCLUSIVAMENTE OpenRouter.
 */
export async function generateFreeText(
  prompt: string,
  tentativas = 3
): Promise<{
  text: string;
  provedor: "openrouter";
  modelo: string;
}> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "OPENROUTER_API_KEY não configurada no servidor para gerar texto no plano gratuito."
    );
  }

  for (let i = 0; i < tentativas; i++) {
    const response = await fetch(OPENROUTER_CHAT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENROUTER_TEXT_MODEL,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (response.status === 429 && i < tentativas - 1) {
      await new Promise((resolve) => setTimeout(resolve, 4000 * (i + 1)));
      continue;
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message?: string };
    };

    if (!response.ok) {
      throw new Error(
        data?.error?.message ?? `Erro no OpenRouter (${response.status})`
      );
    }

    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) {
      throw new Error("O modelo do OpenRouter retornou uma resposta vazia.");
    }

    return { text, provedor: "openrouter", modelo: OPENROUTER_TEXT_MODEL };
  }

  throw new Error(
    "Limite de pedidos excedido no OpenRouter. Tenta novamente daqui a um minuto."
  );
}

/**
 * Plano pago (texto): usa EXCLUSIVAMENTE Google Gemini via @google/genai.
 */
export async function generatePaidGeminiText(
  prompt: string,
  options?: {
    responseSchema?: Schema;
    systemInstruction?: string;
  }
): Promise<{
  text: string;
  provedor: "gemini";
  modelo: string;
}> {
  const ai = getGeminiClient();

  try {
    const config: Record<string, unknown> = {};
    if (options?.systemInstruction) {
      config.systemInstruction = options.systemInstruction;
    }
    if (options?.responseSchema) {
      config.responseMimeType = "application/json";
      config.responseSchema = options.responseSchema;
    }

    const response = await ai.models.generateContent({
      model: GEMINI_TEXT_MODEL,
      contents: prompt,
      ...(Object.keys(config).length > 0 ? { config } : {}),
    });

    const text = response.text?.trim();
    if (!text) {
      throw new Error("O modelo Gemini retornou uma resposta vazia.");
    }

    return { text, provedor: "gemini", modelo: GEMINI_TEXT_MODEL };
  } catch (err) {
    throw formatGeminiError(err);
  }
}
