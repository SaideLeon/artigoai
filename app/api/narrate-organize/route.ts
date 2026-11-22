import { NextResponse } from "next/server";
import { Type, type Schema } from "@google/genai";
import {
  generateFreeText,
  generatePaidGeminiText,
  normalizePlano,
} from "@/lib/ai-providers";
import { TONS_TEXTO } from "@/lib/types";

const VALID_TONS = new Set<string>(TONS_TEXTO);

const ORGANIZE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    tema: { type: Type.STRING },
    descricao: { type: Type.STRING },
    palavrasChave: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    tom: { type: Type.STRING },
    narracaoOrganizada: { type: Type.STRING },
  },
  required: [
    "tema",
    "descricao",
    "palavrasChave",
    "tom",
    "narracaoOrganizada",
  ],
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      narracao?: string;
      idioma?: string;
      plano?: string;
      primeiraPessoa?: boolean;
    };

    const narracaoRaw = typeof body.narracao === "string" ? body.narracao.trim() : "";
    if (narracaoRaw.length < 10) {
      return NextResponse.json(
        { erro: "A narração é muito curta. Fale um pouco mais sobre o tema ou história." },
        { status: 400 }
      );
    }

    const narracao = narracaoRaw.slice(0, 24000);
    const idioma =
      typeof body.idioma === "string" && body.idioma.trim()
        ? body.idioma.trim()
        : "Português (Brasil)";
    const primeiraPessoa = body.primeiraPessoa ?? true;
    const plano = normalizePlano(body.plano);

    const prompt = `O utilizador gravou uma narração em áudio explicando com as suas próprias palavras o tema, ideias, factos ou história para transformar num artigo completo de blog em ${idioma}.

Transcrição da narração do utilizador:
"""
${narracao}
"""

A tua tarefa é revisar, melhorar a clareza e organizar esta explicação para servir de base ao artigo:
1. "tema": cria um título principal forte, natural e otimizado para SEO (máx. 95 caracteres) em ${idioma}.
2. "descricao": cria uma meta descrição envolvente (máx. 260 caracteres) em ${idioma}.
3. "palavrasChave": sugere 3 a 5 palavras-chave estratégicas relacionadas.
4. "tom": escolhe o melhor valor exato entre: ${TONS_TEXTO.join(" | ")}.
5. "narracaoOrganizada": reescreve e organiza os pontos da narração de forma clara e bem estruturada em parágrafos (mantendo TODOS os factos, experiências pessoais, opiniões e exemplos ditos pelo utilizador, apenas removendo vícios de fala, repetições e organizando a sequência lógica${
      primeiraPessoa
        ? ", mantendo o ponto de vista em primeira pessoa quando aplicável"
        : ", adaptando para uma abordagem informativa clara"
    }).

Responde APENAS com JSON válido (sem markdown nem texto extra) neste formato:
{
  "tema": "...",
  "descricao": "...",
  "palavrasChave": ["...", "..."],
  "tom": "...",
  "narracaoOrganizada": "..."
}`;

    const result =
      plano === "paid"
        ? await generatePaidGeminiText(prompt, {
            responseSchema: ORGANIZE_SCHEMA,
          })
        : await generateFreeText(prompt);

    const jsonMatch = result.text.match(/\{[\s\S]*\}/)?.[0];
    if (!jsonMatch) {
      throw new Error(
        "Não foi possível organizar a narração automaticamente. Tente novamente."
      );
    }

    const parsed = JSON.parse(jsonMatch) as {
      tema?: unknown;
      descricao?: unknown;
      palavrasChave?: unknown;
      tom?: unknown;
      narracaoOrganizada?: unknown;
    };

    const tema =
      typeof parsed.tema === "string" && parsed.tema.trim()
        ? parsed.tema.trim().slice(0, 100)
        : narracao.slice(0, 80).trim();

    const descricao =
      typeof parsed.descricao === "string"
        ? parsed.descricao.trim().slice(0, 300)
        : "";

    const palavrasChave = Array.isArray(parsed.palavrasChave)
      ? parsed.palavrasChave
          .filter((item): item is string => typeof item === "string")
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 6)
      : [];

    const tom =
      typeof parsed.tom === "string" && VALID_TONS.has(parsed.tom)
        ? parsed.tom
        : "Informativo e Didático";

    const narracaoOrganizada =
      typeof parsed.narracaoOrganizada === "string" &&
      parsed.narracaoOrganizada.trim()
        ? parsed.narracaoOrganizada.trim()
        : narracao;

    return NextResponse.json({
      tema,
      descricao,
      palavrasChave,
      tom,
      narracaoOrganizada,
      provedor: result.provedor,
      modelo: result.modelo,
    });
  } catch (e) {
    return NextResponse.json(
      {
        erro:
          e instanceof Error
            ? e.message
            : "Erro ao organizar e revisar a narração.",
      },
      { status: 500 }
    );
  }
}
