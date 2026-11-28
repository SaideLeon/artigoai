"use client";

import { useCallback, useState, useEffect, useRef } from "react";
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
import AdminEmailInbox from "@/components/AdminEmailInbox";
import InfoModal from "@/components/InfoModal";
import VoiceNarrationModal, {
  type VoiceNarrationApplyPayload,
} from "@/components/VoiceNarrationModal";
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
  DEFAULT_ESTILO_IMAGEM,
  FAIXAS_PALAVRAS,
  isValidEstiloImagemId,
  type ArtigoSalvo,
  type ConfiguracoesPadrao,
  type EstiloImagemId,
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
  estiloImagemPadrao: DEFAULT_ESTILO_IMAGEM,
  primeiraPessoaPadrao: true,
  pesquisaWebPadrao: "auto",
};

type QuotaErrorPayload = {
  erro?: string;
  code?: string;
};

class StudioApiError extends Error {
  code?: string;
  status: number;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "StudioApiError";
    this.status = status;
    this.code = code;
  }
}

type SuggestApiResponse = {
  temaSugerido?: string;
  palavrasChave?: string[];
  descricao?: string;
  tom?: string;
  faixaPalavras?: FaixaPalavrasId;
  primeiraPessoa?: boolean;
  pesquisaWeb?: ModoPesquisa;
};

type ResearchApiResponse = {
  pesquisou?: boolean;
  resumoPesquisa?: string;
  contextoPrimario?: string;
  fontes?: FontePesquisa[];
};

type OutlineApiResponse = {
  titulo: string;
  secoes: Secao[];
  quota?: unknown;
};

type SectionApiResponse = {
  texto: string;
  prompt?: string;
  quota?: unknown;
};

type ImageApiResponse = {
  url: string;
  quota?: {
    snapshot?: unknown;
    deductedArticleCredit?: boolean;
  };
};

async function postJson<T extends Record<string, unknown>>(
  url: string,
  corpo: unknown,
  signal?: AbortSignal
): Promise<T> {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(corpo),
    signal,
  });
  const d = (await r.json()) as Record<string, unknown> & QuotaErrorPayload;
  if (!r.ok) {
    throw new StudioApiError(
      typeof d.erro === "string" ? d.erro : "Erro desconhecido",
      r.status,
      typeof d.code === "string" ? d.code : undefined
    );
  }
  return d as unknown as T;
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
          .map((f) => {
            const safeUrl = /^https?:\/\//i.test(f.url) ? f.url : "#";
            const badge =
              f.tipo === "primaria"
                ? "<strong>[Fonte primária]</strong> "
                : f.tipo === "secundaria"
                ? "[Apoio secundário] "
                : "";
            return `<li>${badge}<a href="${escapeHtml(
              safeUrl
            )}" target="_blank" rel="noopener noreferrer">${escapeHtml(
              f.titulo
            )}</a></li>`;
          })
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
  const [estiloImagem, setEstiloImagem] = useState<EstiloImagemId>(
    DEFAULT_CONFIG.estiloImagemPadrao ?? DEFAULT_ESTILO_IMAGEM
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
  const [monthlyUsed, setMonthlyUsed] = useState<number>(0);
  const [monthlyImagesLimit, setMonthlyImagesLimit] = useState<number>(
    FREE_PLAN.imagensMes
  );
  const [monthlyImagesUsed, setMonthlyImagesUsed] = useState<number>(0);
  const [hasSubscriptionPortal, setHasSubscriptionPortal] =
    useState<boolean>(false);
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
  const [narracaoContexto, setNarracaoContexto] = useState("");
  const [linksReferencia, setLinksReferencia] = useState<string[]>([]);
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);

  // Library & settings state
  const [artigosSalvos, setArtigosSalvos] = useState<ArtigoSalvo[]>([]);
  const [configPadrao, setConfigPadrao] =
    useState<ConfiguracoesPadrao>(DEFAULT_CONFIG);
  const [notificacoes, setNotificacoes] = useState<NotificacaoItem[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [unreadInboxCount, setUnreadInboxCount] = useState(0);

  const abortRef = useRef<AbortController | null>(null);
  const cloudSyncTimerRef = useRef<number | null>(null);
  const migratedUidsRef = useRef<Set<string>>(new Set());
  const notifiedEmailIdsRef = useRef<Set<string>>(new Set());
  const artigoAtualIdRef = useRef<string | null>(null);
  const activeSessionKeyRef = useRef<string | null>(null);
  const latestWorkspaceRef = useRef({
    titulo: "",
    descricao: "",
    secoes: [] as Secao[],
  });

  const syncQuotaFromApi = useCallback((snapshot: unknown) => {
    if (!snapshot || typeof snapshot !== "object") return;
    const s = snapshot as {
      monthlyArticlesUsed?: number;
      monthlyArticlesLimit?: number;
      monthlyImagesUsed?: number;
      monthlyImagesLimit?: number;
    };
    if (typeof s.monthlyArticlesUsed === "number") {
      setMonthlyUsed(s.monthlyArticlesUsed);
    }
    if (typeof s.monthlyArticlesLimit === "number") {
      setMonthlyLimit(s.monthlyArticlesLimit);
    }
    if (typeof s.monthlyImagesUsed === "number") {
      setMonthlyImagesUsed(s.monthlyImagesUsed);
    }
    if (typeof s.monthlyImagesLimit === "number") {
      setMonthlyImagesLimit(s.monthlyImagesLimit);
    }
  }, []);

  const refreshUsageSnapshot = useCallback(async () => {
    try {
      const res = await fetch("/api/usage", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      syncQuotaFromApi(data);
    } catch {
      // Ignora erro de rede não-crítico
    }
  }, [syncQuotaFromApi]);

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
        const caktoState = params.get("cakto");

        if (cicloParam === "yearly") {
          setInitialBillingCycle("yearly");
        }

        if (caktoState === "cancel") {
          setEstado(
            "Pagamento cancelado na Cakto. Você pode continuar no Plano Grátis ou escolher outro plano via Pix ou Cartão."
          );
          window.history.replaceState({}, "", "/studio");
        } else if (caktoState === "portal_return") {
          window.history.replaceState({}, "", "/studio");
        } else if (planParam && planParam !== "free" && !caktoState) {
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

  // Verifica pedido de retorno da Cakto após autenticar utilizador
  useEffect(() => {
    if (!user) return;
    let mounted = true;
    const params = new URLSearchParams(window.location.search);
    const caktoState = params.get("cakto");
    const statusParam = params.get("status");
    const orderId = params.get("order_id") || params.get("ref_id") || "";
    const shouldVerify =
      caktoState === "success" ||
      statusParam === "approved" ||
      statusParam === "paid" ||
      Boolean(orderId);
    if (!shouldVerify) return;

    void (async () => {
      try {
        setEstado("A confirmar pagamento na Cakto…");
        const query = orderId
          ? `?order_id=${encodeURIComponent(orderId)}`
          : "";
        const res = await fetch(`/api/cakto/verify-order${query}`);
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
          setHasSubscriptionPortal(true);
          const limit = data.articlesPerMonth ?? FREE_PLAN.artigosMes;
          setMonthlyLimit(limit);
          setMonthlyUsed(0);
          void refreshUsageSnapshot();
          try {
            localStorage.setItem(STORAGE_PLAN, "paid");
          } catch {
            // Ignora
          }
          const planLabel = getPlanDisplayName(data.planId);
          setEstado(
            `Assinatura ${planLabel} confirmada via Cakto! ${limit} artigos por mês liberados.`
          );
          registrarNotificacao(
            "Assinatura Cakto confirmada",
            `Plano ${planLabel} (${limit} artigos/mês) ativo no Google Gemini`
          );
        } else {
          setErroGeral(
            data.erro ??
              "Pagamento ainda pendente de confirmação na Cakto. Se pagou via Pix, aguarde alguns instantes."
          );
          setEstado("");
        }
      } catch {
        if (mounted) {
          setErroGeral("Erro ao validar o pagamento da Cakto.");
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
  }, [user, refreshUsageSnapshot]);

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
            setEstiloImagem(
              isValidEstiloImagemId(merged.estiloImagemPadrao)
                ? merged.estiloImagemPadrao
                : DEFAULT_ESTILO_IMAGEM
            );
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
          estiloImagemPadrao:
            remote.estiloImagemPadrao ?? prev.estiloImagemPadrao,
          primeiraPessoaPadrao:
            remote.primeiraPessoaPadrao ?? prev.primeiraPessoaPadrao,
          pesquisaWebPadrao: remote.pesquisaWebPadrao ?? prev.pesquisaWebPadrao,
        };
        setTom(merged.tomPadrao);
        setIdioma(merged.idiomaPadrao);
        setFaixaPalavras(merged.faixaPalavrasPadrao);
        setIncluirImagens(merged.incluirImagensPadrao);
        setEstiloImagem(
          isValidEstiloImagemId(merged.estiloImagemPadrao)
            ? merged.estiloImagemPadrao
            : DEFAULT_ESTILO_IMAGEM
        );
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
      setMonthlyUsed(info.monthlyUsed);
      setMonthlyImagesLimit(info.monthlyImagesLimit);
      setMonthlyImagesUsed(info.monthlyImagesUsed);
      setHasSubscriptionPortal(info.hasSubscriptionPortal);
      setPlanoGeracao(info.planoGeracao);
      try {
        localStorage.setItem(STORAGE_PLAN, info.planoGeracao);
      } catch {
        // Ignora
      }
    });

    Promise.resolve().then(() => {
      if (mounted) void refreshUsageSnapshot();
    });

    return () => {
      mounted = false;
      unsubSettings();
      unsubArticles();
      unsubPlan();
    };
  }, [user, profileReady, setTheme, refreshUsageSnapshot]);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) void refreshUsageSnapshot();
    });
    return () => {
      active = false;
    };
  }, [user?.uid, refreshUsageSnapshot]);

  useEffect(() => {
    if (!user?.uid) {
      Promise.resolve().then(() => {
        setIsAdmin(false);
        setUnreadInboxCount(0);
      });
      return;
    }

    let active = true;
    const checkAdminInbox = async () => {
      try {
        const res = await fetch("/api/admin/session", { cache: "no-store" });
        if (!res.ok || !active) return;
        const payload = (await res.json()) as {
          isAdmin?: boolean;
          unreadInboxCount?: number;
          recentUnread?: Array<{
            id: string;
            subject: string;
            participantName: string;
            participantEmail: string;
            snippet: string;
            lastMessageAt: string;
          }>;
        };

        if (!active) return;
        const adminOk = Boolean(payload.isAdmin);
        setIsAdmin(adminOk);
        if (!adminOk) {
          setUnreadInboxCount(0);
          return;
        }

        const unreadTotal = Number(payload.unreadInboxCount ?? 0);
        setUnreadInboxCount(unreadTotal);

        const freshUnread = (payload.recentUnread ?? []).filter(
          (item) => !notifiedEmailIdsRef.current.has(item.id)
        );
        if (freshUnread.length > 0) {
          for (const item of freshUnread) {
            notifiedEmailIdsRef.current.add(item.id);
          }
          setNotificacoes((prev) => [
            ...freshUnread.slice(0, 3).map((item) => ({
              id: `inbox-${item.id}`,
              titulo: `Novo e-mail de ${item.participantName || item.participantEmail}`,
              detalhe: `${item.subject} — ${item.snippet}`,
              hora: new Date(item.lastMessageAt).toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              }),
              lida: false,
            })),
            ...prev,
          ].slice(0, 12));
        }
      } catch {
        // Ignora erro de rede não-crítico
      }
    };

    Promise.resolve().then(() => {
      if (active) void checkAdminInbox();
    });

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void checkAdminInbox();
      }
    }, 45_000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [user?.uid]);

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
    signal?: AbortSignal,
    explicitSessionKey?: string,
    explicitEstiloImagem?: EstiloImagemId
  ): Promise<string | undefined> {
    atualizarSecao(index, { aGerarImagem: true, erro: undefined });
    try {
      const sessionKeyToSend =
        explicitSessionKey ??
        activeSessionKeyRef.current ??
        artigoAtualIdRef.current ??
        undefined;
      const res = await postJson<ImageApiResponse>(
        "/api/image",
        {
          prompt,
          estiloImagem: explicitEstiloImagem ?? estiloImagem,
          plano: planoGeracao,
          sessionKey: sessionKeyToSend,
        },
        signal
      );
      if (res.quota?.snapshot) {
        syncQuotaFromApi(res.quota.snapshot);
      }
      if (res.quota?.deductedArticleCredit) {
        registrarNotificacao(
          "Imagem extra gerada",
          "Este artigo ultrapassou 7 imagens; 1 crédito de artigo foi convertido em +7 slots de imagem."
        );
      }
      const url = res.url as string;
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
      const msg = (e as Error).message;
      atualizarSecao(index, {
        erro: msg,
        aGerarImagem: false,
      });
      if (
        e instanceof StudioApiError &&
        (e.code === "monthly_image_limit_reached" ||
          e.code === "article_image_limit_reached" ||
          e.code === "paid_plan_required")
      ) {
        setErroGeral(msg);
      }
      return undefined;
    }
  }

  const faixaAtual =
    FAIXAS_PALAVRAS.find((f) => f.id === faixaPalavras) ?? FAIXAS_PALAVRAS[2];

  async function sugerirComIa() {
    if (
      (tema.trim().length < 3 && linksReferencia.length === 0) ||
      ocupado ||
      sugerindo
    ) {
      return;
    }
    setSugerindo(true);
    setErroSugestao("");
    try {
      const sug = await postJson<SuggestApiResponse>("/api/suggest", {
        tema: tema.trim(),
        idioma,
        plano: planoGeracao,
        links: linksReferencia,
      });
      if (!tema.trim() && typeof sug.temaSugerido === "string" && sug.temaSugerido) {
        setTema(sug.temaSugerido);
      }
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

  async function gerarArtigo(overrides?: Partial<VoiceNarrationApplyPayload>) {
    const linksEfetivos = overrides?.links ?? linksReferencia;
    let temaEfetivo = (overrides?.tema ?? tema).trim();
    if ((!temaEfetivo && linksEfetivos.length === 0) || ocupado) return;
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

    const generationSessionKey = `art_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 6)}`;
    activeSessionKeyRef.current = generationSessionKey;

    try {
      let descEfetiva = (overrides?.descricao ?? descricao).trim();
      let tagsEfetivas = overrides?.palavrasChave ?? palavrasChave;
      let tomEfetivo = overrides?.tom ?? tom;
      const idiomaEfetivo = overrides?.idioma ?? idioma;
      const faixaIdEfetiva = overrides?.faixaPalavras ?? faixaPalavras;
      let faixaEfetiva =
        FAIXAS_PALAVRAS.find((f) => f.id === faixaIdEfetiva) ?? faixaAtual;
      let primeiraPessoaEfetiva = overrides?.primeiraPessoa ?? primeiraPessoa;
      let pesquisaEfetiva = overrides?.pesquisaWeb ?? pesquisaWeb;
      const incluirImagensEfetivo =
        overrides?.incluirImagens ?? incluirImagens;
      const narracaoEfetiva = (overrides?.narracao ?? narracaoContexto).trim();

      if (!descEfetiva && tagsEfetivas.length === 0 && !narracaoEfetiva) {
        try {
          setEstado(
            linksEfetivos.length > 0
              ? "A ler os seus links primários e a sugerir configurações…"
              : "A sugerir descrição, palavras-chave e estilo com IA…"
          );
          const sug = await postJson<SuggestApiResponse>(
            "/api/suggest",
            {
              tema: temaEfetivo,
              idioma: idiomaEfetivo,
              plano: planoGeracao,
              links: linksEfetivos,
            },
            controller.signal
          );
          if (!temaEfetivo && typeof sug.temaSugerido === "string" && sug.temaSugerido.trim()) {
            temaEfetivo = sug.temaSugerido.trim();
            setTema(temaEfetivo);
          }
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
          if (sugErr instanceof StudioApiError && sugErr.status === 403) {
            throw sugErr;
          }
        }
      }

      if (!temaEfetivo && linksEfetivos.length > 0) {
        temaEfetivo = linksEfetivos[0];
        setTema(temaEfetivo);
      }

      let contextoPesquisa = "";
      let contextoPrimario = "";
      let fontesPesquisadas: FontePesquisa[] = [];
      let usouPesquisa = false;

      if (pesquisaEfetiva !== "desativada" || linksEfetivos.length > 0) {
        setEstado(
          linksEfetivos.length > 0
            ? "A aceder e raspar os seus links como fonte primária e consultar apoio na web…"
            : narracaoEfetiva
            ? "A pesquisar fontes na web para conciliar com a sua narração…"
            : "A avaliar e pesquisar fontes atualizadas na web…"
        );
        const resPesquisa = await postJson<ResearchApiResponse>(
          "/api/research",
          {
            tema: temaEfetivo,
            descricao: descEfetiva,
            palavrasChave: tagsEfetivas,
            tom: tomEfetivo,
            idioma: idiomaEfetivo,
            modo: pesquisaEfetiva,
            narracao: narracaoEfetiva,
            links: linksEfetivos,
            plano: planoGeracao,
            sessionKey: generationSessionKey,
          },
          controller.signal
        );
        usouPesquisa = Boolean(resPesquisa.pesquisou);
        contextoPesquisa = resPesquisa.resumoPesquisa ?? "";
        contextoPrimario = resPesquisa.contextoPrimario ?? "";
        fontesPesquisadas = resPesquisa.fontes ?? [];
        setPesquisaUsada(usouPesquisa);
        setFontes(fontesPesquisadas);
      }

      setEstado(
        narracaoEfetiva
          ? "A organizar a sua narração em secções estruturadas…"
          : "A criar o esboço estruturado…"
      );
      const esb = await postJson<OutlineApiResponse>(
        "/api/outline",
        {
          tema: temaEfetivo,
          secoes: faixaEfetiva.numSecoes,
          descricao: descEfetiva,
          palavrasChave: tagsEfetivas,
          tom: tomEfetivo,
          idioma: idiomaEfetivo,
          primeiraPessoa: primeiraPessoaEfetiva,
          contextoPesquisa,
          contextoPrimario,
          narracao: narracaoEfetiva,
          plano: planoGeracao,
          sessionKey: generationSessionKey,
        },
        controller.signal
      );
      if (esb.quota) {
        syncQuotaFromApi(esb.quota);
      }

      let lista: Secao[] = esb.secoes;
      setTitulo(esb.titulo);
      setSecoes(lista);

      const alvoPorSecao = Math.ceil(faixaEfetiva.alvoPalavras / lista.length);
      let resumo = "";

      for (let i = 0; i < lista.length; i++) {
        if (controller.signal.aborted) break;
        setEstado(`A escrever a secção ${i + 1} de ${lista.length}…`);

        const { texto, prompt, quota: secQuota } = await postJson<SectionApiResponse>(
          "/api/section",
          {
            titulo: esb.titulo,
            indice: lista.map((s) => s.titulo),
            secao: lista[i],
            resumo,
            palavras: alvoPorSecao,
            tom: tomEfetivo,
            idioma: idiomaEfetivo,
            palavrasChave: tagsEfetivas,
            descricao: descEfetiva,
            primeiraPessoa: primeiraPessoaEfetiva,
            contextoPesquisa,
            contextoPrimario,
            narracao: narracaoEfetiva,
            estiloImagem,
            plano: planoGeracao,
            sessionKey: generationSessionKey,
          },
          controller.signal
        );
        if (secQuota) {
          syncQuotaFromApi(secQuota);
        }

        lista = lista.map((s, j) => (j === i ? { ...s, texto, prompt } : s));
        atualizarSecao(i, { texto, prompt });
        resumo += `- ${lista[i].titulo}: ${texto.slice(0, 200)}…\n`;

        if (incluirImagensEfetivo && !controller.signal.aborted) {
          setEstado(`A gerar a imagem da secção ${i + 1} de ${lista.length}…`);
          const imgUrl = await gerarImagemSecao(
            i,
            prompt ?? lista[i].titulo,
            controller.signal,
            generationSessionKey,
            estiloImagem
          );
          if (imgUrl) {
            lista = lista.map((s, j) =>
              j === i ? { ...s, img: imgUrl } : s
            );
          }
        }
      }

      if (!controller.signal.aborted) {
        const novoId = generationSessionKey;
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
          tema: temaEfetivo,
          titulo: esb.titulo,
          descricao: descEfetiva,
          palavrasChave: tagsEfetivas,
          tom: tomEfetivo,
          idioma: idiomaEfetivo,
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

        void refreshUsageSnapshot();
        setEstado("Artigo concluído e guardado em Meus Artigos.");
        registrarNotificacao("Artigo concluído", esb.titulo);
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") {
        setEstado("Geração interrompida.");
      } else {
        setErroGeral((e as Error).message);
        setEstado("");
        if (
          e instanceof StudioApiError &&
          (e.code === "paid_plan_required" || e.code === "article_limit_reached")
        ) {
          setModalTipo("upgrade");
        }
      }
    } finally {
      activeSessionKeyRef.current = null;
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
    setNarracaoContexto("");
    setLinksReferencia(
      (artigo.fontes ?? [])
        .filter((f) => f.tipo === "primaria" && /^https?:\/\//i.test(f.url))
        .map((f) => f.url)
    );
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
    setEstiloImagem(
      isValidEstiloImagemId(nova.estiloImagemPadrao)
        ? nova.estiloImagemPadrao
        : DEFAULT_ESTILO_IMAGEM
    );
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

  function handleAplicarNarracao(payload: VoiceNarrationApplyPayload) {
    setTema(payload.tema);
    setDescricao(payload.descricao);
    setDescricaoSugerida(Boolean(payload.descricao));
    setPalavrasChave(payload.palavrasChave);
    setTom(payload.tom);
    setIdioma(payload.idioma);
    setFaixaPalavras(payload.faixaPalavras);
    setIncluirImagens(payload.incluirImagens);
    setPrimeiraPessoa(payload.primeiraPessoa);
    setPesquisaWeb(payload.pesquisaWeb);
    setNarracaoContexto(payload.narracao);
    if (Array.isArray(payload.links)) {
      setLinksReferencia(payload.links);
    }
    setVoiceModalOpen(false);
    setIsRecordingVoice(false);

    if (payload.autoGenerate) {
      void gerarArtigo(payload);
    }
  }

  const artigoAtualObj = artigosSalvos.find((a) => a.id === artigoAtualId);
  const totalFavoritos = artigosSalvos.filter((a) => a.favorito).length;
  const mascotState: RobotAnimationState =
    isRecordingVoice || voiceModalOpen
      ? "microphone"
      : ocupado && secoes.length > 0
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
        monthlyUsed={monthlyUsed}
        monthlyImagesLimit={monthlyImagesLimit}
        monthlyImagesUsed={monthlyImagesUsed}
        isAdmin={isAdmin}
        unreadInboxCount={unreadInboxCount}
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
            isAdmin={isAdmin}
            unreadInboxCount={unreadInboxCount}
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
                  estiloImagem={estiloImagem}
                  onChangeEstiloImagem={setEstiloImagem}
                  primeiraPessoa={primeiraPessoa}
                  onChangePrimeiraPessoa={setPrimeiraPessoa}
                  pesquisaWeb={pesquisaWeb}
                  onChangePesquisaWeb={setPesquisaWeb}
                  planoGeracao={planoGeracao}
                  onChangePlanoGeracao={handleChangePlanoGeracao}
                  hasPaidSubscription={activePlanId !== "free"}
                  onOpenUpgrade={() => setModalTipo("upgrade")}
                  sugerindo={sugerindo}
                  erroSugestao={erroSugestao}
                  descricaoSugerida={descricaoSugerida}
                  onSugerirComIa={sugerirComIa}
                  ocupado={ocupado}
                  onGerar={() => void gerarArtigo()}
                  onCancelar={cancelarGeracao}
                  narracaoContexto={narracaoContexto}
                  onAbrirNarracao={() => setVoiceModalOpen(true)}
                  onClearNarracao={() => setNarracaoContexto("")}
                  linksReferencia={linksReferencia}
                  onChangeLinksReferencia={setLinksReferencia}
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
                key={`${configPadrao.tomPadrao}-${configPadrao.idiomaPadrao}-${configPadrao.faixaPalavrasPadrao}-${configPadrao.incluirImagensPadrao}-${configPadrao.estiloImagemPadrao ?? DEFAULT_ESTILO_IMAGEM}-${configPadrao.primeiraPessoaPadrao}-${configPadrao.pesquisaWebPadrao}`}
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

          {activeTab === "emails" && isAdmin && (
            <div className="min-h-0 flex-1">
              <AdminEmailInbox
                embeddedInStudio
                onUnreadCountChange={setUnreadInboxCount}
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
        monthlyUsed={monthlyUsed}
        monthlyImagesLimit={monthlyImagesLimit}
        monthlyImagesUsed={monthlyImagesUsed}
        hasSubscriptionPortal={hasSubscriptionPortal}
        highlightPlanId={highlightPlanId}
        initialBillingCycle={initialBillingCycle}
        onPaymentConfirmed={({ planId, articlesPerMonth }) => {
          setPlanoGeracao("paid");
          setActivePlanId(planId);
          setMonthlyLimit(articlesPerMonth);
          setMonthlyUsed(0);
          void refreshUsageSnapshot();
          setHasSubscriptionPortal(true);
          setEstado(
            `Assinatura ${getPlanDisplayName(
              planId
            )} confirmada via Cakto! ${articlesPerMonth} artigos por mês liberados.`
          );
        }}
      />

      <VoiceNarrationModal
        key={voiceModalOpen ? "voice-modal-open" : "voice-modal-closed"}
        open={voiceModalOpen}
        initialTema={tema}
        initialIdioma={idioma}
        initialTom={tom}
        initialFaixaPalavras={faixaPalavras}
        initialIncluirImagens={incluirImagens}
        initialPrimeiraPessoa={primeiraPessoa}
        initialPesquisaWeb={pesquisaWeb}
        initialNarracao={narracaoContexto}
        initialLinks={linksReferencia}
        planoGeracao={planoGeracao}
        onRecordingStateChange={setIsRecordingVoice}
        onClose={() => {
          setVoiceModalOpen(false);
          setIsRecordingVoice(false);
        }}
        onApply={handleAplicarNarracao}
      />
    </div>
  );
}
