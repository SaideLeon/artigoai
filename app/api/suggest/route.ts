import { NextResponse } from "next/server";
import { chat, MODELO_TEXTO } from "@/lib/openrouter";
import {
  FAIXAS_PALAVRAS,
  TONS_TEXTO,
  type FaixaPalavrasId,
  type ModoPesquisa,
} from "@/lib/types";

const VALID_TONS = new Set<string>(TONS_TEXTO);
const VALID_FAIXAS = new Set<string>(FAIXAS_PALAVRAS.map((f) => f.id));
const VALID_PESQUISA = new Set<ModoPesquisa>(["auto", "sempre", "desativada"]);

export async function POST(req: Request) {
  try {
    const {
      tema,
      idioma = "Português (Brasil)",
    }: { tema: string; idioma?: string } = await req.json();

    if (!tema || !tema.trim()) {
      return NextResponse.json(
        { erro: "Informe o tema ou título principal primeiro." },
        { status: 400 }
      );
    }

    const data = await chat({
      model: MODELO_TEXTO,
      messages: [
        {
          role: "user",
          content: `Com base apenas no título principal "${tema.trim()}" (idioma: ${idioma}), sugere as melhores configurações para gerar um artigo completo e bem posicionado em SEO.

Responde APENAS com JSON válido (sem texto antes ou depois) neste formato exato:
{
  "palavrasChave": ["palavra 1", "palavra 2", "palavra 3", "palavra 4"],
  "descricao": "Resumo claro e atrativo do que o artigo deve abordar, em no máximo 260 caracteres, no idioma ${idioma}.",
  "tom": "um dos valores exatos: ${TONS_TEXTO.join(" | ")}",
  "faixaPalavras": "um dos valores exatos: ${FAIXAS_PALAVRAS.map((f) => f.id).join(" | ")}",
  "primeiraPessoa": true,
  "pesquisaWeb": "auto ou sempre (usa sempre se for notícia, evento recente, dado técnico ou atualidade) ou desativada"
}`,
        },
      ],
    });

    const bruto: string = data.choices?.[0]?.message?.content ?? "";
    const jsonMatch = bruto.match(/\{[\s\S]*\}/)?.[0];
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
    });
  } catch (e) {
    return NextResponse.json({ erro: (e as Error).message }, { status: 500 });
  }
}
