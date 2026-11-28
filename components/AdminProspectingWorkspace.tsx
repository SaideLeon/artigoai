"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ExternalLink,
  Globe,
  Loader2,
  Mail,
  Plus,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  SquareCheck,
  Square,
  XCircle,
} from "lucide-react";

type ProspectProfileType = "blogs" | "agencias" | "saas" | "criadores";
type ProspectCategory =
  | "blog"
  | "portal"
  | "agencia"
  | "saas"
  | "criador"
  | "outro";
type ProspectLeadStatus =
  | "descoberto"
  | "rascunho_pronto"
  | "sem_email"
  | "aprovado"
  | "enviado"
  | "ignorado"
  | "erro";

type SocialLink = {
  rede: string;
  url: string;
  handle?: string;
};

type ProspectCampaign = {
  id: string;
  titulo: string;
  nicho: string;
  perfis: ProspectProfileType[];
  regiao: string;
  idioma: string;
  criterios: string;
  quantidade_alvo: number;
  status: "em_andamento" | "concluida" | "erro";
  resumo_busca: string;
  created_at: string;
};

type ProspectLead = {
  id: string;
  campaign_id: string;
  nome_site: string;
  dominio: string;
  url: string;
  categoria: ProspectCategory;
  descricao_site: string;
  motivo_aderencia: string;
  emails_encontrados: string[];
  email_selecionado: string | null;
  redes_sociais: SocialLink[];
  assunto_rascunho: string;
  corpo_rascunho: string;
  status: ProspectLeadStatus;
  erro_detalhe: string | null;
  thread_id: string | null;
  enviado_em: string | null;
  created_at: string;
};

type ProspectCounts = {
  total: number;
  prontos: number;
  aprovados: number;
  semEmail: number;
  enviados: number;
  ignorados: number;
  erros: number;
};

type FilterTab =
  | "todos"
  | "rascunho_pronto"
  | "aprovado"
  | "sem_email"
  | "enviado"
  | "ignorado";

const PROFILE_OPTIONS: Array<{
  id: ProspectProfileType;
  label: string;
  desc: string;
}> = [
  {
    id: "blogs",
    label: "Blogs e Portais de Artigos",
    desc: "Blogs independentes, revistas digitais e portais editoriais",
  },
  {
    id: "agencias",
    label: "Agências Digitais e SEO",
    desc: "Agências de marketing de conteúdo e consultorias SEO",
  },
  {
    id: "saas",
    label: "Plataformas e SaaS",
    desc: "Empresas de software com blog educativo e aquisição orgânica",
  },
  {
    id: "criadores",
    label: "Criadores e Redes Públicas",
    desc: "Newsletters, Substack, Medium e páginas públicas com e-mail",
  },
];

const QUICK_PRESETS: Array<{
  label: string;
  nicho: string;
  perfis: ProspectProfileType[];
  criterios: string;
}> = [
  {
    label: "Blogs de Tecnologia & IA",
    nicho: "Tecnologia, inteligência artificial e produtividade digital",
    perfis: ["blogs", "criadores"],
    criterios:
      "Priorizar blogs independentes e portais especializados em tutoriais no Brasil; evitar grandes jornais de massa.",
  },
  {
    label: "Agências de Conteúdo & SEO",
    nicho: "Marketing digital, SEO e produção de conteúdo corporativo",
    perfis: ["agencias"],
    criterios:
      "Buscar agências brasileiras que ofereçam serviço recorrente de blog posts e redação SEO para empresas.",
  },
  {
    label: "Plataformas SaaS B2B",
    nicho: "Software B2B, gestão, CRM e ferramentas para PMEs",
    perfis: ["saas"],
    criterios:
      "Priorizar plataformas SaaS brasileiras com blog ativo que publicam guias educativos para clientes.",
  },
];

const CATEGORY_LABEL: Record<ProspectCategory, string> = {
  blog: "Blog Editorial",
  portal: "Portal de Conteúdo",
  agencia: "Agência Digital / SEO",
  saas: "Plataforma / SaaS",
  criador: "Criador / Newsletter",
  outro: "Site / Sistema",
};

const STATUS_META: Record<
  ProspectLeadStatus,
  { label: string; dotClass: string; textClass: string }
> = {
  descoberto: {
    label: "Descoberto",
    dotClass: "bg-slate-400",
    textClass: "text-slate-600 dark:text-slate-300",
  },
  rascunho_pronto: {
    label: "Rascunho pronto",
    dotClass: "bg-indigo-600",
    textClass: "text-indigo-700 dark:text-indigo-300",
  },
  aprovado: {
    label: "Aprovado para envio",
    dotClass: "bg-emerald-600",
    textClass: "text-emerald-700 dark:text-emerald-300",
  },
  sem_email: {
    label: "Sem e-mail público",
    dotClass: "bg-amber-500",
    textClass: "text-amber-700 dark:text-amber-300",
  },
  enviado: {
    label: "Convite enviado",
    dotClass: "bg-emerald-600",
    textClass: "text-emerald-700 dark:text-emerald-300",
  },
  ignorado: {
    label: "Ignorado",
    dotClass: "bg-slate-400",
    textClass: "text-slate-500 dark:text-slate-400",
  },
  erro: {
    label: "Falha no envio",
    dotClass: "bg-rose-600",
    textClass: "text-rose-700 dark:text-rose-300",
  },
};

function formatDatePt(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminProspectingWorkspace() {
  const [campaigns, setCampaigns] = useState<ProspectCampaign[]>([]);
  const [leads, setLeads] = useState<ProspectLead[]>([]);
  const [counts, setCounts] = useState<ProspectCounts>({
    total: 0,
    prontos: 0,
    aprovados: 0,
    semEmail: 0,
    enviados: 0,
    ignorados: 0,
    erros: 0,
  });
  const [migrationPending, setMigrationPending] = useState(false);
  const [emailConfigured, setEmailConfigured] = useState(true);
  const [emailFrom, setEmailFrom] = useState("Artigen <contato@artificializar.site>");

  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("all");
  const [loadingWorkspace, setLoadingWorkspace] = useState(true);
  const [builderOpen, setBuilderOpen] = useState(false);

  // Discovery builder form state
  const [nicho, setNicho] = useState("");
  const [perfis, setPerfis] = useState<ProspectProfileType[]>(["blogs", "agencias"]);
  const [regiao, setRegiao] = useState("Brasil");
  const [idioma, setIdioma] = useState("Português (Brasil)");
  const [criterios, setCriterios] = useState("");
  const [quantidadeAlvo, setQuantidadeAlvo] = useState(8);
  const [discovering, setDiscovering] = useState(false);
  const [discoveryPhase, setDiscoveryPhase] = useState<string | null>(null);

  // Queue filters & selection
  const [filterTab, setFilterTab] = useState<FilterTab>("todos");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [checkedIds, setCheckedIds] = useState<string[]>([]);

  // Active editor fields (edicoes por lead preservadas por ID)
  const [draftEdits, setDraftEdits] = useState<
    Record<string, { email?: string; subject?: string; body?: string }>
  >({});
  const [regenerateInstruction, setRegenerateInstruction] = useState("");
  const [savingLead, setSavingLead] = useState(false);
  const [regeneratingLead, setRegeneratingLead] = useState(false);
  const [sendingLeadId, setSendingLeadId] = useState<string | null>(null);
  const [sendingBatch, setSendingBatch] = useState(false);

  const [notice, setNotice] = useState<{
    type: "ok" | "aviso" | "erro";
    text: string;
  } | null>(null);

  const loadWorkspace = useCallback(
    async (campId = selectedCampaignId) => {
      setLoadingWorkspace(true);
      try {
        const qs = campId && campId !== "all" ? `?campaignId=${campId}` : "";
        const res = await fetch(`/api/admin/prospecting${qs}`, {
          cache: "no-store",
        });
        const data = (await res.json()) as {
          ok?: boolean;
          erro?: string;
          campaigns?: ProspectCampaign[];
          leads?: ProspectLead[];
          counts?: ProspectCounts;
          migrationPending?: boolean;
          emailService?: { configured: boolean; from: string };
        };

        if (!res.ok || !data.ok) {
          setNotice({
            type: "erro",
            text: data.erro || "Não foi possível carregar os dados de prospecção.",
          });
          return;
        }

        const nextCampaigns = data.campaigns ?? [];
        const nextLeads = data.leads ?? [];
        setCampaigns(nextCampaigns);
        setLeads(nextLeads);
        if (data.counts) setCounts(data.counts);
        setMigrationPending(Boolean(data.migrationPending));
        if (data.emailService) {
          setEmailConfigured(data.emailService.configured);
          setEmailFrom(data.emailService.from);
        }
        if (nextLeads.length === 0) {
          setBuilderOpen(true);
        }
      } catch {
        setNotice({
          type: "erro",
          text: "Erro de rede ao carregar a central de prospecção.",
        });
      } finally {
        setLoadingWorkspace(false);
      }
    },
    [selectedCampaignId]
  );

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled) {
        void loadWorkspace(selectedCampaignId);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [loadWorkspace, selectedCampaignId]);

  const filteredLeads = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return leads.filter((lead) => {
      if (filterTab !== "todos" && lead.status !== filterTab) return false;
      if (!q) return true;
      return (
        lead.nome_site.toLowerCase().includes(q) ||
        lead.dominio.toLowerCase().includes(q) ||
        (lead.email_selecionado || "").toLowerCase().includes(q) ||
        lead.assunto_rascunho.toLowerCase().includes(q)
      );
    });
  }, [leads, filterTab, searchQuery]);

  const selectedLead = useMemo(
    () =>
      (selectedLeadId
        ? filteredLeads.find((l) => l.id === selectedLeadId)
        : null) ??
      filteredLeads[0] ??
      null,
    [filteredLeads, selectedLeadId]
  );

  const draftEmail = selectedLead
    ? draftEdits[selectedLead.id]?.email ?? selectedLead.email_selecionado ?? ""
    : "";
  const draftSubject = selectedLead
    ? draftEdits[selectedLead.id]?.subject ?? selectedLead.assunto_rascunho ?? ""
    : "";
  const draftBody = selectedLead
    ? draftEdits[selectedLead.id]?.body ?? selectedLead.corpo_rascunho ?? ""
    : "";

  const updateSelectedLeadDraft = (
    field: "email" | "subject" | "body",
    value: string
  ) => {
    if (!selectedLead) return;
    const leadId = selectedLead.id;
    setDraftEdits((prev) => ({
      ...prev,
      [leadId]: {
        ...prev[leadId],
        [field]: value,
      },
    }));
  };

  const toggleProfile = (profile: ProspectProfileType) => {
    setPerfis((prev) =>
      prev.includes(profile)
        ? prev.length > 1
          ? prev.filter((p) => p !== profile)
          : prev
        : [...prev, profile]
    );
  };

  async function handleDiscover(e: React.FormEvent) {
    e.preventDefault();
    if (nicho.trim().length < 3) {
      setNotice({
        type: "aviso",
        text: "Informe um nicho ou tema com pelo menos 3 caracteres.",
      });
      return;
    }

    setDiscovering(true);
    setNotice(null);
    setDiscoveryPhase("Pesquisando sites e perfis públicos na web com Gemini…");

    const phaseTimer1 = setTimeout(() => {
      setDiscoveryPhase("Inspecionando páginas públicas e extraindo e-mails de contato…");
    }, 3500);
    const phaseTimer2 = setTimeout(() => {
      setDiscoveryPhase("Redigindo convites personalizados por segmento…");
    }, 7500);

    try {
      const res = await fetch("/api/admin/prospecting/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nicho: nicho.trim(),
          perfis,
          regiao: regiao.trim() || "Brasil",
          idioma: idioma.trim() || "Português (Brasil)",
          criterios: criterios.trim(),
          quantidadeAlvo,
        }),
      });

      const data = (await res.json()) as {
        ok?: boolean;
        erro?: string;
        campaign?: ProspectCampaign;
        leads?: ProspectLead[];
        modeloBusca?: string;
      };

      if (!res.ok || !data.ok || !data.campaign) {
        setNotice({
          type: "erro",
          text: data.erro || "Falha ao executar prospecção com Gemini.",
        });
        return;
      }

      const newLeads = data.leads ?? [];
      setBuilderOpen(false);
      setSelectedCampaignId(data.campaign.id);
      setFilterTab("todos");
      setCheckedIds([]);
      await loadWorkspace(data.campaign.id);
      if (newLeads[0]) {
        setSelectedLeadId(newLeads[0].id);
      }

      setNotice({
        type: "ok",
        text:
          newLeads.length > 0
            ? `Busca concluída (${data.modeloBusca ?? "Gemini"}): ${newLeads.length} potenciais clientes descobertos.`
            : "Nenhum novo domínio inédito encontrado para estes critérios. Tente ajustar o nicho.",
      });
    } catch {
      setNotice({
        type: "erro",
        text: "Erro de rede durante a busca discriminada.",
      });
    } finally {
      clearTimeout(phaseTimer1);
      clearTimeout(phaseTimer2);
      setDiscovering(false);
      setDiscoveryPhase(null);
    }
  }

  function replaceLeadInState(updated: ProspectLead) {
    setLeads((prev) => {
      const next = prev.map((l) => (l.id === updated.id ? updated : l));
      setCounts({
        total: next.length,
        prontos: next.filter((l) => l.status === "rascunho_pronto").length,
        aprovados: next.filter((l) => l.status === "aprovado").length,
        semEmail: next.filter((l) => l.status === "sem_email").length,
        enviados: next.filter((l) => l.status === "enviado").length,
        ignorados: next.filter((l) => l.status === "ignorado").length,
        erros: next.filter((l) => l.status === "erro").length,
      });
      return next;
    });
  }

  async function handleSaveOrStatusLead(
    leadId: string,
    options?: { nextStatus?: ProspectLeadStatus; silentNotice?: boolean }
  ): Promise<ProspectLead | null> {
    setSavingLead(true);
    try {
      const res = await fetch(`/api/admin/prospecting/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emailSelecionado: draftEmail.trim(),
          assuntoRascunho: draftSubject.trim(),
          corpoRascunho: draftBody.trim(),
          ...(options?.nextStatus ? { status: options.nextStatus } : {}),
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        erro?: string;
        lead?: ProspectLead;
      };

      if (!res.ok || !data.ok || !data.lead) {
        setNotice({
          type: "erro",
          text: data.erro || "Não foi possível salvar as alterações.",
        });
        return null;
      }

      replaceLeadInState(data.lead);
      if (!options?.silentNotice) {
        setNotice({
          type: "ok",
          text:
            options?.nextStatus === "aprovado"
              ? "Lead aprovado na fila para envio."
              : options?.nextStatus === "ignorado"
              ? "Lead marcado como ignorado."
              : "Rascunho atualizado.",
        });
      }
      return data.lead;
    } catch {
      setNotice({
        type: "erro",
        text: "Erro de rede ao salvar rascunho.",
      });
      return null;
    } finally {
      setSavingLead(false);
    }
  }

  async function handleRegenerateDraft() {
    if (!selectedLead) return;
    setRegeneratingLead(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/prospecting/leads/${selectedLead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "regenerate",
          instrucaoExtra: regenerateInstruction.trim(),
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        erro?: string;
        lead?: ProspectLead;
      };
      if (!res.ok || !data.ok || !data.lead) {
        setNotice({
          type: "erro",
          text: data.erro || "Erro ao regenerar convite.",
        });
        return;
      }

      replaceLeadInState(data.lead);
      setDraftEdits((prev) => {
        const next = { ...prev };
        delete next[data.lead!.id];
        return next;
      });
      setRegenerateInstruction("");
      setNotice({
        type: "ok",
        text: "Novo rascunho personalizado gerado pelo Gemini.",
      });
    } catch {
      setNotice({
        type: "erro",
        text: "Erro de rede ao regenerar rascunho.",
      });
    } finally {
      setRegeneratingLead(false);
    }
  }

  async function handleSendSingleLead() {
    if (!selectedLead) return;
    setSendingLeadId(selectedLead.id);
    setNotice(null);

    try {
      // Garante que edições recentes no formulário sejam persistidas antes do envio
      const saved = await handleSaveOrStatusLead(selectedLead.id, {
        silentNotice: true,
      });
      if (!saved) return;

      const res = await fetch(
        `/api/admin/prospecting/leads/${selectedLead.id}/send`,
        { method: "POST" }
      );
      const data = (await res.json()) as {
        ok?: boolean;
        erro?: string;
        lead?: ProspectLead;
      };

      if (data.lead) {
        replaceLeadInState(data.lead);
      }

      if (!res.ok || !data.ok) {
        setNotice({
          type: "erro",
          text: data.erro || "Falha ao enviar convite via Resend.",
        });
        return;
      }

      setNotice({
        type: "ok",
        text: `Convite enviado para ${saved.email_selecionado ?? selectedLead.dominio} e registrado na Caixa de E-mail.`,
      });
    } catch {
      setNotice({
        type: "erro",
        text: "Erro de rede ao disparar convite.",
      });
    } finally {
      setSendingLeadId(null);
    }
  }

  async function handleSendBatch() {
    const eligibleIds = checkedIds.filter((id) => {
      const item = leads.find((l) => l.id === id);
      return (
        item &&
        item.status !== "enviado" &&
        item.status !== "ignorado" &&
        Boolean(item.email_selecionado)
      );
    });

    const targetIds =
      eligibleIds.length > 0
        ? eligibleIds
        : leads
            .filter(
              (l) =>
                l.status === "aprovado" && Boolean(l.email_selecionado)
            )
            .map((l) => l.id);

    if (targetIds.length === 0) {
      setNotice({
        type: "aviso",
        text: "Selecione ou aprove leads com e-mail válido antes do envio em lote.",
      });
      return;
    }

    setSendingBatch(true);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/prospecting/send-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadIds: targetIds.slice(0, 15) }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        erro?: string;
        sentCount?: number;
        failedCount?: number;
        leads?: ProspectLead[];
      };

      for (const updated of data.leads ?? []) {
        replaceLeadInState(updated);
      }
      setCheckedIds([]);

      if (!res.ok) {
        setNotice({
          type: "erro",
          text: data.erro || "Falha no envio em lote.",
        });
        return;
      }

      setNotice({
        type: (data.failedCount ?? 0) > 0 ? "aviso" : "ok",
        text: `Envio em lote concluído: ${data.sentCount ?? 0} enviado(s), ${
          data.failedCount ?? 0
        } com falha.`,
      });
    } catch {
      setNotice({
        type: "erro",
        text: "Erro de rede no envio em lote.",
      });
    } finally {
      setSendingBatch(false);
    }
  }

  const toggleCheckLead = (id: string) => {
    setCheckedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Workspace Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
        <div>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Administração / Prospecção Inteligente
          </p>
          <h1 className="mt-1 text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Descoberta Web & Convites Personalizados
          </h1>
          <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
            Busca discriminada com Gemini gratuito + Google Search · Remetente:{" "}
            <span className="font-mono">{emailFrom}</span>{" "}
            {emailConfigured ? "· Resend pronto" : "· Resend pendente"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {campaigns.length > 0 && (
            <select
              aria-label="Filtrar campanha"
              value={selectedCampaignId}
              onChange={(e) => setSelectedCampaignId(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              <option value="all">Todas as campanhas ({campaigns.length})</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.titulo}
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={() => setBuilderOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#5B4AF4] to-[#2563EB] px-4 py-2 text-xs font-semibold text-white hover:brightness-110 whitespace-nowrap shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{builderOpen ? "Fechar Nova Busca" : "Nova Busca Discriminada"}</span>
          </button>
        </div>
      </div>

      {/* Notices */}
      {migrationPending && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200">
          Para persistir campanhas e leads de prospecção no Supabase, execute o
          script{" "}
          <code className="font-mono font-semibold">
            supabase/16_admin_prospecting.sql
          </code>{" "}
          no SQL Editor do seu projeto.
        </div>
      )}

      {notice && (
        <div
          role="status"
          className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-2.5 text-xs font-medium ${
            notice.type === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-200"
              : notice.type === "aviso"
              ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200"
              : "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800/60 dark:bg-rose-950/40 dark:text-rose-200"
          }`}
        >
          <span className="flex items-center gap-2">
            {notice.type === "ok" ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0" />
            )}
            <span>{notice.text}</span>
          </span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-current underline underline-offset-2"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Flat KPI Strip (Tabular Numerals) */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 sm:grid-cols-5 dark:border-slate-800 dark:bg-slate-800">
        {[
          { label: "Total descoberto", value: counts.total, cls: "text-slate-900 dark:text-white" },
          { label: "Rascunhos prontos", value: counts.prontos, cls: "text-indigo-600 dark:text-indigo-400" },
          { label: "Aprovados na fila", value: counts.aprovados, cls: "text-emerald-600 dark:text-emerald-400" },
          { label: "Sem e-mail público", value: counts.semEmail, cls: "text-amber-600 dark:text-amber-400" },
          { label: "Convites enviados", value: counts.enviados, cls: "text-emerald-700 dark:text-emerald-300" },
        ].map((metric) => (
          <div
            key={metric.label}
            className="bg-white px-4 py-3 dark:bg-[#0F172A]"
          >
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {metric.label}
            </p>
            <p className={`mt-1 font-mono text-xl font-bold tabular-nums ${metric.cls}`}>
              {metric.value}
            </p>
          </div>
        ))}
      </div>

      {/* Collapsible Discriminated Search Builder */}
      {builderOpen && (
        <form
          onSubmit={handleDiscover}
          className="rounded-xl border border-slate-200 bg-white p-5 space-y-4 dark:border-slate-800 dark:bg-[#0F172A]"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Configurar Busca Discriminada na Web
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Defina o segmento e os critérios para o Gemini encontrar sites e
                contatos públicos inéditos.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {QUICK_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => {
                    setNicho(preset.nicho);
                    setPerfis(preset.perfis);
                    setCriterios(preset.criterios);
                  }}
                  className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:border-indigo-300 hover:text-indigo-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:text-indigo-300"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            <div className="lg:col-span-6 space-y-1.5">
              <label
                htmlFor="prospect-nicho"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-200"
              >
                Nicho, assunto ou mercado-alvo *
              </label>
              <input
                id="prospect-nicho"
                type="text"
                required
                value={nicho}
                onChange={(e) => setNicho(e.target.value)}
                placeholder="Ex.: Blogs de finanças pessoais, tecnologia, saúde ou agências SEO"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="lg:col-span-2 space-y-1.5">
              <label
                htmlFor="prospect-regiao"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-200"
              >
                Região
              </label>
              <input
                id="prospect-regiao"
                type="text"
                value={regiao}
                onChange={(e) => setRegiao(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="lg:col-span-2 space-y-1.5">
              <label
                htmlFor="prospect-idioma"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-200"
              >
                Idioma
              </label>
              <input
                id="prospect-idioma"
                type="text"
                value={idioma}
                onChange={(e) => setIdioma(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="lg:col-span-2 space-y-1.5">
              <label
                htmlFor="prospect-qtd"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-200"
              >
                Qtd. por rodada
              </label>
              <select
                id="prospect-qtd"
                value={quantidadeAlvo}
                onChange={(e) => setQuantidadeAlvo(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-mono text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value={5}>5 leads</option>
                <option value={8}>8 leads</option>
                <option value={12}>12 leads</option>
                <option value={15}>15 leads</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
              Perfis discriminados para selecionar
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {PROFILE_OPTIONS.map((opt) => {
                const active = perfis.includes(opt.id);
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => toggleProfile(opt.id)}
                    className={`flex items-start gap-2.5 rounded-lg border p-2.5 text-left transition-colors ${
                      active
                        ? "border-indigo-500 bg-indigo-50/70 dark:border-indigo-500/70 dark:bg-indigo-950/40"
                        : "border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800/60"
                    }`}
                  >
                    {active ? (
                      <SquareCheck className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
                    ) : (
                      <Square className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                    )}
                    <div>
                      <p className="text-xs font-semibold text-slate-900 dark:text-white">
                        {opt.label}
                      </p>
                      <p className="mt-0.5 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
                        {opt.desc}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="prospect-criterios"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-200"
            >
              Critérios de inclusão ou exclusão (opcional)
            </label>
            <textarea
              id="prospect-criterios"
              rows={2}
              value={criterios}
              onChange={(e) => setCriterios(e.target.value)}
              placeholder="Ex.: Priorizar blogs que publicam artigos semanais e possuem página de contato; evitar grandes portais como G1 ou UOL."
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {discoveryPhase ? (
                <span className="inline-flex items-center gap-1.5 font-medium text-indigo-600 dark:text-indigo-400">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>{discoveryPhase}</span>
                </span>
              ) : (
                "Domínios já contatados ou ignorados são excluídos automaticamente."
              )}
            </p>
            <button
              type="submit"
              disabled={discovering}
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#5B4AF4] to-[#2563EB] px-4 py-2 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-60"
            >
              {discovering ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Search className="h-3.5 w-3.5" />
              )}
              <span>
                {discovering ? "Buscando potenciais clientes…" : "Buscar Potenciais Clientes"}
              </span>
            </button>
          </div>
        </form>
      )}

      {/* Main Two-Pane Review Workspace */}
      <div className="grid grid-cols-1 overflow-hidden rounded-xl border border-slate-200 bg-white lg:grid-cols-12 dark:border-slate-800 dark:bg-[#0F172A]">
        {/* Left Pane: Queue & Filters */}
        <div className="flex flex-col border-b border-slate-200 lg:col-span-5 lg:border-b-0 lg:border-r dark:border-slate-800">
          <div className="border-b border-slate-200 p-3 space-y-2.5 dark:border-slate-800">
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: "todos", label: "Todos", count: counts.total },
                  { id: "rascunho_pronto", label: "Prontos", count: counts.prontos },
                  { id: "aprovado", label: "Aprovados", count: counts.aprovados },
                  { id: "sem_email", label: "Sem e-mail", count: counts.semEmail },
                  { id: "enviado", label: "Enviados", count: counts.enviados },
                  { id: "ignorado", label: "Ignorados", count: counts.ignorados },
                ] as const
              ).map((tab) => {
                const active = filterTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setFilterTab(tab.id)}
                    className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                      active
                        ? "bg-slate-900 text-white dark:bg-indigo-600"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                    }`}
                  >
                    {tab.label}{" "}
                    <span className="font-mono tabular-nums opacity-80">
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filtrar por domínio, site ou e-mail..."
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs text-slate-800 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>

              {(checkedIds.length > 0 || counts.aprovados > 0) && (
                <button
                  type="button"
                  disabled={sendingBatch}
                  onClick={() => void handleSendBatch()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 whitespace-nowrap shrink-0"
                >
                  {sendingBatch ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Send className="h-3 w-3" />
                  )}
                  <span>
                    {checkedIds.length > 0
                      ? `Enviar (${checkedIds.length})`
                      : `Enviar aprovados (${counts.aprovados})`}
                  </span>
                </button>
              )}
            </div>
          </div>

          <div className="max-h-[620px] flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80">
            {loadingWorkspace ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="h-14 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800"
                  />
                ))}
              </div>
            ) : filteredLeads.length === 0 ? (
              <div className="px-6 py-12 text-center space-y-3">
                <Globe className="mx-auto h-7 w-7 text-slate-400" />
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Nenhum potencial cliente nesta visualização
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Inicie uma nova busca discriminada acima para descobrir blogs,
                  agências ou plataformas com contato público.
                </p>
                {!builderOpen && (
                  <button
                    type="button"
                    onClick={() => setBuilderOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Nova Busca Discriminada</span>
                  </button>
                )}
              </div>
            ) : (
              filteredLeads.map((lead) => {
                const isSelected = lead.id === selectedLeadId;
                const isChecked = checkedIds.includes(lead.id);
                const statusInfo = STATUS_META[lead.status] ?? STATUS_META.descoberto;
                const canCheck =
                  lead.status !== "enviado" &&
                  lead.status !== "ignorado" &&
                  Boolean(lead.email_selecionado);

                return (
                  <div
                    key={lead.id}
                    className={`flex items-start gap-2.5 px-3.5 py-3 transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-indigo-50/70 dark:bg-indigo-950/35"
                        : "hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    }`}
                    onClick={() => {
                      setSelectedLeadId(lead.id);
                      setRegenerateInstruction("");
                    }}
                  >
                    <button
                      type="button"
                      disabled={!canCheck}
                      aria-label={`Selecionar ${lead.nome_site}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (canCheck) toggleCheckLead(lead.id);
                      }}
                      className="mt-0.5 text-slate-400 hover:text-indigo-600 disabled:opacity-30"
                    >
                      {isChecked ? (
                        <SquareCheck className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                      ) : (
                        <Square className="h-4 w-4" />
                      )}
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-xs font-bold text-slate-900 dark:text-white">
                          {lead.nome_site}
                        </p>
                        <span
                          className={`inline-flex items-center gap-1.5 text-[11px] font-medium shrink-0 ${statusInfo.textClass}`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${statusInfo.dotClass}`}
                          />
                          {statusInfo.label}
                        </span>
                      </div>

                      <p className="mt-0.5 truncate font-mono text-[11px] text-slate-500 dark:text-slate-400">
                        {lead.dominio} · {CATEGORY_LABEL[lead.categoria]}
                      </p>

                      <p className="mt-1 truncate text-[11px] text-slate-600 dark:text-slate-300">
                        {lead.email_selecionado ? (
                          <span className="font-mono text-emerald-700 dark:text-emerald-400">
                            {lead.email_selecionado}
                          </span>
                        ) : (
                          <span className="text-amber-700 dark:text-amber-400">
                            Nenhum e-mail público localizado automaticamente
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Pane: Lead Dossier & Personalized Email Editor */}
        <div className="lg:col-span-7 flex flex-col">
          {!selectedLead ? (
            <div className="flex flex-1 flex-col items-center justify-center px-8 py-16 text-center">
              <Sparkles className="h-8 w-8 text-indigo-500" />
              <p className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">
                Selecione um potencial cliente na lista
              </p>
              <p className="mt-1 max-w-md text-xs text-slate-500 dark:text-slate-400">
                Aqui você revisa os contatos públicos encontrados, ajusta o
                convite personalizado redigido pelo Gemini e aprova o disparo via
                Resend.
              </p>
            </div>
          ) : (
            <div className="flex flex-1 flex-col divide-y divide-slate-200 dark:divide-slate-800">
              {/* Dossier Header */}
              <div className="p-5 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-bold text-slate-900 dark:text-white">
                        {selectedLead.nome_site}
                      </h2>
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        · {CATEGORY_LABEL[selectedLead.categoria]}
                      </span>
                    </div>
                    <a
                      href={selectedLead.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-0.5 inline-flex items-center gap-1 font-mono text-xs text-indigo-600 hover:underline dark:text-indigo-400"
                    >
                      <span>{selectedLead.url}</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>

                  {selectedLead.status === "enviado" && selectedLead.thread_id && (
                    <Link
                      href={`/admin/emails?folder=sent&thread=${selectedLead.thread_id}`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300"
                    >
                      <Mail className="h-3.5 w-3.5" />
                      <span>Abrir conversa na Caixa de E-mail</span>
                    </Link>
                  )}
                </div>

                {selectedLead.descricao_site && (
                  <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                    {selectedLead.descricao_site}
                  </p>
                )}

                {selectedLead.motivo_aderencia && (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-300">
                    <span className="font-semibold text-slate-900 dark:text-white">
                      Aderência ao Artigen:{" "}
                    </span>
                    {selectedLead.motivo_aderencia}
                  </div>
                )}

                {selectedLead.redes_sociais.length > 0 && (
                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    <span className="font-semibold text-slate-500 dark:text-slate-400">
                      Redes públicas:
                    </span>
                    {selectedLead.redes_sociais.map((soc) => (
                      <a
                        key={soc.url}
                        href={soc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-indigo-600 hover:underline dark:text-indigo-400"
                      >
                        <span>
                          {soc.rede}
                          {soc.handle ? ` (${soc.handle})` : ""}
                        </span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ))}
                  </div>
                )}

                {selectedLead.erro_detalhe && (
                  <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-800/60 dark:bg-rose-950/40 dark:text-rose-300">
                    Detalhe do último erro: {selectedLead.erro_detalhe}
                  </div>
                )}
              </div>

              {/* Email Selection + Draft Editor */}
              <div className="p-5 space-y-4">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label
                      htmlFor="lead-target-email"
                      className="text-xs font-semibold text-slate-700 dark:text-slate-200"
                    >
                      E-mail de destino (público ou informado manualmente)
                    </label>
                    {selectedLead.emails_encontrados.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {selectedLead.emails_encontrados.map((em) => (
                          <button
                            key={em}
                            type="button"
                            disabled={selectedLead.status === "enviado"}
                            onClick={() => updateSelectedLeadDraft("email", em)}
                            className={`rounded-md border px-2 py-0.5 font-mono text-[11px] transition-colors ${
                              draftEmail.trim().toLowerCase() === em
                                ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300"
                                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                            }`}
                          >
                            {em}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <input
                    id="lead-target-email"
                    type="email"
                    disabled={selectedLead.status === "enviado"}
                    value={draftEmail}
                    onChange={(e) => updateSelectedLeadDraft("email", e.target.value)}
                    placeholder="contato@dominio.com.br"
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-none disabled:opacity-70 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="lead-subject"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-200"
                  >
                    Assunto do convite
                  </label>
                  <input
                    id="lead-subject"
                    type="text"
                    disabled={selectedLead.status === "enviado"}
                    value={draftSubject}
                    onChange={(e) => updateSelectedLeadDraft("subject", e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-none disabled:opacity-70 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="lead-body"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-200"
                  >
                    Mensagem personalizada
                  </label>
                  <textarea
                    id="lead-body"
                    rows={9}
                    disabled={selectedLead.status === "enviado"}
                    value={draftBody}
                    onChange={(e) => updateSelectedLeadDraft("body", e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs leading-relaxed text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-none disabled:opacity-70 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                </div>

                {selectedLead.status !== "enviado" && (
                  <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5 dark:border-slate-800 dark:bg-slate-900/60">
                    <input
                      type="text"
                      value={regenerateInstruction}
                      onChange={(e) => setRegenerateInstruction(e.target.value)}
                      placeholder="Opcional: ajuste o tom (ex.: foque em parceria de afiliados ou oferta para redação)"
                      className="min-w-[200px] flex-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                    <button
                      type="button"
                      disabled={regeneratingLead}
                      onClick={() => void handleRegenerateDraft()}
                      className="inline-flex items-center gap-1.5 rounded-md border border-indigo-200 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-60 dark:border-indigo-800 dark:bg-slate-900 dark:text-indigo-300 dark:hover:bg-indigo-950/50"
                    >
                      {regeneratingLead ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3.5 w-3.5" />
                      )}
                      <span>Regenerar com Gemini</span>
                    </button>
                  </div>
                )}

                {/* Action Footer */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  {selectedLead.status === "enviado" ? (
                    <p className="font-mono text-xs text-emerald-700 dark:text-emerald-400">
                      Convite enviado em {formatDatePt(selectedLead.enviado_em)}.
                    </p>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={savingLead}
                        onClick={() => void handleSaveOrStatusLead(selectedLead.id)}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        Salvar Edição
                      </button>

                      <button
                        type="button"
                        disabled={savingLead || !draftEmail.trim()}
                        onClick={() =>
                          void handleSaveOrStatusLead(selectedLead.id, {
                            nextStatus: "aprovado",
                          })
                        }
                        className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300"
                      >
                        <Check className="h-3.5 w-3.5" />
                        <span>Aprovar na Fila</span>
                      </button>

                      <button
                        type="button"
                        disabled={savingLead}
                        onClick={() =>
                          void handleSaveOrStatusLead(selectedLead.id, {
                            nextStatus: "ignorado",
                          })
                        }
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-500 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        <span>Ignorar</span>
                      </button>
                    </div>
                  )}

                  {selectedLead.status !== "enviado" && (
                    <button
                      type="button"
                      disabled={
                        sendingLeadId === selectedLead.id ||
                        !draftEmail.trim() ||
                        !draftSubject.trim() ||
                        !draftBody.trim()
                      }
                      onClick={() => void handleSendSingleLead()}
                      className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#5B4AF4] to-[#2563EB] px-4 py-2 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-50"
                    >
                      {sendingLeadId === selectedLead.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Send className="h-3.5 w-3.5" />
                      )}
                      <span>Enviar Convite Agora</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
