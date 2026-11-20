import { NextResponse } from "next/server";
import { Type, type Schema } from "@google/genai";
import {
  generateFreeText,
  generatePaidGeminiText,
  normalizePlano,
} from "@/lib/ai-providers";
import {
  FAIXAS_PALAVRAS,
  TONS_TEXTO,
  type FaixaPalavrasId,
  type ModoPesquisa,
} from "@/lib/types";

const VALID_TONS = new Set<string>(TONS_TEXTO);
const VALID_FAIXAS = new Set<string>(FAIXAS_PALAVRAS.map((f) => f.id));
const VALID_PESQUISA = new Set<ModoPesquisa>(["auto", "sempre", "desativada"]);

const SUGGEST_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    palavrasChave: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    descricao: { type: Type.STRING },
    tom: { type: Type.STRING },
    faixaPalavras: { type: Type.STRING },
    primeiraPessoa: { type: Type.BOOLEAN },
    pesquisaWeb: { type: Type.STRING },
  },
  required: [
    "palavrasChave",
    "descricao",
    "tom",
    "faixaPalavras",
    "primeiraPessoa",
    "pesquisaWeb",
  ],
};

export async function POST(req: Request) {
  try {
    const {
      tema,
      idioma = "Português (Brasil)",
      plano: rawPlano,
    }: { tema: string; idioma?: string; plano?: string } = await req.json();

    if (!tema || !tema.trim()) {
      return NextResponse.json(
        { erro: "Informe o tema ou título principal primeiro." },
        { status: 400 }
      );
    }

    const plano = normalizePlano(rawPlano);
    const prompt = `Com base apenas no título principal "${tema.trim()}" (idioma: ${idioma}), sugere as melhores configurações para gerar um artigo completo e bem posicionado em SEO.

Responde APENAS com JSON válido (sem texto antes ou depois) neste formato exato:
{
  "palavrasChave": ["palavra 1", "palavra 2", "palavra 3", "palavra 4"],
  "descricao": "Resumo claro e atrativo do que o artigo deve abordar, em no máximo 260 caracteres, no idioma ${idioma}.",
  "tom": "um dos valores exatos: ${TONS_TEXTO.join(" | ")}",
  "faixaPalavras": "um dos valores exatos: ${FAIXAS_PALAVRAS.map((f) => f.id).join(" | ")}",
  "primeiraPessoa": true,
  "pesquisaWeb": "auto ou sempre (usa sempre se for notícia, evento recente, dado técnico ou atualidade) ou desativada"
}`;

    const result =
      plano === "paid"
        ? await generatePaidGeminiText(prompt, {
            responseSchema: SUGGEST_SCHEMA,
          })
        : await generateFreeText(prompt);

    const jsonMatch = result.text.match(/\{[\s\S]*\}/)?.[0];
    if (!jsonMatch) {
      throw new Error("O modelo não devolveu sugestões válidas. Tenta de novo.");
    }

    const raw = JSON.parse(jsonMatch);

    const palavrasChave = Array.isArray(raw.palavrasChave)
      ? raw.palavrasChave
          .filter((item: unknown): item is string => typeof item === "string")
          .map((s: string) => s.trim())
          .filter(Boolean)
          .slice(0, 6)
      : [];

    const descricao =
      typeof raw.descricao === "string"
        ? raw.descricao.trim().slice(0, 300)
        : "";

    const tom = VALID_TONS.has(raw.tom)
      ? (raw.tom as string)
      : "Informativo e Didático";

    const faixaPalavras: FaixaPalavrasId = VALID_FAIXAS.has(raw.faixaPalavras)
      ? (raw.faixaPalavras as FaixaPalavrasId)
      : "2000-2500";

    const primeiraPessoa =
      typeof raw.primeiraPessoa === "boolean" ? raw.primeiraPessoa : true;

    const pesquisaWeb: ModoPesquisa = VALID_PESQUISA.has(raw.pesquisaWeb)
      ? (raw.pesquisaWeb as ModoPesquisa)
      : "auto";

    return NextResponse.json({
      palavrasChave,
      descricao,
      tom,
      faixaPalavras,
      primeiraPessoa,
      pesquisaWeb,
      provedor: result.provedor,
      modelo: result.modelo,
    });
  } catch (e) {
    return NextResponse.json({ erro: (e as Error).message }, { status: 500 });
  }
}
