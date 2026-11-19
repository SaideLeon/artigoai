import { NextResponse } from "next/server";
import { chat, MODELO_TEXTO } from "@/lib/openrouter";

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
      primeiraPessoa = false,
      contextoPesquisa = "",
    } = await req.json();

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

    const data = await chat({
      model: MODELO_TEXTO,
      messages: [
        {
          role: "user",
          content: `Estás a escrever o artigo "${titulo}" em ${idioma}.
Estrutura completa: ${indice.join(" | ")}.
${extras}
${resumo ? `O que já foi escrito (não repitas):\n${resumo}\n` : ""}
Escreve agora APENAS a secção "${secao.titulo}". Objectivo: ${secao.objetivo}.
Escreve cerca de ${palavras} palavras, em parágrafos corridos separados por linha em branco, sem título e sem listas.
Na última linha, depois do texto, escreve: IMAGEM: <descrição visual da secção, em inglês, numa frase, sem pedir texto escrito na imagem>`,
        },
      ],
    });

    const bruto: string = data.choices[0].message.content ?? "";
    const [texto, prompt] = bruto.split(/\n\s*\**IMAGEM:?\**:?/i);

    return NextResponse.json({
      texto: texto.trim(),
      prompt: (prompt ?? `Illustration about ${secao.titulo}`).trim(),
    });
  } catch (e) {
    return NextResponse.json({ erro: (e as Error).message }, { status: 500 });
  }
}
