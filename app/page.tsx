"use client";

import { useState, useEffect, useRef } from "react";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import HeroBanner from "@/components/HeroBanner";
import ArticleConfigForm from "@/components/ArticleConfigForm";
import ArticleWorkspace from "@/components/ArticleWorkspace";
import {
  ArticlesListView,
  StatisticsView,
  SettingsView,
} from "@/components/LibraryViews";
import InfoModal from "@/components/InfoModal";
import {
  FAIXAS_PALAVRAS,
  type ArtigoSalvo,
  type ConfiguracoesPadrao,
  type FaixaPalavrasId,
  type FontePesquisa,
  type ModoPesquisa,
  type NavTab,
  type NotificacaoItem,
  type Secao,
} from "@/lib/types";

const STORAGE_ARTICLES = "artigoai:artigos:v1";
const STORAGE_CONFIG = "artigoai:config:v1";

const DEFAULT_CONFIG: ConfiguracoesPadrao = {
  tomPadrao: "Informativo e Didático",
  idiomaPadrao: "Português (Brasil)",
  faixaPalavrasPadrao: "2000-2500",
  incluirImagensPadrao: true,
  primeiraPessoaPadrao: false,
  pesquisaWebPadrao: "auto",
};

async function postJson(
  url: string,
  corpo: unknown,
  signal?: AbortSignal
) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(corpo),
    signal,
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.erro ?? "Erro desconhecido");
  return d;
}

function escapeHtml(text: string) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function contarPalavras(secoes: Secao[]) {
  return secoes.reduce(
    (n, s) => n + (s.texto?.trim().split(/\s+/).filter(Boolean).length ?? 0),
    0
  );
}

function downloadArtigoHtml(
  titulo: string,
  descricao: string,
  secoes: Secao[],
  fontes: FontePesquisa[] = []
) {
  const corpo = secoes
    .map(
      (s, idx) =>
        `<section style="margin-top:2.2rem"><h2>${idx + 1}. ${escapeHtml(
          s.titulo
        )}</h2>${
          s.img
            ? `<img src="${s.img}" alt="${escapeHtml(
                s.titulo
              )}" style="width:100%;border-radius:12px;margin:1rem 0">`
            : ""
        }${(s.texto ?? "")
          .split(/\n\s*\n/)
          .filter(Boolean)
          .map((p) => `<p>${escapeHtml(p)}</p>`)
          .join("")}</section>`
    )
    .join("");

  const fontesHtml =
    fontes.length > 0
      ? `<section style="margin-top:2.5rem;padding-top:1.25rem;border-top:1px solid #e2e8f0"><h3 style="font-size:1rem">Fontes consultadas</h3><ol style="font-size:0.9rem;color:#475569">${fontes
          .map(
            (f) =>
              `<li><a href="${escapeHtml(
                f.url
              )}" target="_blank" rel="noopener noreferrer">${escapeHtml(
                f.titulo
              )}</a></li>`
          )
          .join("")}</ol></section>`
      : "";

  const html = `<!doctype html><html lang="pt"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(
    titulo
  )}</title></head><body style="max-width:760px;margin:2.5rem auto;padding:0 1.25rem;font-family:Georgia,serif;line-height:1.78;color:#1e293b"><h1>${escapeHtml(
    titulo
  )}</h1>${
    descricao
      ? `<p style="font-size:1.1rem;color:#475569">${escapeHtml(descricao)}</p>`
      : ""
  }${corpo}${fontesHtml}</body></html>`;

  const slug =
    titulo
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "artigo";

  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([html], { type: "text/html" }));
  a.download = `${slug}.html`;
  a.click();
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<NavTab>("inicio");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [modalTipo, setModalTipo] = useState<
    "upgrade" | "ajuda" | "sobre" | null
  >(null);

  // Configuration state
  const [tema, setTema] = useState("");
  const [palavrasChave, setPalavrasChave] = useState<string[]>([]);
  const [descricao, setDescricao] = useState("");
  const [tom, setTom] = useState<string>(DEFAULT_CONFIG.tomPadrao);
  const [idioma, setIdioma] = useState<string>(DEFAULT_CONFIG.idiomaPadrao);
  const [faixaPalavras, setFaixaPalavras] = useState<FaixaPalavrasId>(
    DEFAULT_CONFIG.faixaPalavrasPadrao
  );
  const [incluirImagens, setIncluirImagens] = useState<boolean>(
    DEFAULT_CONFIG.incluirImagensPadrao
  );
  const [primeiraPessoa, setPrimeiraPessoa] = useState<boolean>(
    Boolean(DEFAULT_CONFIG.primeiraPessoaPadrao)
  );
  const [pesquisaWeb, setPesquisaWeb] = useState<ModoPesquisa>(
    DEFAULT_CONFIG.pesquisaWebPadrao ?? "auto"
  );

  // Active article workspace state
  const [artigoAtualId, setArtigoAtualId] = useState<string | null>(null);
  const [titulo, setTitulo] = useState("");
  const [secoes, setSecoes] = useState<Secao[]>([]);
  const [fontes, setFontes] = useState<FontePesquisa[]>([]);
  const [pesquisaUsada, setPesquisaUsada] = useState(false);
  const [estado, setEstado] = useState("");
  const [erroGeral, setErroGeral] = useState("");
  const [ocupado, setOcupado] = useState(false);

  // Library & settings state
  const [artigosSalvos, setArtigosSalvos] = useState<ArtigoSalvo[]>([]);
  const [configPadrao, setConfigPadrao] =
    useState<ConfiguracoesPadrao>(DEFAULT_CONFIG);
  const [notificacoes, setNotificacoes] = useState<NotificacaoItem[]>([]);

  const abortRef = useRef<AbortController | null>(null);

  // Load persisted data after mount
  useEffect(() => {
    let mounted = true;
    Promise.resolve().then(() => {
      if (!mounted) return;
      try {
        const rawArtigos = localStorage.getItem(STORAGE_ARTICLES);
        if (rawArtigos) {
          setArtigosSalvos(JSON.parse(rawArtigos));
        }
        const rawConfig = localStorage.getItem(STORAGE_CONFIG);
        if (rawConfig) {
          const parsed: ConfiguracoesPadrao = JSON.parse(rawConfig);
          setConfigPadrao(parsed);
          setTom(parsed.tomPadrao);
          setIdioma(parsed.idiomaPadrao);
          setFaixaPalavras(parsed.faixaPalavrasPadrao);
          setIncluirImagens(parsed.incluirImagensPadrao);
          setPrimeiraPessoa(Boolean(parsed.primeiraPessoaPadrao));
          setPesquisaWeb(parsed.pesquisaWebPadrao ?? "auto");
        }
      } catch {
        // Ignora erro de localStorage indisponível
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  function persistirArtigos(lista: ArtigoSalvo[]) {
    setArtigosSalvos(lista);
    try {
      localStorage.setItem(STORAGE_ARTICLES, JSON.stringify(lista));
    } catch {
      // Ignora quota cheia
    }
  }

  function registrarNotificacao(tituloNotif: string, detalhe: string) {
    const hora = new Date().toLocaleTimeString("pt-PT", {
      hour: "2-digit",
      minute: "2-digit",
    });
    setNotificacoes((prev) => [
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        titulo: tituloNotif,
        detalhe,
        hora,
        lida: false,
      },
      ...prev.slice(0, 9),
    ]);
  }

  function atualizarSecao(index: number, patch: Partial<Secao>) {
    setSecoes((prev) => {
      const next = prev.map((x, j) => (j === index ? { ...x, ...patch } : x));
      if (artigoAtualId) {
        setArtigosSalvos((lista) => {
          const atualizada = lista.map((a) =>
            a.id === artigoAtualId
              ? { ...a, secoes: next, totalPalavras: contarPalavras(next) }
              : a
          );
          try {
            localStorage.setItem(STORAGE_ARTICLES, JSON.stringify(atualizada));
          } catch {
            // Ignora
          }
          return atualizada;
        });
      }
      return next;
    });
  }

  async function gerarImagemSecao(
    index: number,
    prompt: string,
    signal?: AbortSignal
  ): Promise<string | undefined> {
    atualizarSecao(index, { aGerarImagem: true, erro: undefined });
    try {
      const { url } = await postJson("/api/image", { prompt }, signal);
      atualizarSecao(index, { img: url, aGerarImagem: false });
      return url;
    } catch (e) {
      if ((e as Error).name === "AbortError") {
        atualizarSecao(index, { aGerarImagem: false });
        return undefined;
      }
      atualizarSecao(index, {
        erro: (e as Error).message,
        aGerarImagem: false,
      });
      return undefined;
    }
  }

  const faixaAtual =
    FAIXAS_PALAVRAS.find((f) => f.id === faixaPalavras) ?? FAIXAS_PALAVRAS[2];

  async function gerarArtigo() {
    if (!tema.trim() || ocupado) return;
    const controller = new AbortController();
    abortRef.current = controller;

    setOcupado(true);
    setErroGeral("");
    setSecoes([]);
    setTitulo("");
    setFontes([]);
    setPesquisaUsada(false);
    setArtigoAtualId(null);

    try {
      let contextoPesquisa = "";
      let fontesPesquisadas: FontePesquisa[] = [];
      let usouPesquisa = false;

      if (pesquisaWeb !== "desativada") {
        setEstado("A avaliar e pesquisar fontes atualizadas na web…");
        const resPesquisa = await postJson(
          "/api/research",
          {
            tema: tema.trim(),
            descricao: descricao.trim(),
            palavrasChave,
            tom,
            idioma,
            modo: pesquisaWeb,
          },
          controller.signal
        );
        usouPesquisa = Boolean(resPesquisa.pesquisou);
        contextoPesquisa = resPesquisa.resumoPesquisa ?? "";
        fontesPesquisadas = resPesquisa.fontes ?? [];
        setPesquisaUsada(usouPesquisa);
        setFontes(fontesPesquisadas);
      }

      setEstado("A criar o esboço estruturado…");
      const esb = await postJson(
        "/api/outline",
        {
          tema: tema.trim(),
          secoes: faixaAtual.numSecoes,
          descricao: descricao.trim(),
          palavrasChave,
          tom,
          idioma,
          primeiraPessoa,
          contextoPesquisa,
        },
        controller.signal
      );

      let lista: Secao[] = esb.secoes;
      setTitulo(esb.titulo);
      setSecoes(lista);

      const alvoPorSecao = Math.ceil(faixaAtual.alvoPalavras / lista.length);
      let resumo = "";

      for (let i = 0; i < lista.length; i++) {
        if (controller.signal.aborted) break;
        setEstado(`A escrever a secção ${i + 1} de ${lista.length}…`);

        const { texto, prompt } = await postJson(
          "/api/section",
          {
            titulo: esb.titulo,
            indice: lista.map((s) => s.titulo),
            secao: lista[i],
            resumo,
            palavras: alvoPorSecao,
            tom,
            idioma,
            palavrasChave,
            descricao: descricao.trim(),
            primeiraPessoa,
            contextoPesquisa,
          },
          controller.signal
        );

        lista = lista.map((s, j) => (j === i ? { ...s, texto, prompt } : s));
        atualizarSecao(i, { texto, prompt });
        resumo += `- ${lista[i].titulo}: ${texto.slice(0, 200)}…\n`;

        if (incluirImagens && !controller.signal.aborted) {
          setEstado(`A gerar a imagem da secção ${i + 1} de ${lista.length}…`);
          const imgUrl = await gerarImagemSecao(i, prompt, controller.signal);
          if (imgUrl) {
            lista = lista.map((s, j) =>
              j === i ? { ...s, img: imgUrl } : s
            );
          }
        }
      }

      if (!controller.signal.aborted) {
        const novoId = `${Date.now()}`;
        const novoArtigo: ArtigoSalvo = {
          id: novoId,
          tema: tema.trim(),
          titulo: esb.titulo,
          descricao: descricao.trim(),
          palavrasChave,
          tom,
          idioma,
          faixaPalavras,
          primeiraPessoa,
          pesquisaUsada: usouPesquisa,
          fontes: fontesPesquisadas,
          secoes: lista,
          criadoEm: new Date().toISOString(),
          favorito: false,
          totalPalavras: contarPalavras(lista),
        };
        setArtigoAtualId(novoId);
        persistirArtigos([novoArtigo, ...artigosSalvos]);
        setEstado("Artigo concluído e guardado em Meus Artigos.");
        registrarNotificacao("Artigo concluído", esb.titulo);
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") {
        setEstado("Geração interrompida.");
      } else {
        setErroGeral((e as Error).message);
        setEstado("");
      }
    } finally {
      setOcupado(false);
      abortRef.current = null;
    }
  }

  function cancelarGeracao() {
    abortRef.current?.abort();
  }

  function handleUpdateTitulo(novo: string) {
    setTitulo(novo);
    if (artigoAtualId) {
      persistirArtigos(
        artigosSalvos.map((a) =>
          a.id === artigoAtualId ? { ...a, titulo: novo } : a
        )
      );
    }
  }

  function handleAddSecao() {
    const nova: Secao = {
      titulo: `Nova secção ${secoes.length + 1}`,
      objetivo: "Secção adicionada manualmente",
      texto: "",
    };
    const next = [...secoes, nova];
    setSecoes(next);
    if (artigoAtualId) {
      persistirArtigos(
        artigosSalvos.map((a) =>
          a.id === artigoAtualId ? { ...a, secoes: next } : a
        )
      );
    }
  }

  function handleRemoveSecao(index: number) {
    const next = secoes.filter((_, i) => i !== index);
    setSecoes(next);
    if (artigoAtualId) {
      persistirArtigos(
        artigosSalvos.map((a) =>
          a.id === artigoAtualId
            ? { ...a, secoes: next, totalPalavras: contarPalavras(next) }
            : a
        )
      );
    }
  }

  function toggleFavoritoPorId(id: string) {
    persistirArtigos(
      artigosSalvos.map((a) =>
        a.id === id ? { ...a, favorito: !a.favorito } : a
      )
    );
  }

  function abrirArtigoSalvo(artigo: ArtigoSalvo) {
    setTema(artigo.tema);
    setTitulo(artigo.titulo);
    setDescricao(artigo.descricao);
    setPalavrasChave(artigo.palavrasChave);
    setTom(artigo.tom);
    setIdioma(artigo.idioma);
    setFaixaPalavras(artigo.faixaPalavras);
    setPrimeiraPessoa(Boolean(artigo.primeiraPessoa));
    setPesquisaUsada(Boolean(artigo.pesquisaUsada));
    setFontes(artigo.fontes ?? []);
    setSecoes(artigo.secoes);
    setArtigoAtualId(artigo.id);
    setEstado("Artigo carregado do histórico.");
    setErroGeral("");
    setActiveTab("inicio");
  }

  function salvarConfigPadrao(nova: ConfiguracoesPadrao) {
    setConfigPadrao(nova);
    setTom(nova.tomPadrao);
    setIdioma(nova.idiomaPadrao);
    setFaixaPalavras(nova.faixaPalavrasPadrao);
    setIncluirImagens(nova.incluirImagensPadrao);
    setPrimeiraPessoa(Boolean(nova.primeiraPessoaPadrao));
    setPesquisaWeb(nova.pesquisaWebPadrao ?? "auto");
    try {
      localStorage.setItem(STORAGE_CONFIG, JSON.stringify(nova));
    } catch {
      // Ignora
    }
  }

  const artigoAtualObj = artigosSalvos.find((a) => a.id === artigoAtualId);
  const totalFavoritos = artigosSalvos.filter((a) => a.favorito).length;

  return (
    <div className="flex min-h-screen bg-[#F4F6FB] dark:bg-slate-950 transition-colors duration-150">
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        totalArtigos={artigosSalvos.length}
        totalFavoritos={totalFavoritos}
        onOpenModal={setModalTipo}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col px-4 py-4 sm:px-6 lg:px-8">
        <TopBar
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          notificacoes={notificacoes}
          onMarcarLidas={() =>
            setNotificacoes((prev) => prev.map((n) => ({ ...n, lida: true })))
          }
          onNavigate={setActiveTab}
        />

        <div className="mx-auto w-full max-w-[1360px] space-y-5 pb-10">
          <HeroBanner />

          {activeTab === "inicio" && (
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-[410px_minmax(0,1fr)] items-start">
              <div className="xl:sticky xl:top-5">
                <ArticleConfigForm
                  tema={tema}
                  onChangeTema={setTema}
                  palavrasChave={palavrasChave}
                  onChangePalavrasChave={setPalavrasChave}
                  descricao={descricao}
                  onChangeDescricao={setDescricao}
                  tom={tom}
                  onChangeTom={setTom}
                  idioma={idioma}
                  onChangeIdioma={setIdioma}
                  faixaPalavras={faixaPalavras}
                  onChangeFaixaPalavras={setFaixaPalavras}
                  incluirImagens={incluirImagens}
                  onChangeIncluirImagens={setIncluirImagens}
                  primeiraPessoa={primeiraPessoa}
                  onChangePrimeiraPessoa={setPrimeiraPessoa}
                  pesquisaWeb={pesquisaWeb}
                  onChangePesquisaWeb={setPesquisaWeb}
                  ocupado={ocupado}
                  onGerar={gerarArtigo}
                  onCancelar={cancelarGeracao}
                />
              </div>

              <ArticleWorkspace
                titulo={titulo}
                descricao={descricao}
                palavrasChave={palavrasChave}
                tom={tom}
                idioma={idioma}
                primeiraPessoa={primeiraPessoa}
                pesquisaUsada={pesquisaUsada}
                fontes={fontes}
                alvoPalavras={faixaAtual.alvoPalavras}
                secoes={secoes}
                estado={estado}
                erroGeral={erroGeral}
                ocupado={ocupado}
                favorito={artigoAtualObj?.favorito ?? false}
                temArtigoSalvo={Boolean(artigoAtualObj)}
                onToggleFavorito={() => {
                  if (artigoAtualId) toggleFavoritoPorId(artigoAtualId);
                }}
                onUpdateTitulo={handleUpdateTitulo}
                onUpdateSecao={atualizarSecao}
                onAddSecao={handleAddSecao}
                onRemoveSecao={handleRemoveSecao}
                onRegenerarImagem={(i, prompt) => gerarImagemSecao(i, prompt)}
                onExportarHtml={() => {
                  downloadArtigoHtml(titulo, descricao, secoes, fontes);
                  registrarNotificacao("HTML descarregado", titulo);
                }}
                onAplicarSugestao={(t, tags, desc) => {
                  setTema(t);
                  setPalavrasChave(tags);
                  setDescricao(desc);
                }}
              />
            </div>
          )}

          {(activeTab === "artigos" || activeTab === "favoritos") && (
            <ArticlesListView
              apenasFavoritos={activeTab === "favoritos"}
              artigos={artigosSalvos}
              onAbrirArtigo={abrirArtigoSalvo}
              onToggleFavorito={toggleFavoritoPorId}
              onExcluirArtigo={(id) => {
                persistirArtigos(artigosSalvos.filter((a) => a.id !== id));
                if (artigoAtualId === id) setArtigoAtualId(null);
              }}
              onBaixarHtml={(a) =>
                downloadArtigoHtml(a.titulo, a.descricao, a.secoes, a.fontes ?? [])
              }
              onIrParaInicio={() => setActiveTab("inicio")}
            />
          )}

          {activeTab === "estatisticas" && (
            <StatisticsView
              artigos={artigosSalvos}
              onAbrirArtigo={abrirArtigoSalvo}
            />
          )}

          {activeTab === "configuracoes" && (
            <SettingsView
              config={configPadrao}
              onSaveConfig={salvarConfigPadrao}
              onLimparHistorico={() => {
                persistirArtigos([]);
                setArtigoAtualId(null);
              }}
              totalArtigos={artigosSalvos.length}
            />
          )}
        </div>
      </div>

      <InfoModal tipo={modalTipo} onClose={() => setModalTipo(null)} />
    </div>
  );
}
