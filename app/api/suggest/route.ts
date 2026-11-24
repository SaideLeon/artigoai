import { NextResponse } from "next/server";
import { Type, type Schema } from "@google/genai";
import {
  generateFreeText,
  generatePaidGeminiText,
  normalizePlano,
} from "@/lib/ai-providers";
import {
  normalizeAndDedupeLinks,
  scrapePrimaryLinks,
} from "@/lib/link-scraper";
import { enforceGenerationQuota } from "@/lib/usage-enforcement";
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
    temaSugerido: { type: Type.STRING },
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
      tema = "",
      idioma = "Português (Brasil)",
      plano: rawPlano,
      links = [],
    }: {
      tema?: string;
      idioma?: string;
      plano?: string;
      links?: string[];
    } = await req.json();

    const requestedPlano = normalizePlano(rawPlano);
    const quotaDecision = await enforceGenerationQuota({
      req,
      requestedPlano,
      action: "verify_plan",
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
    const primaryLinks = normalizeAndDedupeLinks(links, tema);

    if ((!tema || !tema.trim()) && primaryLinks.length === 0) {
      return NextResponse.json(
        { erro: "Informe o tema ou adicione pelo menos um link de referência primeiro." },
        { status: 400 }
      );
    }

    const { formattedContext: primaryContext } =
      primaryLinks.length > 0
        ? await scrapePrimaryLinks(primaryLinks)
        : { formattedContext: "" };

    const prompt = `Com base ${
      primaryContext
        ? `nos links de referência (fonte primária) fornecidos pelo utilizador${
            tema.trim() ? ` e no tema "${tema.trim()}"` : ""
          }`
        : `apenas no título principal "${tema.trim()}"`
    } (idioma: ${idioma}), sugere as melhores configurações para gerar um artigo completo e bem posicionado em SEO.
${primaryContext ? `\n${primaryContext}\n` : ""}
Responde APENAS com JSON válido (sem texto antes ou depois) neste formato exato:
{
  ${
    !tema.trim()
      ? `"temaSugerido": "Título claro e atrativo em ${idioma} baseado nas fontes primárias (até 95 caracteres)",`
      : ""
  }
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

    const temaSugerido =
      typeof raw.temaSugerido === "string"
        ? raw.temaSugerido.trim().slice(0, 100)
        : "";

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
      temaSugerido,
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
