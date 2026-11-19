import { NextResponse } from "next/server";
import { chat, MODELO_TEXTO } from "@/lib/openrouter";

export async function POST(req: Request) {
  try {
    const { tema, secoes = 7 } = await req.json();

    const data = await chat({
      model: MODELO_TEXTO,
      messages: [
        {
          role: "user",
          content: `Cria o esboço de um artigo em português sobre: "${tema}".
Responde APENAS com JSON válido, sem texto antes ou depois, neste formato:
{"titulo": "...", "secoes": [{"titulo": "...", "objetivo": "o que esta secção deve explicar, numa frase"}]}
O artigo deve ter exactamente ${secoes} secções.`,
        },
      ],
    });

    const bruto: string = data.choices[0].message.content ?? "";
    const json = bruto.match(/\{[\s\S]*\}/)?.[0];
    if (!json) throw new Error("O modelo não devolveu um esboço válido. Tenta de novo.");

    const esboco = JSON.parse(json);
    if (!esboco.titulo || !Array.isArray(esboco.secoes))
      throw new Error("Esboço incompleto. Tenta de novo.");

    return NextResponse.json(esboco);
  } catch (e) {
    return NextResponse.json({ erro: (e as Error).message }, { status: 500 });
  }
}
