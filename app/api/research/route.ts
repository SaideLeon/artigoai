import { NextResponse } from "next/server";
import { Groq } from "groq-sdk";
import {
  formatGeminiError,
  GEMINI_TEXT_MODEL,
  getGeminiClient,
  GROQ_RESEARCH_MODEL,
  normalizePlano,
} from "@/lib/ai-providers";
import type { FontePesquisa, ModoPesquisa } from "@/lib/types";

type ResearchResultJson = {
  necessario?: boolean;
  motivo?: string;
  resumo_factual?: string;
  pontos_chave?: string[];
  fontes?: Array<{ titulo?: string; url?: string }>;
};

function parseResearchJson(rawContent: string): ResearchResultJson {
  const withoutFences = rawContent
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    const jsonMatch = withoutFences.match(/\{[\s\S]*\}/)?.[0];
    return jsonMatch ? JSON.parse(jsonMatch) : {};
  } catch {
    return {
      necessario: Boolean(withoutFences),
      resumo_factual: withoutFences,
    };
  }
}

function formatResearchResponse(
  parsed: ResearchResultJson,
  fontes: FontePesquisa[],
  modo: ModoPesquisa,
  provedor: "groq" | "gemini"
) {
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
    provedor,
  });
}

async function runGeminiResearch(
  prompt: string,
  modo: ModoPesquisa
) {
  const ai = getGeminiClient();

  try {
    const response = await ai.models.generateContent({
      model: GEMINI_TEXT_MODEL,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const rawContent = (response.text ?? "").trim();
    const parsed = parseResearchJson(rawContent);
    const fontesMap = new Map<string, FontePesquisa>();

    for (const f of parsed.fontes ?? []) {
      if (f?.url && /^https?:\/\//i.test(f.url)) {
        fontesMap.set(f.url, {
          titulo: f.titulo?.trim() || f.url,
          url: f.url.trim(),
        });
      }
    }

    const groundingChunks =
      response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
    for (const chunk of groundingChunks) {
      const uri = chunk.web?.uri;
      const title = chunk.web?.title;
      if (uri && /^https?:\/\//i.test(uri) && !fontesMap.has(uri)) {
        fontesMap.set(uri, {
          titulo: title?.trim() || uri,
          url: uri.trim(),
        });
      }
    }

    const fontes = Array.from(fontesMap.values()).slice(0, 8);
    return formatResearchResponse(parsed, fontes, modo, "gemini");
  } catch (err) {
    throw formatGeminiError(err);
  }
}

async function runGroqResearch(prompt: string, modo: ModoPesquisa) {
  if (!process.env.GROQ_API_KEY?.trim()) {
    if (modo === "sempre") {
      return NextResponse.json(
        {
          erro: "GROQ_API_KEY não configurada no servidor para pesquisa na web do plano gratuito.",
        },
        { status: 500 }
      );
    }
    return NextResponse.json({
      pesquisou: false,
      motivo: "Pesquisa automática ignorada (GROQ_API_KEY não configurada).",
      resumoPesquisa: "",
      fontes: [] as FontePesquisa[],
      provedor: "groq",
    });
  }

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  const chatCompletion = await groq.chat.completions.create({
    messages: [{ role: "user", content: prompt }],
    model: GROQ_RESEARCH_MODEL,
    temperature: 1,
    max_completion_tokens: 63881,
    top_p: 1,
    stream: false,
    reasoning_effort: "medium",
    stop: null,
    tools: [{ type: "browser_search" }, { type: "code_interpreter" }],
  });

  const msg = chatCompletion.choices[0]?.message;
  const parsed = parseResearchJson(msg?.content ?? "");
  const fontesMap = new Map<string, FontePesquisa>();

  for (const f of parsed.fontes ?? []) {
    if (f?.url && /^https?:\/\//i.test(f.url)) {
      fontesMap.set(f.url, {
        titulo: f.titulo?.trim() || f.url,
        url: f.url.trim(),
      });
    }
  }

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
  return formatResearchResponse(parsed, fontes, modo, "groq");
}

export async function POST(req: Request) {
  try {
    const {
      tema,
      descricao = "",
      palavrasChave = [],
      tom = "Informativo e Didático",
      idioma = "Português (Brasil)",
      modo = "auto",
      plano: rawPlano,
      narracao = "",
    }: {
      tema: string;
      descricao?: string;
      palavrasChave?: string[];
      tom?: string;
      idioma?: string;
      modo?: ModoPesquisa;
      plano?: string;
      narracao?: string;
    } = await req.json();

    if (modo === "desativada") {
      return NextResponse.json({
        pesquisou: false,
        motivo: "Pesquisa web desativada pelo utilizador.",
        resumoPesquisa: "",
        fontes: [] as FontePesquisa[],
      });
    }

    const plano = normalizePlano(rawPlano);
    const ferramentaLabel =
      plano === "paid" ? "Google Search grounding" : "browser_search";

    const instrucaoModo =
      modo === "sempre"
        ? `Pesquisa OBRIGATORIAMENTE na web usando ${ferramentaLabel} para recolher factos recentes, datas, estatísticas e fontes fiáveis sobre o tema.`
        : `Avalia primeiro se este artigo exige pesquisa na web para ser preciso e atualizado (especialmente se for notícia, atualidade, artigo informativo técnico/factual, mercado, leis, lançamentos ou eventos recentes). Se for necessário, usa ${ferramentaLabel} para pesquisar factos e fontes atualizadas. Se for puramente reflexivo/atemporal e não precisar de factos externos, define "necessario": false.`;

    const narracaoLimpa =
      typeof narracao === "string" ? narracao.trim().slice(0, 10000) : "";

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
${
  narracaoLimpa
    ? `\nNarração/explicação fornecida pelo utilizador (verifica, atualiza e concilia os factos, datas, nomes e contexto desta narração com fontes atuais da web):\n"""\n${narracaoLimpa}\n"""`
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

    if (plano === "paid") {
      return await runGeminiResearch(prompt, modo);
    }

    return await runGroqResearch(prompt, modo);
  } catch (e) {
    return NextResponse.json({ erro: (e as Error).message }, { status: 500 });
  }
}
