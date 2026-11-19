import { NextResponse } from "next/server";
import { gerarImagem, MODELO_IMAGEM } from "@/lib/openrouter";

// Estilo fixo no início de todos os prompts para as imagens parecerem do mesmo conjunto.
const ESTILO =
  "Flat editorial illustration, muted teal and sand palette, clean composition, no text, no letters. ";

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();

    const result = await gerarImagem({
      model: MODELO_IMAGEM,
      prompt: ESTILO + prompt,
    });

    const image = result.data?.[0];
    const url = image?.b64_json
      ? image.b64_json.startsWith("data:")
        ? image.b64_json
        : `data:image/png;base64,${image.b64_json}`
      : image?.url;

    if (!url) throw new Error("O modelo não devolveu nenhuma imagem.");

    return NextResponse.json({ url });
  } catch (e) {
    return NextResponse.json({ erro: (e as Error).message }, { status: 500 });
  }
}
