import { NextResponse } from "next/server";
import {
  formatGeminiError,
  GEMINI_IMAGE_MODEL,
  getGeminiClient,
  normalizePlano,
  NVIDIA_IMAGE_URL,
} from "@/lib/ai-providers";
import {
  attachGuestQuotaCookie,
  enforceGenerationQuota,
} from "@/lib/usage-enforcement";

// Estilo fixo no início de todos os prompts para as imagens parecerem do mesmo conjunto.
const ESTILO =
  "Flat editorial illustration, muted teal and sand palette, clean composition, no text, no letters. ";

function toImageDataUri(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("data:") || /^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  const mime = trimmed.startsWith("/9j/")
    ? "image/jpeg"
    : trimmed.startsWith("UklGR")
    ? "image/webp"
    : "image/png";
  return `data:${mime};base64,${trimmed}`;
}

function isLikelyImagePayload(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.startsWith("data:image/")) return true;
  if (/^https?:\/\/\S+/i.test(trimmed)) return true;
  return trimmed.length >= 128 && /^[A-Za-z0-9+/=_\r\n-]+$/.test(trimmed);
}

const IMAGE_KEYS = new Set([
  "base64",
  "b64_json",
  "image_data",
  "image",
  "url",
  "image_url",
  "src",
  "data",
  "output",
]);

function findImageInPayload(node: unknown, depth = 0): string | null {
  if (depth > 6 || node == null) return null;

  if (typeof node === "string") {
    return isLikelyImagePayload(node) ? node : null;
  }

  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findImageInPayload(item, depth + 1);
      if (found) return found;
    }
    return null;
  }

  if (typeof node === "object") {
    const obj = node as Record<string, unknown>;
    for (const key of Object.keys(obj)) {
      if (IMAGE_KEYS.has(key.toLowerCase())) {
        const val = obj[key];
        if (typeof val === "string" && isLikelyImagePayload(val)) {
          return val;
        }
      }
    }
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (val && typeof val === "object") {
        const found = findImageInPayload(val, depth + 1);
        if (found) return found;
      }
    }
  }

  return null;
}

/**
 * Plano gratuito: gera imagens exclusivamente com modelo NVIDIA (FLUX.2 Klein 4B).
 */
async function gerarImagemNvidia(prompt: string): Promise<string> {
  const apiKey = process.env.NVIDIA_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "NVIDIA_API_KEY não configurada no servidor para gerar imagens no plano gratuito."
    );
  }

  const response = await fetch(NVIDIA_IMAGE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt,
      width: 1024,
      height: 1024,
      steps: 4,
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(
      `Falha na NVIDIA (${response.status}): ${errBody || "erro desconhecido"}`
    );
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.startsWith("image/")) {
    const buf = Buffer.from(await response.arrayBuffer());
    return `data:${contentType.split(";")[0]};base64,${buf.toString("base64")}`;
  }

  const rawText = await response.text();
  let responseBody: unknown = null;
  try {
    responseBody = JSON.parse(rawText);
  } catch {
    if (isLikelyImagePayload(rawText)) {
      return toImageDataUri(rawText);
    }
    throw new Error(
      `Resposta inesperada da NVIDIA (não JSON): ${rawText.slice(0, 180)}`
    );
  }

  const extracted = findImageInPayload(responseBody);
  if (extracted) {
    return toImageDataUri(extracted);
  }

  const keys =
    responseBody && typeof responseBody === "object"
      ? Object.keys(responseBody as Record<string, unknown>).join(", ")
      : typeof responseBody;
  const finishReason =
    responseBody &&
    typeof responseBody === "object" &&
    "artifacts" in responseBody &&
    Array.isArray(
      (responseBody as { artifacts?: Array<{ finishReason?: string }> })
        .artifacts
    )
      ? (responseBody as { artifacts?: Array<{ finishReason?: string }> })
          .artifacts?.[0]?.finishReason
      : undefined;

  throw new Error(
    `A API da NVIDIA não devolveu nenhuma imagem${
      finishReason ? ` (finishReason: ${finishReason})` : ""
    }${keys ? ` [chaves: ${keys}]` : ""}.`
  );
}

/**
 * Plano pago: gera imagens exclusivamente com Google Gemini (Nano Banana 2.1).
 */
async function gerarImagemGemini(prompt: string): Promise<string> {
  const ai = getGeminiClient();

  try {
    const response = await ai.models.generateContent({
      model: GEMINI_IMAGE_MODEL,
      contents: {
        parts: [{ text: prompt }],
      },
      config: {
        imageConfig: {
          aspectRatio: "16:9",
          imageSize: "1K",
        },
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts ?? []) {
      if (part.inlineData?.data) {
        const mime = part.inlineData.mimeType ?? "image/png";
        return `data:${mime};base64,${part.inlineData.data}`;
      }
    }

    throw new Error("O modelo Gemini de imagem não devolveu nenhuma imagem.");
  } catch (err) {
    throw formatGeminiError(err);
  }
}

export async function POST(req: Request) {
  try {
    const { prompt, plano: rawPlano, sessionKey, articleId } = await req.json();
    const requestedPlano = normalizePlano(rawPlano);
    const resolvedSessionKey =
      typeof sessionKey === "string" && sessionKey.trim()
        ? sessionKey
        : typeof articleId === "string" && articleId.trim()
        ? articleId
        : undefined;

    const quotaDecision = await enforceGenerationQuota({
      req,
      requestedPlano,
      action: "image",
      sessionKey: resolvedSessionKey,
    });

    if (!quotaDecision.allowed) {
      return NextResponse.json(
        {
          erro: quotaDecision.error,
          code: quotaDecision.code,
          quota: quotaDecision.snapshot,
        },
        { status: quotaDecision.status }
      );
    }

    const plano = quotaDecision.effectivePlano;
    const promptCompleto = ESTILO + String(prompt ?? "");
    const quotaPayload = {
      deductedArticleCredit: Boolean(quotaDecision.deductedArticleCreditForImage),
      articleImagesUsed: quotaDecision.articleImagesUsed ?? 1,
      articleImagesAllowance: quotaDecision.articleImagesAllowance ?? 7,
      snapshot: quotaDecision.snapshot,
    };

    if (plano === "paid") {
      const url = await gerarImagemGemini(promptCompleto);
      const response = NextResponse.json({
        url,
        provedor: "gemini",
        modelo: GEMINI_IMAGE_MODEL,
        quota: quotaPayload,
      });
      return attachGuestQuotaCookie(
        response,
        quotaDecision.updatedGuestCookieValue
      );
    }

    const url = await gerarImagemNvidia(promptCompleto);
    const response = NextResponse.json({
      url,
      provedor: "nvidia",
      modelo: "black-forest-labs/flux.2-klein-4b",
      quota: quotaPayload,
    });
    return attachGuestQuotaCookie(
      response,
      quotaDecision.updatedGuestCookieValue
    );
  } catch (e) {
    return NextResponse.json({ erro: (e as Error).message }, { status: 500 });
  }
}
