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
import type { RobotAnimationState } from "@/components/mascot/RobotAnimations";
import { useAuth } from "@/components/AuthProvider";
import { useTheme } from "@/components/ThemeProvider";
import {
  clearAllArticlesCloud,
  compressImageDataUrl,
  deleteArticleCloud,
  resolveSecoesImageUrls,
  sanitizeDocumentId,
  saveArticleCloud,
  saveUserSettings,
  subscribeUserArticles,
  subscribeUserPlan,
  subscribeUserSettings,
  toggleArticleFavoriteCloud,
  updateArticleContentCloud,
} from "@/lib/supabase-service";
import {
  FAIXAS_PALAVRAS,
  type ArtigoSalvo,
  type ConfiguracoesPadrao,
  type FaixaPalavrasId,
  type FontePesquisa,
  type ModoPesquisa,
  type NavTab,
  type NotificacaoItem,
  type PlanoGeracao,
  type Secao,
} from "@/lib/types";
import {
  FREE_PLAN,
  getPlanDisplayName,
  type BillingCycle,
} from "@/lib/pricing";

const STORAGE_ARTICLES = "artigoai:artigos:v1";
const STORAGE_CONFIG = "artigoai:config:v1";
const STORAGE_PLAN = "artigoai:plano:v1";

const DEFAULT_CONFIG: ConfiguracoesPadrao = {
  tomPadrao: "Informativo e Didático",
  idiomaPadrao: "Português (Brasil)",
  faixaPalavrasPadrao: "2000-2500",
  incluirImagensPadrao: true,
  primeiraPessoaPadrao: true,
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

export default function ArticleStudioApp() {
  const { user, profileReady } = useAuth();
  const { theme, setTheme } = useTheme();
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
  const [planoGeracao, setPlanoGeracao] = useState<PlanoGeracao>("free");
  const [activePlanId, setActivePlanId] = useState<string>("free");
  const [monthlyLimit, setMonthlyLimit] = useState<number>(
    FREE_PLAN.artigosMes
  );
  const [hasStripePortal, setHasStripePortal] = useState<boolean>(false);
  const [highlightPlanId, setHighlightPlanId] = useState<string | null>(null);
  const [initialBillingCycle, setInitialBillingCycle] =
    useState<BillingCycle>("monthly");

  // Active article workspace state
  const [artigoAtualId, setArtigoAtualId] = useState<string | null>(null);
  const [titulo, setTitulo] = useState("");
  const [secoes, setSecoes] = useState<Secao[]>([]);
  const [fontes, setFontes] = useState<FontePesquisa[]>([]);
  const [pesquisaUsada, setPesquisaUsada] = useState(false);
  const [estado, setEstado] = useState("");
  const [erroGeral, setErroGeral] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [sugerindo, setSugerindo] = useState(false);
  const [erroSugestao, setErroSugestao] = useState("");
  const [descricaoSugerida, setDescricaoSugerida] = useState(false);

  // Library & settings state
  const [artigosSalvos, setArtigosSalvos] = useState<ArtigoSalvo[]>([]);
  const [configPadrao, setConfigPadrao] =
    useState<ConfiguracoesPadrao>(DEFAULT_CONFIG);
  const [notificacoes, setNotificacoes] = useState<NotificacaoItem[]>([]);

  const abortRef = useRef<AbortController | null>(null);
  const cloudSyncTimerRef = useRef<number | null>(null);
  const migratedUidsRef = useRef<Set<string>>(new Set());
  const artigoAtualIdRef = useRef<string | null>(null);
  const latestWorkspaceRef = useRef({
    titulo: "",
    descricao: "",
    secoes: [] as Secao[],
  });

  useEffect(() => {
    artigoAtualIdRef.current = artigoAtualId;
  }, [artigoAtualId]);

  useEffect(() => {
    latestWorkspaceRef.current = { titulo, descricao, secoes };
  }, [titulo, descricao, secoes]);

  useEffect(() => {
    let mounted = true;
    Promise.resolve().then(() => {
      if (!mounted) return;
      try {
        const params = new URLSearchParams(window.location.search);
        const planParam =
          params.get("assinar") || params.get("comprar") || params.get("pacote");
        const cicloParam = params.get("ciclo");
        const stripeState = params.get("stripe");

        if (cicloParam === "yearly") {
          setInitialBillingCycle("yearly");
        }

        if (stripeState === "cancel") {
          setEstado(
            "Assinatura cancelada na Stripe. Você pode continuar no Plano Grátis ou escolher outro plano."
          );
          window.history.replaceState({}, "", "/studio");
        } else if (stripeState === "portal_return") {
          window.history.replaceState({}, "", "/studio");
        } else if (planParam && planParam !== "free" && !stripeState) {
          setHighlightPlanId(planParam);
          setModalTipo("upgrade");
          window.history.replaceState({}, "", "/studio");
        }

        const rawPlan = localStorage.getItem(STORAGE_PLAN);
        if (rawPlan === "paid" || rawPlan === "free") {
          setPlanoGeracao(rawPlan);
        }
      } catch {
        // Ignora erro de localStorage
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Verifica sessão de retorno da Stripe após autenticar usuário
  useEffect(() => {
    if (!user) return;
    let mounted = true;
    const params = new URLSearchParams(window.location.search);
    const stripeState = params.get("stripe");
    const sessionId = params.get("session_id");
    if (stripeState !== "success" || !sessionId) return;

    void (async () => {
      try {
        setEstado("A confirmar assinatura na Stripe…");
        const res = await fetch(
          `/api/stripe/verify-session?session_id=${encodeURIComponent(sessionId)}`
        );
        const data = (await res.json()) as {
          paid?: boolean;
          planId?: string;
          billingCycle?: BillingCycle;
          articlesPerMonth?: number;
          erro?: string;
        };
        if (!mounted) return;

        if (res.ok && data.paid && data.planId) {
          setPlanoGeracao("paid");
          setActivePlanId(data.planId);
          setHasStripePortal(true);
          const limit = data.articlesPerMonth ?? FREE_PLAN.artigosMes;
          setMonthlyLimit(limit);
          try {
            localStorage.setItem(STORAGE_PLAN, "paid");
          } catch {
            // Ignora
          }
          const planLabel = getPlanDisplayName(data.planId);
          setEstado(
            `Assinatura ${planLabel} confirmada via Stripe! ${limit} artigos por mês liberados.`
          );
          registrarNotificacao(
            "Assinatura Stripe confirmada",
            `Plano ${planLabel} (${limit} artigos/mês) ativo no Google Gemini`
          );
        } else {
          setErroGeral(
            data.erro ?? "Não foi possível confirmar a assinatura na Stripe."
          );
          setEstado("");
        }
      } catch {
        if (mounted) {
          setErroGeral("Erro ao validar a sessão de assinatura da Stripe.");
          setEstado("");
        }
      } finally {
        if (mounted) {
          window.history.replaceState({}, "", "/studio");
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [user]);

  // Load persisted data after mount (localStorage fallback + Supabase real-time sync)
  useEffect(() => {
    let mounted = true;

    if (!user) {
      Promise.resolve().then(() => {
        if (!mounted) return;
        try {
          const rawArtigos = localStorage.getItem(STORAGE_ARTICLES);
          if (rawArtigos) {
            setArtigosSalvos(JSON.parse(rawArtigos));
          }
          const rawConfig = localStorage.getItem(STORAGE_CONFIG);
          if (rawConfig) {
            const parsed: Partial<ConfiguracoesPadrao> = JSON.parse(rawConfig);
            const merged: ConfiguracoesPadrao = {
              ...DEFAULT_CONFIG,
              ...parsed,
            };
            setConfigPadrao(merged);
            setTom(merged.tomPadrao);
            setIdioma(merged.idiomaPadrao);
            setFaixaPalavras(merged.faixaPalavrasPadrao);
            setIncluirImagens(merged.incluirImagensPadrao);
            setPrimeiraPessoa(Boolean(merged.primeiraPessoaPadrao));
            setPesquisaWeb(merged.pesquisaWebPadrao ?? "auto");
          }
        } catch {
          // Ignora erro de localStorage indisponível
        }
      });
      return () => {
        mounted = false;
      };
    }

    if (!profileReady) {
      return () => {
        mounted = false;
      };
    }

    const uid = user.uid;

    const unsubSettings = subscribeUserSettings(uid, (remote) => {
      if (!mounted) return;
      setConfigPadrao((prev) => {
        const merged: ConfiguracoesPadrao = {
          tomPadrao: remote.tomPadrao ?? prev.tomPadrao,
          idiomaPadrao: remote.idiomaPadrao ?? prev.idiomaPadrao,
          faixaPalavrasPadrao:
            remote.faixaPalavrasPadrao ?? prev.faixaPalavrasPadrao,
          incluirImagensPadrao:
            remote.incluirImagensPadrao ?? prev.incluirImagensPadrao,
          primeiraPessoaPadrao:
            remote.primeiraPessoaPadrao ?? prev.primeiraPessoaPadrao,
          pesquisaWebPadrao: remote.pesquisaWebPadrao ?? prev.pesquisaWebPadrao,
        };
        setTom(merged.tomPadrao);
        setIdioma(merged.idiomaPadrao);
        setFaixaPalavras(merged.faixaPalavrasPadrao);
        setIncluirImagens(merged.incluirImagensPadrao);
        setPrimeiraPessoa(Boolean(merged.primeiraPessoaPadrao));
        setPesquisaWeb(merged.pesquisaWebPadrao ?? "auto");
        return merged;
      });
      if (remote.theme) {
        setTheme(remote.theme);
      }
    });

    const unsubArticles = subscribeUserArticles(uid, (remoteArticles) => {
      if (!mounted) return;

      // Migrate local guest articles into user's Firestore collection once after sign-in
      if (!migratedUidsRef.current.has(uid)) {
        migratedUidsRef.current.add(uid);
        try {
          const rawLocal = localStorage.getItem(STORAGE_ARTICLES);
          if (rawLocal) {
            const localList: ArtigoSalvo[] = JSON.parse(rawLocal);
            if (Array.isArray(localList) && localList.length > 0) {
              const existingIds = new Set(
                remoteArticles.map((a) => sanitizeDocumentId(a.id))
              );
              const toUpload = localList.filter(
                (item) => !existingIds.has(sanitizeDocumentId(item.id))
              );
              for (const item of toUpload) {
                void saveArticleCloud(uid, item);
              }
            }
          }
        } catch {
          // Ignora erro ao migrar histórico local
        }
      }

      setArtigosSalvos(remoteArticles);
      try {
        localStorage.setItem(STORAGE_ARTICLES, JSON.stringify(remoteArticles));
      } catch {
        // Ignora quota cheia
      }
    });

    const unsubPlan = subscribeUserPlan(uid, (info) => {
      if (!mounted) return;
      setActivePlanId(info.plan);
      setMonthlyLimit(info.monthlyLimit);
      setHasStripePortal(info.hasStripePortal);
      setPlanoGeracao(info.planoGeracao);
      try {
        localStorage.setItem(STORAGE_PLAN, info.planoGeracao);
      } catch {
        // Ignora
      }
    });

    return () => {
      mounted = false;
      unsubSettings();
      unsubArticles();
      unsubPlan();
    };
  }, [user, profileReady, setTheme]);

  useEffect(() => {
    return () => {
      if (cloudSyncTimerRef.current) {
        window.clearTimeout(cloudSyncTimerRef.current);
      }
    };
  }, []);

  function agendarSyncConteudoNuvem(
    articleId: string,
    novoTitulo: string,
    novaDescricao: string,
    novasSecoes: Secao[]
  ) {
    if (!user) return;
    const uid = user.uid;
    if (cloudSyncTimerRef.current) {
      window.clearTimeout(cloudSyncTimerRef.current);
    }
    cloudSyncTimerRef.current = window.setTimeout(() => {
      void updateArticleContentCloud(
        uid,
        articleId,
        novoTitulo,
        novaDescricao,
        novasSecoes,
        contarPalavras(novasSecoes)
      ).then((res) => {
        if (!res.ok) return;
        setArtigosSalvos((lista) => {
          const atualizada = lista.map((a) =>
            a.id === articleId
              ? {
                  ...a,
                  secoes: a.secoes.map((sec, idx) =>
                    res.secoes[idx]?.img ? { ...sec, img: res.secoes[idx].img } : sec
                  ),
                }
              : a
          );
          try {
            localStorage.setItem(STORAGE_ARTICLES, JSON.stringify(atualizada));
          } catch {
            // Ignora quota cheia
          }
          return atualizada;
        });
        setSecoes((prev) =>
          prev.map((sec, idx) =>
            res.secoes[idx]?.img && sec.img?.startsWith("data:")
              ? { ...sec, img: res.secoes[idx].img }
              : sec
          )
        );
      });
    }, 650);
  }

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
        agendarSyncConteudoNuvem(
          artigoAtualId,
          latestWorkspaceRef.current.titulo,
          latestWorkspaceRef.current.descricao,
          next
        );
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
      const { url } = await postJson(
        "/api/image",
        { prompt, plano: planoGeracao },
        signal
      );
      const finalUrl =
        typeof url === "string" && url.startsWith("data:image/") && !user
          ? await compressImageDataUrl(url)
          : url;
      atualizarSecao(index, { img: finalUrl, aGerarImagem: false });
      return finalUrl;
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

  async function sugerirComIa() {
    if (tema.trim().length < 3 || ocupado || sugerindo) return;
    setSugerindo(true);
    setErroSugestao("");
    try {
      const sug = await postJson("/api/suggest", {
        tema: tema.trim(),
        idioma,
        plano: planoGeracao,
      });
      if (Array.isArray(sug.palavrasChave)) {
        setPalavrasChave(sug.palavrasChave);
      }
      if (typeof sug.descricao === "string") {
        setDescricao(sug.descricao);
        setDescricaoSugerida(Boolean(sug.descricao));
      }
      if (sug.tom) setTom(sug.tom);
      if (sug.faixaPalavras) setFaixaPalavras(sug.faixaPalavras);
      if (typeof sug.primeiraPessoa === "boolean") {
        setPrimeiraPessoa(sug.primeiraPessoa);
      }
      if (sug.pesquisaWeb) setPesquisaWeb(sug.pesquisaWeb);
    } catch (e) {
      setErroSugestao((e as Error).message);
    } finally {
      setSugerindo(false);
    }
  }

  async function gerarArtigo() {
    if (!tema.trim() || ocupado) return;
    const controller = new AbortController();
    abortRef.current = controller;

    setOcupado(true);
    setErroGeral("");
    setErroSugestao("");
    setSecoes([]);
    setTitulo("");
    setFontes([]);
    setPesquisaUsada(false);
    setArtigoAtualId(null);

    try {
      let descEfetiva = descricao.trim();
      let tagsEfetivas = palavrasChave;
      let tomEfetivo = tom;
      let faixaEfetiva = faixaAtual;
      let primeiraPessoaEfetiva = primeiraPessoa;
      let pesquisaEfetiva = pesquisaWeb;

      if (!descEfetiva && tagsEfetivas.length === 0) {
        try {
          setEstado("A sugerir descrição, palavras-chave e estilo com IA…");
          const sug = await postJson(
            "/api/suggest",
            { tema: tema.trim(), idioma, plano: planoGeracao },
            controller.signal
          );
          if (Array.isArray(sug.palavrasChave) && sug.palavrasChave.length > 0) {
            tagsEfetivas = sug.palavrasChave;
            setPalavrasChave(tagsEfetivas);
          }
          if (typeof sug.descricao === "string" && sug.descricao.trim()) {
            descEfetiva = sug.descricao.trim();
            setDescricao(descEfetiva);
            setDescricaoSugerida(true);
          }
          if (sug.tom) {
            tomEfetivo = sug.tom;
            setTom(tomEfetivo);
          }
          if (sug.faixaPalavras) {
            const encontrada = FAIXAS_PALAVRAS.find(
              (f) => f.id === sug.faixaPalavras
            );
            if (encontrada) {
              faixaEfetiva = encontrada;
              setFaixaPalavras(encontrada.id);
            }
          }
          if (typeof sug.primeiraPessoa === "boolean") {
            primeiraPessoaEfetiva = sug.primeiraPessoa;
            setPrimeiraPessoa(primeiraPessoaEfetiva);
          }
          if (sug.pesquisaWeb) {
            pesquisaEfetiva = sug.pesquisaWeb;
            setPesquisaWeb(pesquisaEfetiva);
          }
        } catch (sugErr) {
          if ((sugErr as Error).name === "AbortError") throw sugErr;
        }
      }

      let contextoPesquisa = "";
      let fontesPesquisadas: FontePesquisa[] = [];
      let usouPesquisa = false;

      if (pesquisaEfetiva !== "desativada") {
        setEstado("A avaliar e pesquisar fontes atualizadas na web…");
        const resPesquisa = await postJson(
          "/api/research",
          {
            tema: tema.trim(),
            descricao: descEfetiva,
            palavrasChave: tagsEfetivas,
            tom: tomEfetivo,
            idioma,
            modo: pesquisaEfetiva,
            plano: planoGeracao,
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
          secoes: faixaEfetiva.numSecoes,
          descricao: descEfetiva,
          palavrasChave: tagsEfetivas,
          tom: tomEfetivo,
          idioma,
          primeiraPessoa: primeiraPessoaEfetiva,
          contextoPesquisa,
          plano: planoGeracao,
        },
        controller.signal
      );

      let lista: Secao[] = esb.secoes;
      setTitulo(esb.titulo);
      setSecoes(lista);

      const alvoPorSecao = Math.ceil(faixaEfetiva.alvoPalavras / lista.length);
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
            tom: tomEfetivo,
            idioma,
            palavrasChave: tagsEfetivas,
            descricao: descEfetiva,
            primeiraPessoa: primeiraPessoaEfetiva,
            contextoPesquisa,
            plano: planoGeracao,
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
        const novoId = `art_${Date.now()}`;
        const secoesParaLocal = !user
          ? await Promise.all(
              lista.map(async (s) =>
                s.img?.startsWith("data:image/")
                  ? { ...s, img: await compressImageDataUrl(s.img) }
                  : s
              )
            )
          : lista;

        const novoArtigo: ArtigoSalvo = {
          id: novoId,
          tema: tema.trim(),
          titulo: esb.titulo,
          descricao: descEfetiva,
          palavrasChave: tagsEfetivas,
          tom: tomEfetivo,
          idioma,
          faixaPalavras: faixaEfetiva.id,
          primeiraPessoa: primeiraPessoaEfetiva,
          pesquisaUsada: usouPesquisa,
          fontes: fontesPesquisadas,
          secoes: secoesParaLocal,
          criadoEm: new Date().toISOString(),
          favorito: false,
          totalPalavras: contarPalavras(secoesParaLocal),
        };

        setArtigoAtualId(novoId);
        setArtigosSalvos((prev) => {
          const atualizada = [
            novoArtigo,
            ...prev.filter((a) => a.id !== novoId),
          ];
          try {
            localStorage.setItem(STORAGE_ARTICLES, JSON.stringify(atualizada));
          } catch {
            // Ignora quota cheia
          }
          return atualizada;
        });

        if (user) {
          setEstado("A guardar artigo e imagens no banco de dados…");
          const cloudRes = await saveArticleCloud(user.uid, novoArtigo);
          const artigoPersistido: ArtigoSalvo = {
            ...novoArtigo,
            secoes: cloudRes.secoes,
            totalPalavras: contarPalavras(cloudRes.secoes),
          };
          setSecoes(artigoPersistido.secoes);
          setArtigosSalvos((prev) => {
            const atualizada = prev.map((a) =>
              a.id === novoId ? artigoPersistido : a
            );
            try {
              localStorage.setItem(STORAGE_ARTICLES, JSON.stringify(atualizada));
            } catch {
              // Ignora quota cheia
            }
            return atualizada;
          });
          if (!cloudRes.ok && cloudRes.error) {
            setErroGeral(
              `Artigo guardado localmente, mas houve falha ao sincronizar no Supabase: ${cloudRes.error}`
            );
          }
        }

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
      agendarSyncConteudoNuvem(artigoAtualId, novo, descricao, secoes);
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
      agendarSyncConteudoNuvem(artigoAtualId, titulo, descricao, next);
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
      agendarSyncConteudoNuvem(artigoAtualId, titulo, descricao, next);
    }
  }

  function toggleFavoritoPorId(id: string) {
    const target = artigosSalvos.find((a) => a.id === id);
    const nextFav = target ? !target.favorito : true;
    persistirArtigos(
      artigosSalvos.map((a) =>
        a.id === id ? { ...a, favorito: !a.favorito } : a
      )
    );
    if (user && profileReady) {
      void toggleArticleFavoriteCloud(user.uid, id, nextFav);
    }
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
    artigoAtualIdRef.current = artigo.id;
    setEstado("Artigo carregado do histórico.");
    setErroGeral("");
    setErroSugestao("");
    setDescricaoSugerida(false);
    setActiveTab("inicio");

    if (user && artigo.secoes.some((s) => Boolean(s.img))) {
      void resolveSecoesImageUrls(artigo.secoes).then((resolvedSecoes) => {
        if (artigoAtualIdRef.current !== artigo.id) return;
        setSecoes(resolvedSecoes);
      });
    }
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
    if (user && profileReady) {
      void saveUserSettings(user.uid, nova, theme);
    }
  }

  function handleChangePlanoGeracao(novoPlano: PlanoGeracao) {
    setPlanoGeracao(novoPlano);
    try {
      localStorage.setItem(STORAGE_PLAN, novoPlano);
    } catch {
      // Ignora
    }
  }

  const artigoAtualObj = artigosSalvos.find((a) => a.id === artigoAtualId);
  const totalFavoritos = artigosSalvos.filter((a) => a.favorito).length;
  const mascotState: RobotAnimationState =
    ocupado && secoes.length > 0
      ? "writing"
      : ocupado || sugerindo
      ? "thinking"
      : estado.includes("concluído") ||
        (secoes.length > 0 && !erroGeral && secoes.every((s) => Boolean(s.texto)))
      ? "excited"
      : "idle";

  return (
    <div className="flex min-h-screen xl:h-screen xl:overflow-hidden bg-[#F4F6FB] dark:bg-slate-950 transition-colors duration-150">
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        totalArtigos={artigosSalvos.length}
        totalFavoritos={totalFavoritos}
        onOpenModal={setModalTipo}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        ocupado={ocupado}
        planoGeracao={planoGeracao}
        activePlanId={activePlanId}
        monthlyLimit={monthlyLimit}
      />

      <div className="flex min-w-0 min-h-0 flex-1 flex-col px-4 py-4 sm:px-6 lg:px-8 xl:overflow-hidden">
        <div className="shrink-0">
          <TopBar
            onOpenMobileMenu={() => setMobileMenuOpen(true)}
            notificacoes={notificacoes}
            onMarcarLidas={() =>
              setNotificacoes((prev) => prev.map((n) => ({ ...n, lida: true })))
            }
            onNavigate={setActiveTab}
          />
        </div>

        <div className="mx-auto flex min-h-0 w-full max-w-[1360px] flex-1 flex-col gap-4 pb-6 xl:pb-1">
          <div className="shrink-0">
            <HeroBanner mascotState={mascotState} />
          </div>

          {activeTab === "inicio" && (
            <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 xl:grid-cols-[410px_minmax(0,1fr)] xl:grid-rows-[minmax(0,1fr)]">
              <div className="min-h-0 xl:h-full">
                <ArticleConfigForm
                  tema={tema}
                  onChangeTema={setTema}
                  palavrasChave={palavrasChave}
                  onChangePalavrasChave={setPalavrasChave}
                  descricao={descricao}
                  onChangeDescricao={(val) => {
                    setDescricao(val);
                    setDescricaoSugerida(false);
                  }}
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
                  planoGeracao={planoGeracao}
                  onChangePlanoGeracao={handleChangePlanoGeracao}
                  sugerindo={sugerindo}
                  erroSugestao={erroSugestao}
                  descricaoSugerida={descricaoSugerida}
                  onSugerirComIa={sugerirComIa}
                  ocupado={ocupado}
                  onGerar={gerarArtigo}
                  onCancelar={cancelarGeracao}
                />
              </div>

              <div className="min-h-0 xl:h-full">
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
            </div>
          )}

          {(activeTab === "artigos" || activeTab === "favoritos") && (
            <div className="min-h-0 flex-1">
              <ArticlesListView
                apenasFavoritos={activeTab === "favoritos"}
                artigos={artigosSalvos}
                onAbrirArtigo={abrirArtigoSalvo}
                onToggleFavorito={toggleFavoritoPorId}
                onExcluirArtigo={(id) => {
                  persistirArtigos(artigosSalvos.filter((a) => a.id !== id));
                  if (artigoAtualId === id) setArtigoAtualId(null);
                  if (user && profileReady) {
                    void deleteArticleCloud(user.uid, id);
                  }
                }}
                onBaixarHtml={(a) =>
                  downloadArtigoHtml(a.titulo, a.descricao, a.secoes, a.fontes ?? [])
                }
                onIrParaInicio={() => setActiveTab("inicio")}
              />
            </div>
          )}

          {activeTab === "estatisticas" && (
            <div className="min-h-0 flex-1">
              <StatisticsView
                artigos={artigosSalvos}
                onAbrirArtigo={abrirArtigoSalvo}
                onIrParaInicio={() => setActiveTab("inicio")}
              />
            </div>
          )}

          {activeTab === "configuracoes" && (
            <div className="min-h-0 flex-1">
              <SettingsView
                key={`${configPadrao.tomPadrao}-${configPadrao.idiomaPadrao}-${configPadrao.faixaPalavrasPadrao}-${configPadrao.incluirImagensPadrao}-${configPadrao.primeiraPessoaPadrao}-${configPadrao.pesquisaWebPadrao}`}
                config={configPadrao}
                onSaveConfig={salvarConfigPadrao}
                onLimparHistorico={() => {
                  persistirArtigos([]);
                  setArtigoAtualId(null);
                  if (user && profileReady) {
                    void clearAllArticlesCloud(user.uid);
                  }
                }}
                totalArtigos={artigosSalvos.length}
              />
            </div>
          )}
        </div>
      </div>

      <InfoModal
        key={`${modalTipo ?? "closed"}-${initialBillingCycle}-${highlightPlanId ?? "none"}`}
        tipo={modalTipo}
        onClose={() => {
          setModalTipo(null);
          setHighlightPlanId(null);
        }}
        planoGeracao={planoGeracao}
        onSelectPlanoGeracao={handleChangePlanoGeracao}
        activePlanId={activePlanId}
        monthlyLimit={monthlyLimit}
        hasStripePortal={hasStripePortal}
        highlightPlanId={highlightPlanId}
        initialBillingCycle={initialBillingCycle}
      />
    </div>
  );
}
