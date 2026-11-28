import { NextResponse } from "next/server";
import {
  generateArticleText,
  normalizePlano,
} from "@/lib/ai-providers";
import {
  attachGuestQuotaCookie,
  enforceGenerationQuota,
} from "@/lib/usage-enforcement";
import { getEstiloImagemConfig } from "@/lib/types";

export async function POST(req: Request) {
  try {
    const {
      titulo,
      indice,
      secao,
      resumo,
      palavras,
      tom = "Informativo e Didático",
      idioma = "Português (Brasil)",
      palavrasChave = [],
      descricao = "",
      primeiraPessoa = true,
      contextoPesquisa = "",
      contextoPrimario = "",
      narracao = "",
      estiloImagem,
      plano: rawPlano,
      sessionKey,
    } = await req.json();

    const styleConfig = getEstiloImagemConfig(estiloImagem);

    const requestedPlano = normalizePlano(rawPlano);
    const quotaDecision = await enforceGenerationQuota({
      req,
      requestedPlano,
      action: "article",
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
      typeof narracao === "string" ? narracao.trim().slice(0, 16000) : "";
    const primarioLimpo =
      typeof contextoPrimario === "string" ? contextoPrimario.trim() : "";

    const extras = [
      descricao ? `Enquadramento geral: ${descricao}.` : "",
      `Tom desejado: ${tom}.`,
      primeiraPessoa
        ? `Perspectiva narrativa: escreve obrigatoriamente em primeira pessoa do singular ("eu", "na minha experiência", "notei", "recomendo"), com voz pessoal e direta.`
        : `Perspectiva narrativa: escreve em terceira pessoa ou forma impessoal, evitando o uso de "eu", "meu" ou "minha".`,
      Array.isArray(palavrasChave) && palavrasChave.length > 0
        ? `Quando fizer sentido, integra naturalmente estas palavras-chave: ${palavrasChave.join(", ")}.`
        : "",
      narracaoLimpa
        ? `\nNarração explicada pelo utilizador (incorpora, melhora e aprofunda os detalhes, ideias, exemplos e história relevantes para esta secção, transformando a fala numa escrita rica e profissional sem perder a essência):\n"""\n${narracaoLimpa}\n"""`
        : "",
      primarioLimpo
        ? `\nFONTES PRIMÁRIAS FORNECIDAS PELO UTILIZADOR (PRIORIDADE MÁXIMA):\nEstes dados são a obra/referência original enviada pelo utilizador. Ancora esta secção prioritariamente nos factos, argumentos, exemplos e informações presentes nestas fontes primárias, sem jamais ignorá-las:\n${primarioLimpo}`
        : "",
      contextoPesquisa
        ? `\nInformação pesquisada (prioriza sempre as fontes primárias do utilizador e usa as fontes secundárias da web apenas como apoio contextual, sem inventar estatísticas):\n${contextoPesquisa}`
        : "",
    ]
      .filter(Boolean)
      .join("\n");

    const prompt = `Estás a escrever o artigo "${titulo}" em ${idioma}.
Estrutura completa: ${indice.join(" | ")}.
${extras}
${resumo ? `O que já foi escrito (não repitas):\n${resumo}\n` : ""}
Escreve agora APENAS a secção "${secao.titulo}". Objectivo: ${secao.objetivo}.
Escreve cerca de ${palavras} palavras, em parágrafos corridos separados por linha em branco, sem título e sem listas.
Na última linha, depois do texto, escreve: IMAGEM: <${styleConfig.sectionHint}>`;

    const result = await generateArticleText(prompt);

    const [texto, promptImg] = result.text.split(/\n\s*\**IMAGEM:?\**:?/i);

    const response = NextResponse.json({
      texto: texto.trim(),
      prompt: (promptImg ?? `Illustration about ${secao.titulo}`).trim(),
      provedor: result.provedor,
      modelo: result.modelo,
      quota: quotaDecision.snapshot,
    });
    return attachGuestQuotaCookie(
      response,
      quotaDecision.updatedGuestCookieValue
    );
  } catch (e) {
    return NextResponse.json({ erro: (e as Error).message }, { status: 500 });
  }
}
