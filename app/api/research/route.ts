import { NextResponse } from "next/server";
import { Groq } from "groq-sdk";
import type { FontePesquisa, ModoPesquisa } from "@/lib/types";

type ResearchResultJson = {
  necessario?: boolean;
  motivo?: string;
  resumo_factual?: string;
  pontos_chave?: string[];
  fontes?: Array<{ titulo?: string; url?: string }>;
};

export async function POST(req: Request) {
  try {
    const {
      tema,
      descricao = "",
      palavrasChave = [],
      tom = "Informativo e Didático",
      idioma = "Português (Brasil)",
      modo = "auto",
    }: {
      tema: string;
      descricao?: string;
      palavrasChave?: string[];
      tom?: string;
      idioma?: string;
      modo?: ModoPesquisa;
    } = await req.json();

    if (modo === "desativada") {
      return NextResponse.json({
        pesquisou: false,
        motivo: "Pesquisa web desativada pelo utilizador.",
        resumoPesquisa: "",
        fontes: [] as FontePesquisa[],
      });
    }

    if (!process.env.GROQ_API_KEY) {
      if (modo === "sempre") {
        return NextResponse.json(
          { erro: "GROQ_API_KEY não configurada no servidor." },
          { status: 500 }
        );
      }
      return NextResponse.json({
        pesquisou: false,
        motivo: "Pesquisa automática ignorada (GROQ_API_KEY não configurada).",
        resumoPesquisa: "",
        fontes: [] as FontePesquisa[],
      });
    }

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const model = process.env.GROQ_RESEARCH_MODEL || "openai/gpt-oss-120b";

    const instrucaoModo =
      modo === "sempre"
        ? `Pesquisa OBRIGATORIAMENTE na web usando a ferramenta browser_search para recolher factos recentes, datas, estatísticas e fontes fiáveis sobre o tema.`
        : `Avalia primeiro se este artigo exige pesquisa na web para ser preciso e atualizado (especialmente se for notícia, atualidade, artigo informativo técnico/factual, mercado, leis, lançamentos ou eventos recentes). Se for necessário, usa obrigatoriamente browser_search para pesquisar factos e fontes atualizadas. Se for puramente reflexivo/atemporal e não precisar de factos externos, define "necessario": false.`;

    const prompt = `Analisa o pedido de artigo abaixo e faz pesquisa na web quando necessário.

Tema: "${tema}"
Tom/Formato: "${tom}"
Idioma do artigo: "${idioma}"
${descricao ? `Descrição: "${descricao}"` : ""}
${
  Array.isArray(palavrasChave) && palavrasChave.length > 0
    ? `Palavras-chave: ${palavrasChave.join(", ")}`
    : ""
}

${instrucaoModo}

Responde APENAS em JSON válido neste formato exato:
{
  "necessario": true,
  "motivo": "explicação breve em português de por que pesquisou ou não",
  "resumo_factual": "síntese objetiva dos factos, datas, números, contexto atual e declarações encontradas",
  "pontos_chave": ["facto verificado 1", "facto verificado 2"],
  "fontes": [{"titulo": "Nome da publicação ou página", "url": "https://..."}]
}`;

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      model,
      temperature: 1,
      max_completion_tokens: 63881,
      top_p: 1,
      stream: false,
      reasoning_effort: "medium",
      response_format: {
        type: "json_object",
      },
      stop: null,
      tools: [
        {
          type: "browser_search",
        },
        {
          type: "code_interpreter",
        },
      ],
    });

    const msg = chatCompletion.choices[0]?.message;
    const rawContent = msg?.content ?? "{}";
    const jsonMatch = rawContent.match(/\{[\s\S]*\}/)?.[0] ?? "{}";
    const parsed: ResearchResultJson = JSON.parse(jsonMatch);

    const fontesMap = new Map<string, FontePesquisa>();

    for (const f of parsed.fontes ?? []) {
      if (f?.url && /^https?:\/\//i.test(f.url)) {
        fontesMap.set(f.url, {
          titulo: f.titulo?.trim() || f.url,
          url: f.url.trim(),
        });
      }
    }

    // Extract verified URLs from Groq executed_tools if present
    for (const tool of msg?.executed_tools ?? []) {
      for (const b of tool.browser_results ?? []) {
        if (b?.url && /^https?:\/\//i.test(b.url) && !fontesMap.has(b.url)) {
          fontesMap.set(b.url, {
            titulo: b.title?.trim() || b.url,
            url: b.url.trim(),
          });
        }
      }
      const searchResults = tool.search_results as
        | { results?: Array<{ title?: string; url?: string }> }
        | null
        | undefined;
      for (const sr of searchResults?.results ?? []) {
        if (sr?.url && /^https?:\/\//i.test(sr.url) && !fontesMap.has(sr.url)) {
          fontesMap.set(sr.url, {
            titulo: sr.title?.trim() || sr.url,
            url: sr.url.trim(),
          });
        }
      }
    }

    const fontes = Array.from(fontesMap.values()).slice(0, 8);
    const pesquisou = modo === "sempre" || Boolean(parsed.necessario);

    const blocos: string[] = [];
    if (parsed.resumo_factual?.trim()) {
      blocos.push(`Resumo factual pesquisado:\n${parsed.resumo_factual.trim()}`);
    }
    if (Array.isArray(parsed.pontos_chave) && parsed.pontos_chave.length > 0) {
      blocos.push(
        `Pontos-chave verificados:\n${parsed.pontos_chave
          .map((p) => `- ${p}`)
          .join("\n")}`
      );
    }
    if (fontes.length > 0) {
      blocos.push(
        `Fontes consultadas:\n${fontes
          .map((f) => `- ${f.titulo} (${f.url})`)
          .join("\n")}`
      );
    }

    return NextResponse.json({
      pesquisou,
      motivo: parsed.motivo ?? "",
      resumoPesquisa: pesquisou ? blocos.join("\n\n") : "",
      fontes: pesquisou ? fontes : [],
    });
  } catch (e) {
    return NextResponse.json({ erro: (e as Error).message }, { status: 500 });
  }
}
