import { GoogleGenAI, type Schema } from "@google/genai";
import { Groq } from "groq-sdk";
import type { PlanoGeracao } from "@/lib/types";

export const GEMINI_TEXT_MODEL =
  process.env.GEMINI_TEXT_MODEL || "gemini-4-hydrogen";
export const GEMINI_IMAGE_MODEL =
  process.env.GEMINI_IMAGE_MODEL || "gemini-nano-banana-2.1";

export const GROQ_TEXT_MODEL =
  process.env.GROQ_TEXT_MODEL || "llama-3.3-70b-versatile";
export const GROQ_RESEARCH_MODEL =
  process.env.GROQ_RESEARCH_MODEL || "openai/gpt-oss-120b";

export const NVIDIA_TEXT_MODEL =
  process.env.NVIDIA_TEXT_MODEL || "meta/llama-3.3-70b-instruct";
export const NVIDIA_CHAT_URL =
  "https://integrate.api.nvidia.com/v1/chat/completions";
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

  return error instanceof Error ? error : new Error(raw || "Erro na API Gemini.");
}

async function callGroqText(prompt: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("GROQ_API_KEY não configurada.");
  }

  const groq = new Groq({ apiKey });
  const completion = await groq.chat.completions.create({
    model: GROQ_TEXT_MODEL,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7,
    max_completion_tokens: 4096,
  });

  const text = completion.choices?.[0]?.message?.content?.trim();
  if (!text) {
    throw new Error("O modelo da Groq retornou uma resposta vazia.");
  }
  return text;
}

async function callNvidiaText(prompt: string): Promise<string> {
  const apiKey = process.env.NVIDIA_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("NVIDIA_API_KEY não configurada.");
  }

  const response = await fetch(NVIDIA_CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: NVIDIA_TEXT_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(
      `Falha na NVIDIA (${response.status}): ${errText.slice(0, 240)}`
    );
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) {
    throw new Error("O modelo da NVIDIA retornou uma resposta vazia.");
  }
  return text;
}

/**
 * Plano gratuito: usa APENAS modelos hospedados na Groq ou NVIDIA.
 */
export async function generateFreeText(prompt: string): Promise<{
  text: string;
  provedor: "groq" | "nvidia";
  modelo: string;
}> {
  const hasGroq = Boolean(process.env.GROQ_API_KEY?.trim());
  const hasNvidia = Boolean(process.env.NVIDIA_API_KEY?.trim());

  if (!hasGroq && !hasNvidia) {
    throw new Error(
      "Configure GROQ_API_KEY ou NVIDIA_API_KEY no servidor para gerar artigos no plano gratuito."
    );
  }

  if (hasGroq) {
    try {
      const text = await callGroqText(prompt);
      return { text, provedor: "groq", modelo: GROQ_TEXT_MODEL };
    } catch (groqErr) {
      if (!hasNvidia) throw groqErr;
      try {
        const text = await callNvidiaText(prompt);
        return { text, provedor: "nvidia", modelo: NVIDIA_TEXT_MODEL };
      } catch (nvidiaErr) {
        throw new Error(
          `Groq falhou (${(groqErr as Error).message}); fallback NVIDIA falhou (${(nvidiaErr as Error).message})`
        );
      }
    }
  }

  const text = await callNvidiaText(prompt);
  return { text, provedor: "nvidia", modelo: NVIDIA_TEXT_MODEL };
}

/**
 * Plano pago: usa APENAS modelos Google Gemini via @google/genai.
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
