import { NextResponse } from "next/server";
import { gerarImagem, MODELO_IMAGEM } from "@/lib/openrouter";

// Estilo fixo no início de todos os prompts para as imagens parecerem do mesmo conjunto.
const ESTILO =
  "Flat editorial illustration, muted teal and sand palette, clean composition, no text, no letters. ";

const NVIDIA_INVOKE_URL =
  "https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.2-klein-4b";

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
  // Raw base64 image payload
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
    // Prioritise known image keys first
    for (const key of Object.keys(obj)) {
      if (IMAGE_KEYS.has(key.toLowerCase())) {
        const val = obj[key];
        if (typeof val === "string" && isLikelyImagePayload(val)) {
          return val;
        }
      }
    }
    // Recurse into nested objects/arrays
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

async function gerarImagemOpenRouter(prompt: string): Promise<string> {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY não configurada.");
  }

  const result = await gerarImagem({
    model: MODELO_IMAGEM,
    prompt,
  });

  const image = result.data?.[0];
  const raw = image?.b64_json || image?.url || findImageInPayload(result);
  if (!raw) throw new Error("O modelo do OpenRouter não devolveu nenhuma imagem.");
  return toImageDataUri(raw);
}

async function gerarImagemNvidia(prompt: string): Promise<string> {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    throw new Error("NVIDIA_API_KEY não configurada.");
  }

  const response = await fetch(NVIDIA_INVOKE_URL, {
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
    Array.isArray((responseBody as { artifacts?: Array<{ finishReason?: string }> }).artifacts)
      ? (responseBody as { artifacts?: Array<{ finishReason?: string }> }).artifacts?.[0]
          ?.finishReason
      : undefined;

  throw new Error(
    `A API da NVIDIA não devolveu nenhuma imagem${
      finishReason ? ` (finishReason: ${finishReason})` : ""
    }${keys ? ` [chaves: ${keys}]` : ""}.`
  );
}

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();
    const promptCompleto = ESTILO + prompt;

    try {
      const url = await gerarImagemOpenRouter(promptCompleto);
      return NextResponse.json({ url, provedor: "openrouter" });
    } catch (openRouterErro) {
      if (!process.env.NVIDIA_API_KEY) {
        throw openRouterErro;
      }
      try {
        const url = await gerarImagemNvidia(promptCompleto);
        return NextResponse.json({ url, provedor: "nvidia" });
      } catch (nvidiaErro) {
        throw new Error(
          `OpenRouter falhou (${(openRouterErro as Error).message}); fallback NVIDIA falhou (${(nvidiaErro as Error).message})`
        );
      }
    }
  } catch (e) {
    return NextResponse.json({ erro: (e as Error).message }, { status: 500 });
  }
}
