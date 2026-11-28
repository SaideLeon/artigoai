import { NextResponse } from "next/server";
import { Groq } from "groq-sdk";
import {
  formatGeminiError,
  GEMINI_RESEARCH_FALLBACK_MODEL,
  GEMINI_RESEARCH_MODEL,
  getGeminiClient,
  GROQ_RESEARCH_MODEL,
  normalizePlano,
} from "@/lib/ai-providers";
import {
  normalizeAndDedupeLinks,
  scrapePrimaryLinks,
  type ScrapedPrimarySource,
} from "@/lib/link-scraper";
import { enforceGenerationQuota } from "@/lib/usage-enforcement";
import type { FontePesquisa, ModoPesquisa } from "@/lib/types";

type ResearchResultJson = {
  necessario?: boolean;
  motivo?: string;
  resumo_primario?: string;
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

function buildOrderedFontes(
  primarySources: ScrapedPrimarySource[],
  secondaryCandidates: FontePesquisa[]
): FontePesquisa[] {
  const seen = new Set<string>();
  const ordered: FontePesquisa[] = [];

  for (const src of primarySources) {
    const url = src.url.trim();
    if (!url || !/^https?:\/\//i.test(url)) continue;
    const norm = url.replace(/\/+$/, "");
    if (seen.has(norm)) continue;
    seen.add(norm);
    ordered.push({
      titulo: src.title?.trim() || url,
      url,
      tipo: "primaria",
    });
  }

  for (const sec of secondaryCandidates) {
    const url = sec.url?.trim();
    if (!url || !/^https?:\/\//i.test(url)) continue;
    const norm = url.replace(/\/+$/, "");
    if (seen.has(norm)) continue;
    seen.add(norm);
    ordered.push({
      titulo: sec.titulo?.trim() || url,
      url,
      tipo: "secundaria",
    });
  }

  return ordered.slice(0, 12);
}

function formatResearchResponse(
  parsed: ResearchResultJson,
  secondaryFontes: FontePesquisa[],
  modo: ModoPesquisa,
  provedor: "groq" | "gemini" | "scraper",
  primarySources: ScrapedPrimarySource[],
  primaryContext: string
) {
  const hasPrimary = primarySources.length > 0;
  const pesquisou = modo === "sempre" || hasPrimary || Boolean(parsed.necessario);
  const fontes = buildOrderedFontes(primarySources, secondaryFontes);

  const blocos: string[] = [];

  if (primaryContext.trim()) {
    blocos.push(primaryContext.trim());
  }

  if (parsed.resumo_primario?.trim()) {
    blocos.push(
      `Síntese prioritária das fontes primárias do utilizador:\n${parsed.resumo_primario.trim()}`
    );
  }

  if (parsed.resumo_factual?.trim()) {
    blocos.push(
      hasPrimary
        ? `=== FONTES SECUNDÁRIAS DA WEB (APOIO COMPLEMENTAR) ===\n${parsed.resumo_factual.trim()}`
        : `Resumo factual pesquisado:\n${parsed.resumo_factual.trim()}`
    );
  }

  if (Array.isArray(parsed.pontos_chave) && parsed.pontos_chave.length > 0) {
    blocos.push(
      `Pontos-chave verificados (priorizando a fonte primária):\n${parsed.pontos_chave
        .map((p) => `- ${p}`)
        .join("\n")}`
    );
  }

  if (fontes.length > 0) {
    blocos.push(
      `Fontes consultadas:\n${fontes
        .map(
          (f) =>
            `- [${f.tipo === "primaria" ? "PRIMÁRIA" : "SECUNDÁRIA"}] ${f.titulo} (${f.url})`
        )
        .join("\n")}`
    );
  }

  return NextResponse.json({
    pesquisou,
    motivo:
      parsed.motivo ||
      (hasPrimary
        ? "Fontes primárias fornecidas pelo utilizador acedidas e priorizadas com apoio secundário da web."
        : ""),
    contextoPrimario: primaryContext.trim(),
    resumoPesquisa: pesquisou ? blocos.join("\n\n") : "",
    fontes: pesquisou ? fontes : [],
    provedor,
  });
}

async function runGeminiResearch(
  prompt: string,
  modo: ModoPesquisa,
  primarySources: ScrapedPrimarySource[],
  primaryContext: string
) {
  if (!process.env.GEMINI_API_KEY?.trim()) {
    if (process.env.GROQ_API_KEY?.trim()) {
      return await runGroqResearch(
        prompt,
        modo,
        primarySources,
        primaryContext
      );
    }
    if (primarySources.length > 0 && primaryContext.trim()) {
      return formatResearchResponse(
        {
          necessario: true,
          motivo:
            "Fontes primárias raspadas diretamente (GEMINI_API_KEY não configurada para pesquisa web).",
        },
        [],
        modo,
        "scraper",
        primarySources,
        primaryContext
      );
    }
    if (modo === "sempre") {
      return NextResponse.json(
        {
          erro: "GEMINI_API_KEY não configurada no servidor para pesquisa na web com Gemini gratuito.",
        },
        { status: 500 }
      );
    }
    return NextResponse.json({
      pesquisou: false,
      motivo: "Pesquisa automática ignorada (GEMINI_API_KEY não configurada).",
      contextoPrimario: "",
      resumoPesquisa: "",
      fontes: [] as FontePesquisa[],
      provedor: "gemini",
    });
  }

  const ai = getGeminiClient();
  const candidateModels = Array.from(
    new Set([GEMINI_RESEARCH_MODEL, GEMINI_RESEARCH_FALLBACK_MODEL])
  );

  let lastError: unknown = null;

  for (const modelName of candidateModels) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
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
            tipo: "secundaria",
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
            tipo: "secundaria",
          });
        }
      }

      return formatResearchResponse(
        parsed,
        Array.from(fontesMap.values()),
        modo,
        "gemini",
        primarySources,
        primaryContext
      );
    } catch (err) {
      lastError = err;
    }
  }

  if (process.env.GROQ_API_KEY?.trim()) {
    try {
      return await runGroqResearch(
        prompt,
        modo,
        primarySources,
        primaryContext
      );
    } catch {
      // Se Groq também falhar, segue tratamento abaixo
    }
  }

  if (primarySources.length > 0 && primaryContext.trim()) {
    return formatResearchResponse(
      {
        necessario: true,
        motivo:
          "Fontes primárias raspadas diretamente; busca secundária indisponível no momento.",
      },
      [],
      modo,
      "scraper",
      primarySources,
      primaryContext
    );
  }

  throw formatGeminiError(lastError);
}

async function runGroqResearch(
  prompt: string,
  modo: ModoPesquisa,
  primarySources: ScrapedPrimarySource[],
  primaryContext: string
) {
  if (!process.env.GROQ_API_KEY?.trim()) {
    if (primarySources.length > 0 && primaryContext.trim()) {
      return formatResearchResponse(
        {
          necessario: true,
          motivo:
            "Fontes primárias do utilizador raspadas diretamente (busca secundária via Groq não configurada).",
        },
        [],
        modo,
        "scraper",
        primarySources,
        primaryContext
      );
    }
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
      contextoPrimario: "",
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
        tipo: "secundaria",
      });
    }
  }

  for (const tool of msg?.executed_tools ?? []) {
    for (const b of tool.browser_results ?? []) {
      if (b?.url && /^https?:\/\//i.test(b.url) && !fontesMap.has(b.url)) {
        fontesMap.set(b.url, {
          titulo: b.title?.trim() || b.url,
          url: b.url.trim(),
          tipo: "secundaria",
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
          tipo: "secundaria",
        });
      }
    }
  }

  return formatResearchResponse(
    parsed,
    Array.from(fontesMap.values()),
    modo,
    "groq",
    primarySources,
    primaryContext
  );
}

export async function POST(req: Request) {
  try {
    const {
      tema = "",
      descricao = "",
      palavrasChave = [],
      tom = "Informativo e Didático",
      idioma = "Português (Brasil)",
      modo = "auto",
      plano: rawPlano,
      narracao = "",
      links = [],
      sessionKey,
    }: {
      tema?: string;
      descricao?: string;
      palavrasChave?: string[];
      tom?: string;
      idioma?: string;
      modo?: ModoPesquisa;
      plano?: string;
      narracao?: string;
      links?: string[];
      sessionKey?: string;
    } = await req.json();

    const requestedPlano = normalizePlano(rawPlano);
    const quotaDecision = await enforceGenerationQuota({
      req,
      requestedPlano,
      action: "verify_plan",
      sessionKey: typeof sessionKey === "string" ? sessionKey : undefined,
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

    const narracaoLimpa =
      typeof narracao === "string" ? narracao.trim().slice(0, 10000) : "";

    const primaryLinks = normalizeAndDedupeLinks(
      links,
      tema,
      descricao,
      narracaoLimpa
    );

    const { sources: primarySources, formattedContext: primaryContext } =
      await scrapePrimaryLinks(primaryLinks);

    if (modo === "desativada") {
      if (primarySources.length === 0) {
        return NextResponse.json({
          pesquisou: false,
          motivo: "Pesquisa web desativada pelo utilizador.",
          contextoPrimario: "",
          resumoPesquisa: "",
          fontes: [] as FontePesquisa[],
        });
      }

      return formatResearchResponse(
        {
          necessario: true,
          motivo:
            "Fontes primárias fornecidas pelo utilizador acedidas e raspadas diretamente (busca web adicional desativada).",
        },
        [],
        modo,
        "scraper",
        primarySources,
        primaryContext
      );
    }

    const ferramentaLabel = "Google Search grounding";

    const hasPrimary = primarySources.length > 0;
    const instrucaoModo = hasPrimary
      ? modo === "sempre"
        ? `REGRAS DE PRIORIDADE DE FONTES:
1. FONTE PRIMÁRIA (OBRIGATÓRIA E PRIORITÁRIA): Os dados raspados dos links fornecidos pelo utilizador acima representam o trabalho original com a mão humana e têm prioridade absoluta sobre qualquer outra página. Preserva os argumentos, factos, obras, dados, datas e perspetiva dessas fontes primárias. Se alguma fonte primária não pôde ser raspada diretamente no aviso acima, tenta aceder a esse URL com ${ferramentaLabel}.
2. FONTES SECUNDÁRIAS (APOIO COMPLEMENTAR): Depois de assimilar as fontes primárias, usa ${ferramentaLabel} para consultar outros links na web apenas como contexto secundário de apoio para enriquecer ou complementar o conteúdo sem jamais ignorar ou substituir o material original do utilizador.`
        : `REGRAS DE PRIORIDADE DE FONTES:
1. FONTE PRIMÁRIA (PRIORIDADE ABSOLUTA): Os links fornecidos pelo utilizador já foram raspados acima e contêm o trabalho/referência original. Trata esse conteúdo como a base principal e define "necessario": true. Se algum link do utilizador tiver aviso de raspagem direta, tenta consultá-lo com ${ferramentaLabel}.
2. FONTES SECUNDÁRIAS: Em seguida, avalia se vale complementar com outras fontes da web via ${ferramentaLabel}. Se pesquisares outras páginas, usa-as estritamente como fontes secundárias de apoio, nunca ignorando ou ofuscando os dados originais fornecidos pelo utilizador.`
      : modo === "sempre"
      ? `Pesquisa OBRIGATORIAMENTE na web usando ${ferramentaLabel} para recolher factos recentes, datas, estatísticas e fontes fiáveis sobre o tema.`
      : `Avalia primeiro se este artigo exige pesquisa na web para ser preciso e atualizado (especialmente se for notícia, atualidade, artigo informativo técnico/factual, mercado, leis, lançamentos ou eventos recentes). Se for necessário, usa ${ferramentaLabel} para pesquisar factos e fontes atualizadas. Se for puramente reflexivo/atemporal e não precisar de factos externos, define "necessario": false.`;

    const prompt = `Analisa o pedido de artigo abaixo${
      hasPrimary
        ? ", priorizando rigorosamente as FONTES PRIMÁRIAS fornecidas pelo utilizador antes de consultar fontes secundárias na web"
        : " e faz pesquisa na web quando necessário"
    }.

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
  primaryContext
    ? `\n${primaryContext}`
    : ""
}
${
  narracaoLimpa
    ? `\nNarração/explicação fornecida pelo utilizador (verifica, atualiza e concilia os factos, datas, nomes e contexto desta narração com as fontes primárias e apoio da web):\n"""\n${narracaoLimpa}\n"""`
    : ""
}

${instrucaoModo}

Responde APENAS em JSON válido neste formato exato:
{
  "necessario": true,
  "motivo": "explicação breve em português de por que pesquisou ou como priorizou as fontes",
  "resumo_primario": "${
    hasPrimary
      ? "síntese detalhada dos factos, ideias, dados, argumentos e trabalho original extraídos dos links primários fornecidos pelo utilizador"
      : ""
  }",
  "resumo_factual": "síntese objetiva dos factos complementares, datas, números e contexto encontrados nas fontes secundárias da web",
  "pontos_chave": ["facto ou ideia prioritária 1", "facto ou ideia 2"],
  "fontes": [{"titulo": "Nome da publicação ou página secundária", "url": "https://..."}]
}`;

    return await runGeminiResearch(
      prompt,
      modo,
      primarySources,
      primaryContext
    );
  } catch (e) {
    return NextResponse.json({ erro: (e as Error).message }, { status: 500 });
  }
}
