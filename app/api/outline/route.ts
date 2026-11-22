import { NextResponse } from "next/server";
import { Type, type Schema } from "@google/genai";
import {
  generateFreeText,
  generatePaidGeminiText,
  normalizePlano,
} from "@/lib/ai-providers";

const OUTLINE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    titulo: { type: Type.STRING },
    secoes: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          titulo: { type: Type.STRING },
          objetivo: { type: Type.STRING },
        },
        required: ["titulo", "objetivo"],
      },
    },
  },
  required: ["titulo", "secoes"],
};

export async function POST(req: Request) {
  try {
    const {
      tema,
      secoes = 7,
      descricao = "",
      palavrasChave = [],
      tom = "Informativo e Didático",
      idioma = "Português (Brasil)",
      primeiraPessoa = true,
      contextoPesquisa = "",
      contextoPrimario = "",
      narracao = "",
      plano: rawPlano,
    } = await req.json();

    const plano = normalizePlano(rawPlano);
    const narracaoLimpa =
      typeof narracao === "string" ? narracao.trim().slice(0, 16000) : "";
    const primarioLimpo =
      typeof contextoPrimario === "string" ? contextoPrimario.trim() : "";

    const extras = [
      descricao ? `Descrição/foco: "${descricao}".` : "",
      Array.isArray(palavrasChave) && palavrasChave.length > 0
        ? `Palavras-chave a integrar naturalmente: ${palavrasChave.join(", ")}.`
        : "",
      `Tom do texto: ${tom}.`,
      `Idioma do artigo: ${idioma}.`,
      primeiraPessoa
        ? `Perspectiva narrativa: estrutura o artigo em primeira pessoa do singular ("eu", "minha experiência", "o que aprendi").`
        : `Perspectiva narrativa: estrutura o artigo em terceira pessoa / forma impessoal, sem usar "eu" ou "meu".`,
      narracaoLimpa
        ? `\nNarração/explicação original do utilizador (usa esta história, argumentos, exemplos e ideias como espinha dorsal do artigo, melhorando a organização em secções lógicas e completas):\n"""\n${narracaoLimpa}\n"""`
        : "",
      primarioLimpo
        ? `\nREGRA DE PRIORIDADE ABSOLUTA — FONTES PRIMÁRIAS FORNECIDAS PELO UTILIZADOR:\nOs dados abaixo vieram diretamente dos links fornecidos pelo utilizador (trabalho original com a mão humana). Estrutura o título e as secções de modo que TODO o conteúdo destas fontes primárias seja o eixo central do artigo.\n${primarioLimpo}`
        : "",
      contextoPesquisa
        ? `\nContexto completo pesquisado (prioriza sempre os dados das fontes primárias do utilizador acima e usa eventuais fontes secundárias da web apenas como apoio complementar):\n${contextoPesquisa}`
        : "",
    ]
      .filter(Boolean)
      .join("\n");

    const prompt = `Cria o esboço de um artigo em ${idioma} sobre: "${tema}".
${extras}
Responde APENAS com JSON válido, sem texto antes ou depois, neste formato:
{"titulo": "...", "secoes": [{"titulo": "...", "objetivo": "o que esta secção deve explicar, numa frase"}]}
O artigo deve ter exactamente ${secoes} secções.`;

    const result =
      plano === "paid"
        ? await generatePaidGeminiText(prompt, {
            responseSchema: OUTLINE_SCHEMA,
          })
        : await generateFreeText(prompt);

    const json = result.text.match(/\{[\s\S]*\}/)?.[0];
    if (!json) {
      throw new Error(
        "O modelo não devolveu um esboço válido. Tenta de novo."
      );
    }

    const esboco = JSON.parse(json);
    if (!esboco.titulo || !Array.isArray(esboco.secoes)) {
      throw new Error("Esboço incompleto. Tenta de novo.");
    }

    return NextResponse.json({
      ...esboco,
      provedor: result.provedor,
      modelo: result.modelo,
    });
  } catch (e) {
    return NextResponse.json({ erro: (e as Error).message }, { status: 500 });
  }
}
