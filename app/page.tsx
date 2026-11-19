"use client";

import { useState } from "react";

type Secao = {
  titulo: string;
  objetivo: string;
  texto?: string;
  prompt?: string;
  img?: string;
  erro?: string;
  aGerarImagem?: boolean;
};

const PALAVRAS_ALVO = 2300; // um pouco acima de 2000 para ter margem
const NUM_SECOES = 7;

async function post(url: string, corpo: unknown) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(corpo),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.erro ?? "Erro desconhecido");
  return d;
}

export default function Home() {
  const [tema, setTema] = useState("");
  const [titulo, setTitulo] = useState("");
  const [secoes, setSecoes] = useState<Secao[]>([]);
  const [estado, setEstado] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const atualizar = (i: number, p: Partial<Secao>) =>
    setSecoes((s) => s.map((x, j) => (j === i ? { ...x, ...p } : x)));

  const total = secoes.reduce(
    (n, s) => n + (s.texto?.split(/\s+/).filter(Boolean).length ?? 0),
    0
  );

  async function gerarImagem(i: number, prompt: string) {
    atualizar(i, { aGerarImagem: true, erro: undefined });
    try {
      const { url } = await post("/api/image", { prompt });
      atualizar(i, { img: url, aGerarImagem: false });
    } catch (e) {
      atualizar(i, { erro: (e as Error).message, aGerarImagem: false });
    }
  }

  async function gerar() {
    if (!tema.trim()) return;
    setOcupado(true);
    setSecoes([]);
    setTitulo("");

    try {
      setEstado("A criar o esboço…");
      const esb = await post("/api/outline", { tema, secoes: NUM_SECOES });
      const lista: Secao[] = esb.secoes;
      setTitulo(esb.titulo);
      setSecoes(lista);

      const alvo = Math.ceil(PALAVRAS_ALVO / lista.length);
      let resumo = "";

      // Uma secção de cada vez: cada pedido é curto e respeita o limite de pedidos por minuto.
      for (let i = 0; i < lista.length; i++) {
        setEstado(`A escrever a secção ${i + 1} de ${lista.length}…`);
        const { texto, prompt } = await post("/api/section", {
          titulo: esb.titulo,
          indice: lista.map((s) => s.titulo),
          secao: lista[i],
          resumo,
          palavras: alvo,
        });
        atualizar(i, { texto, prompt });
        resumo += `- ${lista[i].titulo}: ${texto.slice(0, 200)}…\n`;

        setEstado(`A gerar a imagem da secção ${i + 1}…`);
        await gerarImagem(i, prompt);
      }
      setEstado("Artigo concluído.");
    } catch (e) {
      setEstado("Erro: " + (e as Error).message);
    }
    setOcupado(false);
  }

  function exportar() {
    const corpo = secoes
      .map(
        (s) =>
          `<h2>${s.titulo}</h2>${s.img ? `<img src="${s.img}" style="width:100%;border-radius:8px">` : ""}` +
          (s.texto ?? "")
            .split(/\n\s*\n/)
            .map((p) => `<p>${p}</p>`)
            .join("")
      )
      .join("");
    const html = `<!doctype html><html lang="pt"><meta charset="utf-8"><title>${titulo}</title><body style="max-width:760px;margin:2rem auto;padding:0 1rem;font-family:Georgia,serif;line-height:1.75"><h1>${titulo}</h1>${corpo}</body></html>`;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    a.download = "artigo.html";
    a.click();
  }

  return (
    <main className="layout">
      <aside className="painel">
        <h1>Gerador de artigos</h1>
        <label htmlFor="tema">Sobre o que é o artigo?</label>
        <textarea
          id="tema"
          value={tema}
          onChange={(e) => setTema(e.target.value)}
          placeholder="Ex.: Como funciona o pagamento por telemóvel em Moçambique"
          disabled={ocupado}
        />
        <button onClick={gerar} disabled={ocupado || !tema.trim()}>
          {ocupado ? "A gerar…" : "Gerar artigo"}
        </button>
        {secoes.length > 0 && !ocupado && (
          <button className="secundario" onClick={exportar}>
            Descarregar HTML
          </button>
        )}
        <p className="estado" aria-live="polite">{estado}</p>
        {secoes.length > 0 && (
          <p className={`estado contagem ${total >= 2000 ? "ok" : ""}`}>
            {total} palavras {total >= 2000 ? "— meta atingida" : "(meta: 2000)"}
          </p>
        )}
      </aside>

      <article className="artigo">
        {!titulo && <p className="vazio">O artigo aparece aqui, secção a secção.</p>}
        {titulo && <h1>{titulo}</h1>}
        {secoes.map((s, i) => (
          <section key={i}>
            <h2>{s.titulo}</h2>
            {s.img ? (
              <img className="imagem" src={s.img} alt={s.titulo} />
            ) : s.texto ? (
              <div className="sem-imagem">
                <span className={s.erro ? "erro" : ""}>
                  {s.aGerarImagem ? "A gerar imagem…" : s.erro ?? "Sem imagem"}
                </span>
                {!s.aGerarImagem && s.prompt && (
                  <button className="secundario" onClick={() => gerarImagem(i, s.prompt!)}>
                    Gerar imagem de novo
                  </button>
                )}
              </div>
            ) : null}
            {s.texto
              ? s.texto.split(/\n\s*\n/).map((p, k) => <p key={k}>{p}</p>)
              : ocupado && <p className="vazio">A aguardar…</p>}
          </section>
        ))}
      </article>
    </main>
  );
}
