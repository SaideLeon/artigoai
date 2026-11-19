import { NextResponse } from "next/server";
import { chat, MODELO_IMAGEM } from "@/lib/openrouter";

// Estilo fixo no início de todos os prompts para as imagens parecerem do mesmo conjunto.
const ESTILO =
  "Flat editorial illustration, muted teal and sand palette, clean composition, no text, no letters. ";

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();

    const data = await chat({
      model: MODELO_IMAGEM,
      messages: [{ role: "user", content: ESTILO + prompt }],
      modalities: ["image", "text"],
    });

    const url = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!url) throw new Error("O modelo não devolveu nenhuma imagem.");

    return NextResponse.json({ url });
  } catch (e) {
    return NextResponse.json({ erro: (e as Error).message }, { status: 500 });
  }
}
