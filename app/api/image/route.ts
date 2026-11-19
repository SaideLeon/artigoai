import { NextResponse } from "next/server";
import { gerarImagem, MODELO_IMAGEM } from "@/lib/openrouter";

// Estilo fixo no início de todos os prompts para as imagens parecerem do mesmo conjunto.
const ESTILO =
  "Flat editorial illustration, muted teal and sand palette, clean composition, no text, no letters. ";

const NVIDIA_INVOKE_URL =
  "https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.2-klein-4b";

function toImageDataUri(raw: string): string {
  if (raw.startsWith("data:") || /^https?:\/\//i.test(raw)) return raw;
  const mime = raw.startsWith("/9j/")
    ? "image/jpeg"
    : raw.startsWith("UklGR")
    ? "image/webp"
    : "image/png";
  return `data:${mime};base64,${raw}`;
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
  const raw = image?.b64_json || image?.url;
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

  const responseBody = await response.json();
  const raw =
    responseBody?.artifacts?.[0]?.base64 ||
    responseBody?.image ||
    responseBody?.data?.[0]?.b64_json ||
    responseBody?.data?.[0]?.url;

  if (!raw || typeof raw !== "string") {
    throw new Error("A API da NVIDIA não devolveu nenhuma imagem.");
  }

  return toImageDataUri(raw);
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
