import { NextResponse } from "next/server";
import {
  generateFreeText,
  generatePaidGeminiText,
  normalizePlano,
} from "@/lib/ai-providers";

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
      plano: rawPlano,
    } = await req.json();

    const plano = normalizePlano(rawPlano);

    const extras = [
      descricao ? `Enquadramento geral: ${descricao}.` : "",
      `Tom desejado: ${tom}.`,
      primeiraPessoa
        ? `Perspectiva narrativa: escreve obrigatoriamente em primeira pessoa do singular ("eu", "na minha experiência", "notei", "recomendo"), com voz pessoal e direta.`
        : `Perspectiva narrativa: escreve em terceira pessoa ou forma impessoal, evitando o uso de "eu", "meu" ou "minha".`,
      Array.isArray(palavrasChave) && palavrasChave.length > 0
        ? `Quando fizer sentido, integra naturalmente estas palavras-chave: ${palavrasChave.join(", ")}.`
        : "",
      contextoPesquisa
        ? `\nInformação pesquisada na web (usa estes factos, datas e dados com rigor, sem inventar estatísticas):\n${contextoPesquisa}`
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
Na última linha, depois do texto, escreve: IMAGEM: <descrição visual da secção, em inglês, numa frase, sem pedir texto escrito na imagem>`;

    const result =
      plano === "paid"
        ? await generatePaidGeminiText(prompt)
        : await generateFreeText(prompt);

    const [texto, promptImg] = result.text.split(/\n\s*\**IMAGEM:?\**:?/i);

    return NextResponse.json({
      texto: texto.trim(),
      prompt: (promptImg ?? `Illustration about ${secao.titulo}`).trim(),
      provedor: result.provedor,
      modelo: result.modelo,
    });
  } catch (e) {
    return NextResponse.json({ erro: (e as Error).message }, { status: 500 });
  }
}
