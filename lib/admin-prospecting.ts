import { Type, type Schema } from "@google/genai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { composeAdminEmail } from "@/lib/admin-inbox";
import {
  formatGeminiError,
  GEMINI_RESEARCH_CANDIDATE_MODELS,
  generateArticleText,
  getGeminiClient,
} from "@/lib/ai-providers";
import { fetchWithSafeRedirects } from "@/lib/link-scraper";

export type ProspectProfileType = "blogs" | "agencias" | "saas" | "criadores";

export type ProspectCategory =
  | "blog"
  | "portal"
  | "agencia"
  | "saas"
  | "criador"
  | "outro";

export type ProspectLeadStatus =
  | "descoberto"
  | "rascunho_pronto"
  | "sem_email"
  | "aprovado"
  | "enviado"
  | "ignorado"
  | "erro";

export type SocialLink = {
  rede: string;
  url: string;
  handle?: string;
};

export type AdminProspectCampaignRow = {
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
  criado_por_email: string;
  created_at: string;
  updated_at: string;
};

export type AdminProspectLeadRow = {
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
  resend_email_id: string | null;
  enviado_em: string | null;
  enviado_por_email: string | null;
  created_at: string;
  updated_at: string;
};

export type ProspectCounts = {
  total: number;
  prontos: number;
  aprovados: number;
  semEmail: number;
  enviados: number;
  ignorados: number;
  erros: number;
};

export const PROSPECT_PROFILE_LABELS: Record<
  ProspectProfileType,
  { label: string; hint: string }
> = {
  blogs: {
    label: "Blogs e Portais de Artigos",
    hint: "Veículos independentes, revistas digitais e blogs que publicam guias e notícias",
  },
  agencias: {
    label: "Agências Digitais e SEO",
    hint: "Consultorias de conteúdo, inbound marketing e agências que produzem para clientes",
  },
  saas: {
    label: "Plataformas e SaaS",
    hint: "Empresas de software com blogs educativos, centrais de ajuda e marketing de conteúdo",
  },
  criadores: {
    label: "Criadores e Páginas Públicas",
    hint: "Newsletters, Substack, Medium e criadores com contatos comerciais públicos",
  },
};

const MULTI_TENANT_HOSTS = new Set([
  "instagram.com",
  "youtube.com",
  "youtu.be",
  "linkedin.com",
  "x.com",
  "twitter.com",
  "tiktok.com",
  "threads.net",
  "medium.com",
  "substack.com",
  "facebook.com",
  "github.com",
]);

const IGNORED_DISCOVERY_HOSTS = new Set([
  "google.com",
  "google.com.br",
  "bing.com",
  "yahoo.com",
  "duckduckgo.com",
  "wikipedia.org",
  "pt.wikipedia.org",
  "reclameaqui.com.br",
  "glassdoor.com",
  "glassdoor.com.br",
  "econodata.com.br",
  "casadosdados.com.br",
  "cnpj.biz",
  "jusbrasil.com.br",
  "amazon.com",
  "amazon.com.br",
  "mercadolivre.com.br",
  "criador.artificializar.site",
  "artificializar.site",
]);

const BLOCKED_EMAIL_DOMAINS = new Set([
  "example.com",
  "example.org",
  "example.net",
  "test.com",
  "email.com",
  "domain.com",
  "yourdomain.com",
  "sentry.io",
  "ingest.sentry.io",
  "wixpress.com",
  "wixstatic.com",
  "wordpress.org",
  "w3.org",
  "schema.org",
  "googleapis.com",
  "googleusercontent.com",
  "gravatar.com",
  "cloudflare.com",
  "localhost",
]);

const BLOCKED_EMAIL_LOCAL_PARTS = new Set([
  "noreply",
  "no-reply",
  "donotreply",
  "do-not-reply",
  "mailer-daemon",
  "postmaster",
  "bounce",
  "notifications",
  "notification",
  "privacy-noreply",
  "support-noreply",
  "user",
  "name",
  "seuemail",
  "email",
]);

const ASSET_EXTENSION_RE =
  /\.(png|jpe?g|gif|svg|webp|avif|ico|css|js|mjs|woff2?|ttf|eot|pdf|mp4|mp3|zip)$/i;

const PRIORITY_EMAIL_PREFIXES = [
  "contato",
  "comercial",
  "parcerias",
  "parceria",
  "redacao",
  "editorial",
  "imprensa",
  "marketing",
  "oi",
  "ola",
  "faleconosco",
  "atendimento",
  "hello",
  "contact",
  "hi",
  "negocios",
  "conteudo",
];

const CONTACT_PATH_KEYWORDS = [
  "contato",
  "fale-conosco",
  "faleconosco",
  "contact",
  "sobre",
  "quem-somos",
  "about",
  "parcerias",
  "parceria",
  "anuncie",
  "midia-kit",
  "mediakit",
  "media-kit",
  "redacao",
  "editorial",
  "equipe",
  "expediente",
  "trabalhe",
];

export function isMissingProspectingTableError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const record = error as { code?: string; message?: string };
  const msg = (record.message || "").toLowerCase();
  return (
    record.code === "42P01" ||
    record.code === "PGRST205" ||
    msg.includes("admin_prospect_campaigns") ||
    msg.includes("admin_prospect_leads") ||
    msg.includes("does not exist")
  );
}

export function normalizeProspectIdentity(rawUrlOrDomain: string): string {
  const trimmed = (rawUrlOrDomain || "").trim();
  if (!trimmed) return "";

  const withScheme = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const parsed = new URL(withScheme);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    if (!host) return "";

    if (MULTI_TENANT_HOSTS.has(host)) {
      const seg = parsed.pathname
        .split("/")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)[0];
      if (seg && !["p", "explore", "search", "watch", "share"].includes(seg)) {
        return `${host}/${seg}`;
      }
    }

    return host;
  } catch {
    return trimmed
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .split("/")[0]
      .trim();
  }
}

export function isValidPublicContactEmail(email: string): boolean {
  const clean = (email || "").trim().toLowerCase();
  if (!clean || clean.length > 160) return false;
  if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,12}$/i.test(clean)) return false;

  const [local, domain] = clean.split("@");
  if (!local || !domain) return false;
  if (local.startsWith(".") || local.endsWith(".") || local.includes("..")) {
    return false;
  }
  if (ASSET_EXTENSION_RE.test(clean)) return false;
  if (BLOCKED_EMAIL_LOCAL_PARTS.has(local)) return false;
  if (
    BLOCKED_EMAIL_DOMAINS.has(domain) ||
    domain.endsWith(".png") ||
    domain.endsWith(".jpg") ||
    domain.endsWith(".local")
  ) {
    return false;
  }
  if (/^\d+x\d+$/.test(local)) return false;

  return true;
}

function decodeBasicEntities(input: string): string {
  return input
    .replace(/&amp;/gi, "&")
    .replace(/&#64;/gi, "@")
    .replace(/&#x40;/gi, "@")
    .replace(/&nbsp;/gi, " ");
}

export function extractPublicEmailsFromHtml(
  html: string,
  siteDomain?: string
): string[] {
  if (!html || typeof html !== "string") return [];

  const normalizedInput = decodeBasicEntities(html);
  const found = new Set<string>();

  // 1. Links mailto:
  const mailtoRe = /mailto:([^"'?\s<>]+)/gi;
  let mailtoMatch: RegExpExecArray | null;
  while ((mailtoMatch = mailtoRe.exec(normalizedInput)) !== null) {
    let rawAddr = mailtoMatch[1];
    try {
      rawAddr = decodeURIComponent(rawAddr);
    } catch {
      // ignora erro de decode
    }
    for (const part of rawAddr.split(/[,;]/)) {
      const candidate = part.trim().toLowerCase();
      if (isValidPublicContactEmail(candidate)) {
        found.add(candidate);
      }
    }
  }

  // 2. E-mails explícitos no texto visível / atributos
  const stripped = normalizedInput
    .replace(/<(script|style|svg)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ");

  const emailRe = /\b[a-z0-9._%+-]{2,}@[a-z0-9.-]+\.[a-z]{2,12}\b/gi;
  const textMatches = stripped.match(emailRe) ?? [];
  for (const m of textMatches) {
    const candidate = m.trim().toLowerCase();
    if (isValidPublicContactEmail(candidate)) {
      found.add(candidate);
    }
  }

  // 3. Padrões simples ofuscados como "contato [at] site.com.br"
  const obfuscatedRe =
    /\b([a-z0-9._%+-]{2,})\s*(?:\[at\]|\(at\)|\[arroba\]|\(arroba\))\s*([a-z0-9.-]+\.[a-z]{2,12})\b/gi;
  let obfMatch: RegExpExecArray | null;
  while ((obfMatch = obfuscatedRe.exec(stripped)) !== null) {
    const candidate = `${obfMatch[1]}@${obfMatch[2]}`.toLowerCase();
    if (isValidPublicContactEmail(candidate)) {
      found.add(candidate);
    }
  }

  const cleanDomain = siteDomain
    ? siteDomain.toLowerCase().replace(/^www\./, "").split("/")[0]
    : "";

  const scoreEmail = (email: string): number => {
    const [local, domain] = email.split("@");
    let score = 0;
    if (
      cleanDomain &&
      (domain === cleanDomain || domain.endsWith(`.${cleanDomain}`))
    ) {
      score += 50;
    }
    const cleanLocal = local.replace(/[._-]/g, "");
    const prefixIdx = PRIORITY_EMAIL_PREFIXES.findIndex(
      (p) => cleanLocal === p || cleanLocal.startsWith(p)
    );
    if (prefixIdx >= 0) {
      score += 30 - prefixIdx;
    }
    if (
      ["gmail.com", "hotmail.com", "outlook.com", "yahoo.com.br"].includes(
        domain
      )
    ) {
      score += 5;
    }
    return score;
  };

  return Array.from(found)
    .sort((a, b) => scoreEmail(b) - scoreEmail(a))
    .slice(0, 8);
}

const SOCIAL_NETWORK_MATCHERS: Array<{
  rede: string;
  hosts: string[];
}> = [
  { rede: "Instagram", hosts: ["instagram.com", "www.instagram.com"] },
  { rede: "LinkedIn", hosts: ["linkedin.com", "www.linkedin.com", "br.linkedin.com"] },
  { rede: "YouTube", hosts: ["youtube.com", "www.youtube.com"] },
  { rede: "X / Twitter", hosts: ["x.com", "twitter.com", "www.twitter.com"] },
  { rede: "TikTok", hosts: ["tiktok.com", "www.tiktok.com"] },
  { rede: "Threads", hosts: ["threads.net", "www.threads.net"] },
  { rede: "Substack", hosts: ["substack.com"] },
  { rede: "Medium", hosts: ["medium.com"] },
];

export function extractSocialLinksFromHtml(
  html: string,
  baseUrl: string
): SocialLink[] {
  if (!html || typeof html !== "string") return [];

  const hrefRe = /href=["']([^"']+)["']/gi;
  const seen = new Set<string>();
  const links: SocialLink[] = [];

  let match: RegExpExecArray | null;
  while ((match = hrefRe.exec(html)) !== null && links.length < 10) {
    const rawHref = decodeBasicEntities(match[1].trim());
    if (!rawHref || rawHref.startsWith("#") || rawHref.startsWith("mailto:")) {
      continue;
    }

    let resolved: URL;
    try {
      resolved = new URL(rawHref, baseUrl);
    } catch {
      continue;
    }

    if (resolved.protocol !== "http:" && resolved.protocol !== "https:") {
      continue;
    }

    const host = resolved.hostname.toLowerCase();
    const fullLower = resolved.toString().toLowerCase();
    if (
      fullLower.includes("sharer") ||
      fullLower.includes("intent/tweet") ||
      fullLower.includes("/share") ||
      fullLower.includes("oauth")
    ) {
      continue;
    }

    const network = SOCIAL_NETWORK_MATCHERS.find(
      (m) => m.hosts.includes(host) || host.endsWith(`.${m.hosts[0]}`)
    );
    if (!network) continue;

    const pathClean = resolved.pathname.replace(/\/+$/, "");
    if (!pathClean || pathClean === "") {
      if (!host.endsWith(".substack.com") && !host.endsWith(".medium.com")) {
        continue;
      }
    }

    const canonical = `${resolved.origin}${pathClean}`;
    if (seen.has(canonical)) continue;
    seen.add(canonical);

    const segs = pathClean.split("/").filter(Boolean);
    const handle =
      segs.length > 0
        ? `@${segs[segs.length - 1].replace(/^@/, "")}`
        : undefined;

    links.push({
      rede: network.rede,
      url: canonical,
      ...(handle ? { handle } : {}),
    });
  }

  return links.slice(0, 6);
}

export function extractContactPageCandidates(
  html: string,
  baseUrl: string
): string[] {
  let base: URL;
  try {
    base = new URL(baseUrl);
  } catch {
    return [];
  }

  const baseHost = base.hostname.toLowerCase().replace(/^www\./, "");
  const candidates = new Set<string>();
  const hrefRe = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

  let match: RegExpExecArray | null;
  while ((match = hrefRe.exec(html)) !== null) {
    const rawHref = match[1].trim();
    const anchorText = match[2].replace(/<[^>]+>/g, " ").toLowerCase();
    if (!rawHref || rawHref.startsWith("#") || rawHref.startsWith("mailto:")) {
      continue;
    }

    try {
      const resolved = new URL(rawHref, base);
      if (resolved.protocol !== "http:" && resolved.protocol !== "https:") {
        continue;
      }
      const resolvedHost = resolved.hostname.toLowerCase().replace(/^www\./, "");
      if (resolvedHost !== baseHost) continue;

      const pathLower = resolved.pathname.toLowerCase();
      if (pathLower === "/" || ASSET_EXTENSION_RE.test(pathLower)) continue;

      const matchesKeyword = CONTACT_PATH_KEYWORDS.some(
        (kw) => pathLower.includes(kw) || anchorText.includes(kw)
      );
      if (matchesKeyword) {
        resolved.hash = "";
        candidates.add(resolved.toString());
      }
    } catch {
      // ignora link inválido
    }
  }

  for (const fallbackPath of ["/contato", "/fale-conosco", "/sobre", "/contact"]) {
    const u = `${base.origin}${fallbackPath}`;
    if (u !== baseUrl.replace(/\/+$/, "")) {
      candidates.add(u);
    }
  }

  return Array.from(candidates).slice(0, 3);
}

type DiscoveryCandidateRaw = {
  nome?: string;
  url?: string;
  categoria?: string;
  resumo?: string;
  email_publico?: string;
};

export function parseGeminiDiscoveryJson(
  rawText: string
): DiscoveryCandidateRaw[] {
  const clean = (rawText || "")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  if (!clean) return [];

  try {
    const arrayMatch = clean.match(/\[[\s\S]*\]/)?.[0];
    const objMatch = clean.match(/\{[\s\S]*\}/)?.[0];

    if (objMatch && (!arrayMatch || clean.indexOf("{") < clean.indexOf("["))) {
      const parsedObj = JSON.parse(objMatch) as {
        candidatos?: DiscoveryCandidateRaw[];
        leads?: DiscoveryCandidateRaw[];
        sites?: DiscoveryCandidateRaw[];
      };
      const arr =
        parsedObj.candidatos ?? parsedObj.leads ?? parsedObj.sites ?? [];
      return Array.isArray(arr) ? arr : [];
    }

    if (arrayMatch) {
      const parsedArr = JSON.parse(arrayMatch);
      return Array.isArray(parsedArr) ? parsedArr : [];
    }
  } catch {
    return [];
  }

  return [];
}

function mapCategory(raw?: string): ProspectCategory {
  const lower = (raw || "").toLowerCase();
  if (lower.includes("agenc")) return "agencia";
  if (lower.includes("saas") || lower.includes("plataform") || lower.includes("soft")) {
    return "saas";
  }
  if (lower.includes("portal") || lower.includes("revista") || lower.includes("jornal")) {
    return "portal";
  }
  if (
    lower.includes("criador") ||
    lower.includes("newsletter") ||
    lower.includes("social") ||
    lower.includes("substack") ||
    lower.includes("medium")
  ) {
    return "criador";
  }
  if (lower.includes("blog") || lower.includes("conteudo") || lower.includes("artigo")) {
    return "blog";
  }
  return "blog";
}

function cleanHtmlMeta(html: string): {
  title: string;
  description: string;
  excerpt: string;
} {
  const titleMatch = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "";
  const ogDescMatch =
    html.match(
      /<meta[^>]+(?:name|property)=["'](?:og:description|description)["'][^>]+content=["']([^"']+)["'][^>]*>/i
    )?.[1] ??
    html.match(
      /<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["'](?:og:description|description)["'][^>]*>/i
    )?.[1] ??
    "";

  const textBody = html
    .replace(/<(script|style|noscript|svg|nav|footer)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return {
    title: decodeBasicEntities(titleMatch.replace(/<[^>]+>/g, " "))
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 140),
    description: decodeBasicEntities(ogDescMatch).trim().slice(0, 320),
    excerpt: decodeBasicEntities(textBody).slice(0, 1200),
  };
}

function shouldSkipDiscoveredUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl.trim());
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return true;
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    if (!host || IGNORED_DISCOVERY_HOSTS.has(host)) return true;
    if (host.endsWith(".gov.br") || host.endsWith(".edu.br")) return false;
    return false;
  } catch {
    return true;
  }
}

async function discoverProspectCandidatesWithGemini(params: {
  nicho: string;
  perfis: ProspectProfileType[];
  regiao: string;
  idioma: string;
  criterios: string;
  quantidadeAlvo: number;
  excludedDomains: string[];
}): Promise<{
  candidates: Array<{
    nome: string;
    url: string;
    dominio: string;
    categoria: ProspectCategory;
    resumo: string;
    emailSugerido?: string;
  }>;
  modelo: string;
}> {
  const ai = getGeminiClient();
  const candidateModels = GEMINI_RESEARCH_CANDIDATE_MODELS;

  const perfisTexto = params.perfis
    .map((p) => `- ${PROSPECT_PROFILE_LABELS[p].label}: ${PROSPECT_PROFILE_LABELS[p].hint}`)
    .join("\n");

  const exclusaoTexto =
    params.excludedDomains.length > 0
      ? `\nNÃO repita estes domínios já prospectados anteriormente:\n${params.excludedDomains
          .slice(0, 50)
          .join(", ")}`
      : "";

  const fetchTarget = Math.min(params.quantidadeAlvo + 4, 18);

  const prompt = `Você é um analista sênior de prospecção B2B e parcerias editoriais do Artigen (uma plataforma SaaS de criação de artigos completos com IA, pesquisa web em tempo real, SEO e geração automática de imagens).

Execute uma busca discriminada na web usando Google Search para localizar até ${fetchTarget} potenciais clientes reais e ativos com forte aderência para usar ou integrar o Artigen.

PARÂMETROS DA BUSCA DISCRIMINADA:
- Assunto / Nicho principal: "${params.nicho}"
- Região / País foco: "${params.regiao}"
- Idioma do público: "${params.idioma}"
- Perfis desejados:
${perfisTexto}
${
  params.criterios.trim()
    ? `- Critérios específicos do administrador: "${params.criterios.trim()}"`
    : ""
}
${exclusaoTexto}

REGRAS ESTRITAS:
1. Priorize sites oficiais reais, blogs ativos, portais independentes, agências digitais/SEO, plataformas SaaS ou páginas públicas de criadores/newsletters com presença pública clara.
2. Evite diretórios genéricos de CNPJ, páginas de busca, Wikipédia, marketplaces ou portais gigantes inacessíveis, a menos que o critério peça explicitamente.
3. NUNCA invente URLs ou e-mails. Só inclua "email_publico" se você tiver visto o endereço explicitamente em uma página pública durante a busca; caso contrário deixe "".
4. Retorne APENAS JSON válido no formato abaixo:
{
  "candidatos": [
    {
      "nome": "Nome do blog, portal, agência ou criador",
      "url": "https://...",
      "categoria": "blog | portal | agencia | saas | criador",
      "resumo": "1 frase sobre o tipo de artigo ou conteúdo que publicam",
      "email_publico": ""
    }
  ]
}`;

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

      const parsed = parseGeminiDiscoveryJson(response.text ?? "");
      const seenDomains = new Set(params.excludedDomains.map((d) => d.toLowerCase()));
      const candidates: Array<{
        nome: string;
        url: string;
        dominio: string;
        categoria: ProspectCategory;
        resumo: string;
        emailSugerido?: string;
      }> = [];

      const pushCandidate = (item: DiscoveryCandidateRaw) => {
        const rawUrl = (item.url || "").trim();
        if (!rawUrl || shouldSkipDiscoveredUrl(rawUrl)) return;
        const dominio = normalizeProspectIdentity(rawUrl);
        if (!dominio || seenDomains.has(dominio)) return;
        seenDomains.add(dominio);

        const emailSugerido =
          item.email_publico && isValidPublicContactEmail(item.email_publico)
            ? item.email_publico.trim().toLowerCase()
            : undefined;

        candidates.push({
          nome: (item.nome || "").trim().slice(0, 120) || dominio,
          url: rawUrl,
          dominio,
          categoria: mapCategory(item.categoria),
          resumo: (item.resumo || "").trim().slice(0, 320),
          ...(emailSugerido ? { emailSugerido } : {}),
        });
      };

      for (const item of parsed) {
        pushCandidate(item);
      }

      // Se o Gemini retornou groundingChunks com URLs reais adicionais e ainda faltam candidatos
      if (candidates.length < params.quantidadeAlvo) {
        const chunks =
          response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
        for (const chunk of chunks) {
          if (candidates.length >= fetchTarget) break;
          const uri = chunk.web?.uri;
          const title = chunk.web?.title;
          if (!uri || shouldSkipDiscoveredUrl(uri)) continue;
          pushCandidate({
            nome: title || "",
            url: uri,
            categoria: params.perfis.includes("agencias")
              ? "agencia"
              : params.perfis.includes("saas")
              ? "saas"
              : "blog",
            resumo: "",
          });
        }
      }

      return {
        candidates: candidates.slice(0, params.quantidadeAlvo),
        modelo: modelName,
      };
    } catch (err) {
      lastError = err;
    }
  }

  throw formatGeminiError(lastError);
}

async function inspectPublicProspectSite(candidate: {
  nome: string;
  url: string;
  dominio: string;
  categoria: ProspectCategory;
  resumo: string;
  emailSugerido?: string;
}): Promise<{
  nomeSite: string;
  urlFinal: string;
  descricaoSite: string;
  excerpt: string;
  emailsEncontrados: string[];
  redesSociais: SocialLink[];
}> {
  const emailSet = new Set<string>();
  if (candidate.emailSugerido && isValidPublicContactEmail(candidate.emailSugerido)) {
    emailSet.add(candidate.emailSugerido);
  }

  const socialMap = new Map<string, SocialLink>();
  let urlFinal = candidate.url;
  let title = candidate.nome;
  let description = candidate.resumo;
  let excerpt = candidate.resumo;

  try {
    const home = await fetchWithSafeRedirects(candidate.url);
    urlFinal = home.finalUrl;

    if (home.contentType.includes("html") || home.contentType.includes("xml")) {
      const meta = cleanHtmlMeta(home.body);
      if (meta.title && candidate.nome === candidate.dominio) {
        title = meta.title.split(/[|\-–—]/)[0].trim() || meta.title;
      }
      if (meta.description) {
        description = meta.description;
      }
      if (meta.excerpt) {
        excerpt = meta.excerpt;
      }

      for (const em of extractPublicEmailsFromHtml(home.body, candidate.dominio)) {
        emailSet.add(em);
      }
      for (const soc of extractSocialLinksFromHtml(home.body, home.finalUrl)) {
        if (!socialMap.has(soc.url)) {
          socialMap.set(soc.url, soc);
        }
      }

      // Se ainda não encontrou e-mail público na página inicial, visita até 3 páginas públicas de contato/sobre
      if (emailSet.size === 0) {
        const contactPages = extractContactPageCandidates(home.body, home.finalUrl);
        for (const contactUrl of contactPages) {
          try {
            const subPage = await fetchWithSafeRedirects(contactUrl);
            for (const em of extractPublicEmailsFromHtml(
              subPage.body,
              candidate.dominio
            )) {
              emailSet.add(em);
            }
            for (const soc of extractSocialLinksFromHtml(
              subPage.body,
              subPage.finalUrl
            )) {
              if (!socialMap.has(soc.url)) {
                socialMap.set(soc.url, soc);
              }
            }
            if (emailSet.size >= 2) break;
          } catch {
            // subpágina pode retornar 404 — ignora silenciosamente
          }
        }
      }
    }
  } catch {
    // Mantém dados da busca mesmo se o site bloquear leitura direta ou estiver lento
  }

  const orderedEmails = extractPublicEmailsFromHtml(
    Array.from(emailSet).join(" "),
    candidate.dominio
  );

  return {
    nomeSite: title.slice(0, 140) || candidate.dominio,
    urlFinal,
    descricaoSite: (description || candidate.resumo || "").slice(0, 320),
    excerpt: (excerpt || description || candidate.resumo || "").slice(0, 1200),
    emailsEncontrados: orderedEmails,
    redesSociais: Array.from(socialMap.values()).slice(0, 6),
  };
}

const OUTREACH_DRAFT_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    categoria: {
      type: Type.STRING,
      description:
        "Categoria mais precisa do potencial cliente: blog, portal, agencia, saas, criador ou outro",
    },
    motivo_aderencia: {
      type: Type.STRING,
      description:
        "1 a 2 frases explicando objetivamente por que este sistema ou site se beneficia do Artigen",
    },
    assunto: {
      type: Type.STRING,
      description:
        "Assunto curto, humano e profissional de até 80 caracteres sem palavras apelativas de spam",
    },
    corpo: {
      type: Type.STRING,
      description:
        "Corpo do e-mail em português natural (3 a 4 parágrafos curtos) convidando o destinatário de forma personalizada para conhecer o Artigen",
    },
  },
  required: ["categoria", "motivo_aderencia", "assunto", "corpo"],
};

export async function generatePersonalizedOutreachDraft(params: {
  nomeSite: string;
  dominio: string;
  url: string;
  categoriaInicial: ProspectCategory;
  nichoCampanha: string;
  descricaoSite: string;
  excerptSite: string;
  redesSociais: SocialLink[];
  instrucaoExtra?: string;
}): Promise<{
  categoria: ProspectCategory;
  motivoAderencia: string;
  assunto: string;
  corpo: string;
}> {
  const redesResumo =
    params.redesSociais.length > 0
      ? params.redesSociais.map((r) => `${r.rede} (${r.url})`).join(", ")
      : "Não identificadas";

  const prompt = `Redija um e-mail de convite altamente personalizado e consultivo em nome da Equipe Artigen (https://criador.artificializar.site) para este potencial cliente encontrado na web.

SOBRE O ARTIGEN:
- Plataforma brasileira que cria artigos completos seção a seção com IA, pesquisa web em tempo real com citações, otimização SEO, organização de ideias por áudio e geração automática de imagens editoriais, exportando em HTML limpo pronto para blogs e portais.
- Remetente oficial: contato@artificializar.site

DADOS REAIS DO POTENCIAL CLIENTE:
- Nome do site/sistema: ${params.nomeSite}
- Domínio: ${params.dominio}
- URL analisada: ${params.url}
- Categoria inicial: ${params.categoriaInicial}
- Nicho da busca: ${params.nichoCampanha}
- Descrição pública: ${params.descricaoSite || "Não informada"}
- Trecho do conteúdo observado na página: ${params.excerptSite || "Não disponível"}
- Redes públicas: ${redesResumo}
${
  params.instrucaoExtra?.trim()
    ? `\nINSTRUÇÃO ADICIONAL DO ADMINISTRADOR PARA ESTA REDAÇÃO:\n"${params.instrucaoExtra.trim()}"`
    : ""
}

DIRETRIZES DE PERSONALIZAÇÃO POR PERFIL:
- Se for blog/portal: elogie o foco editorial específico observado no site e mostre como o Artigen acelera pautas longas com pesquisa em tempo real e imagens próprias mantendo a linha editorial.
- Se for agência digital/SEO: foque em escala de produção para clientes, consistência de tom de voz, briefing rápido por links/narração e exportação HTML pronta para CMS.
- Se for plataforma/SaaS: foque no fortalecimento do blog educativo / aquisição orgânica (SEO) ou possível parceria editorial.
- Se for criador/newsletter: foque em transformar anotações ou narração de voz em artigos ilustrados completos sem perder a voz autoral.

REGRAS DO TEXTO:
1. Escreva em português brasileiro natural, cordial e objetivo (3 a 4 parágrafos curtos).
2. Cite algo real e concreto do site/perfil analisado logo na abertura para demonstrar que não é disparo genérico.
3. Não prometa métricas falsas nem use tom agressivo de venda ou caixa alta.
4. Inclua um convite leve para testar gratuitamente em https://criador.artificializar.site ou responder este e-mail se fizer sentido conversar sobre parceria.
5. Assine apenas como "Equipe Artigen" (sem placeholders como [Seu Nome]).`;

  const result = await generateArticleText(prompt, {
    responseSchema: OUTREACH_DRAFT_SCHEMA,
  });

  const parsed = JSON.parse(result.text) as {
    categoria?: string;
    motivo_aderencia?: string;
    assunto?: string;
    corpo?: string;
  };

  return {
    categoria: mapCategory(parsed.categoria || params.categoriaInicial),
    motivoAderencia:
      (parsed.motivo_aderencia || "").trim().slice(0, 400) ||
      `Site ativo no nicho "${params.nichoCampanha}" com potencial de ganho produtivo usando o Artigen.`,
    assunto:
      (parsed.assunto || "").trim().slice(0, 140) ||
      `Convite para conhecer o Artigen · ${params.nomeSite}`,
    corpo:
      (parsed.corpo || "").trim() ||
      `Olá, equipe do ${params.nomeSite},\n\nAcompanhamos o trabalho editorial publicado em ${params.dominio} e gostaríamos de convidar vocês a conhecerem o Artigen (https://criador.artificializar.site), nossa plataforma para estruturar artigos completos com pesquisa web e imagens editoriais.\n\nSe fizer sentido para a rotina de conteúdo de vocês, ficaremos felizes em liberar acesso ou conversar por aqui mesmo.\n\nUm abraço,\nEquipe Artigen`,
  };
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;

  const runNext = async () => {
    while (index < items.length) {
      const current = index++;
      results[current] = await worker(items[current]);
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => runNext())
  );

  return results;
}

export async function runProspectingDiscovery(
  admin: SupabaseClient,
  params: {
    nicho: string;
    perfis: ProspectProfileType[];
    regiao: string;
    idioma: string;
    criterios: string;
    quantidadeAlvo: number;
    adminEmail: string;
  }
): Promise<{
  campaign: AdminProspectCampaignRow;
  leads: AdminProspectLeadRow[];
  modeloBusca: string;
}> {
  const quantidadeAlvo = Math.min(Math.max(Math.round(params.quantidadeAlvo || 8), 3), 15);
  const perfis: ProspectProfileType[] =
    params.perfis.length > 0 ? params.perfis : ["blogs"];

  // Carrega domínios já prospectados anteriormente para evitar duplicidade
  const { data: existingRows, error: existingErr } = await admin
    .from("admin_prospect_leads")
    .select("dominio, email_selecionado");

  if (existingErr) {
    if (isMissingProspectingTableError(existingErr)) {
      throw new Error(
        "Tabela de prospecção não encontrada no Supabase. Execute o script supabase/16_admin_prospecting.sql."
      );
    }
    throw new Error(existingErr.message);
  }

  const excludedDomains = Array.from(
    new Set(
      (existingRows ?? [])
        .map((r) => String(r.dominio || "").trim().toLowerCase())
        .filter(Boolean)
    )
  );
  const existingEmails = new Set(
    (existingRows ?? [])
      .map((r) => String(r.email_selecionado || "").trim().toLowerCase())
      .filter(Boolean)
  );

  const titulo = `${params.nicho.trim()} · ${params.regiao.trim() || "Brasil"}`.slice(
    0,
    140
  );

  const { data: campaign, error: campErr } = await admin
    .from("admin_prospect_campaigns")
    .insert({
      titulo,
      nicho: params.nicho.trim(),
      perfis,
      regiao: params.regiao.trim() || "Brasil",
      idioma: params.idioma.trim() || "Português (Brasil)",
      criterios: params.criterios.trim(),
      quantidade_alvo: quantidadeAlvo,
      status: "em_andamento",
      criado_por_email: params.adminEmail,
    })
    .select("*")
    .single();

  if (campErr || !campaign) {
    throw new Error(campErr?.message || "Erro ao registrar campanha.");
  }

  try {
    const discovery = await discoverProspectCandidatesWithGemini({
      nicho: params.nicho.trim(),
      perfis,
      regiao: params.regiao.trim() || "Brasil",
      idioma: params.idioma.trim() || "Português (Brasil)",
      criterios: params.criterios.trim(),
      quantidadeAlvo,
      excludedDomains,
    });

    const enriched = await mapWithConcurrency(
      discovery.candidates,
      3,
      async (candidate) => {
        const siteInfo = await inspectPublicProspectSite(candidate);
        const emailSelecionado =
          siteInfo.emailsEncontrados.find((e) => !existingEmails.has(e)) ??
          siteInfo.emailsEncontrados[0] ??
          null;

        if (emailSelecionado) {
          existingEmails.add(emailSelecionado);
        }

        let draft = {
          categoria: candidate.categoria,
          motivoAderencia: `Site ativo no nicho "${params.nicho.trim()}".`,
          assunto: `Convite para conhecer o Artigen · ${siteInfo.nomeSite}`,
          corpo: `Olá, equipe do ${siteInfo.nomeSite},\n\nVimos o conteúdo publicado em ${candidate.dominio} e gostaríamos de convidar vocês a testarem o Artigen (https://criador.artificializar.site) para acelerar a criação de artigos com pesquisa web em tempo real e imagens editoriais.\n\nCaso faça sentido conhecer melhor ou conversar sobre parceria, basta responder a este e-mail.\n\nUm abraço,\nEquipe Artigen`,
        };

        try {
          draft = await generatePersonalizedOutreachDraft({
            nomeSite: siteInfo.nomeSite,
            dominio: candidate.dominio,
            url: siteInfo.urlFinal,
            categoriaInicial: candidate.categoria,
            nichoCampanha: params.nicho.trim(),
            descricaoSite: siteInfo.descricaoSite,
            excerptSite: siteInfo.excerpt,
            redesSociais: siteInfo.redesSociais,
          });
        } catch {
          // Mantém fallback contextual caso a cota do redator oscile
        }

        const status: ProspectLeadStatus = emailSelecionado
          ? "rascunho_pronto"
          : "sem_email";

        return {
          campaign_id: campaign.id,
          nome_site: siteInfo.nomeSite,
          dominio: candidate.dominio,
          url: siteInfo.urlFinal,
          categoria: draft.categoria,
          descricao_site: siteInfo.descricaoSite,
          motivo_aderencia: draft.motivoAderencia,
          emails_encontrados: siteInfo.emailsEncontrados,
          email_selecionado: emailSelecionado,
          redes_sociais: siteInfo.redesSociais,
          assunto_rascunho: draft.assunto,
          corpo_rascunho: draft.corpo,
          status,
        };
      }
    );

    let insertedLeads: AdminProspectLeadRow[] = [];
    if (enriched.length > 0) {
      const { data: leadRows, error: leadErr } = await admin
        .from("admin_prospect_leads")
        .insert(enriched)
        .select("*");

      if (leadErr) {
        throw new Error(leadErr.message);
      }
      insertedLeads = (leadRows ?? []) as AdminProspectLeadRow[];
    }

    const withEmailCount = insertedLeads.filter((l) => Boolean(l.email_selecionado)).length;
    const resumoBusca = `Descobertos ${insertedLeads.length} potenciais clientes (${withEmailCount} com e-mail público identificado) via ${discovery.modelo}.`;

    const { data: updatedCampaign } = await admin
      .from("admin_prospect_campaigns")
      .update({
        status: "concluida",
        resumo_busca: resumoBusca,
        updated_at: new Date().toISOString(),
      })
      .eq("id", campaign.id)
      .select("*")
      .single();

    return {
      campaign: (updatedCampaign ?? campaign) as AdminProspectCampaignRow,
      leads: insertedLeads,
      modeloBusca: discovery.modelo,
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Erro na prospecção.";
    await admin
      .from("admin_prospect_campaigns")
      .update({
        status: "erro",
        resumo_busca: errMsg.slice(0, 300),
        updated_at: new Date().toISOString(),
      })
      .eq("id", campaign.id);
    throw err;
  }
}

export function computeProspectCounts(
  leads: AdminProspectLeadRow[]
): ProspectCounts {
  return {
    total: leads.length,
    prontos: leads.filter((l) => l.status === "rascunho_pronto").length,
    aprovados: leads.filter((l) => l.status === "aprovado").length,
    semEmail: leads.filter((l) => l.status === "sem_email").length,
    enviados: leads.filter((l) => l.status === "enviado").length,
    ignorados: leads.filter((l) => l.status === "ignorado").length,
    erros: leads.filter((l) => l.status === "erro").length,
  };
}

export async function listProspectingWorkspace(
  admin: SupabaseClient,
  options?: { campaignId?: string }
): Promise<{
  campaigns: AdminProspectCampaignRow[];
  leads: AdminProspectLeadRow[];
  counts: ProspectCounts;
  migrationPending: boolean;
}> {
  const { data: campaigns, error: campErr } = await admin
    .from("admin_prospect_campaigns")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(30);

  if (campErr) {
    if (isMissingProspectingTableError(campErr)) {
      return {
        campaigns: [],
        leads: [],
        counts: {
          total: 0,
          prontos: 0,
          aprovados: 0,
          semEmail: 0,
          enviados: 0,
          ignorados: 0,
          erros: 0,
        },
        migrationPending: true,
      };
    }
    throw new Error(campErr.message);
  }

  let leadsQuery = admin
    .from("admin_prospect_leads")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(150);

  if (options?.campaignId && options.campaignId !== "all") {
    leadsQuery = leadsQuery.eq("campaign_id", options.campaignId);
  }

  const { data: leads, error: leadsErr } = await leadsQuery;
  if (leadsErr) {
    if (isMissingProspectingTableError(leadsErr)) {
      return {
        campaigns: (campaigns ?? []) as AdminProspectCampaignRow[],
        leads: [],
        counts: {
          total: 0,
          prontos: 0,
          aprovados: 0,
          semEmail: 0,
          enviados: 0,
          ignorados: 0,
          erros: 0,
        },
        migrationPending: true,
      };
    }
    throw new Error(leadsErr.message);
  }

  const typedLeads = (leads ?? []) as AdminProspectLeadRow[];
  return {
    campaigns: (campaigns ?? []) as AdminProspectCampaignRow[],
    leads: typedLeads,
    counts: computeProspectCounts(typedLeads),
    migrationPending: false,
  };
}

export async function sendProspectInviteLead(
  admin: SupabaseClient,
  params: {
    leadId: string;
    adminEmail: string;
  }
): Promise<
  | {
      ok: true;
      lead: AdminProspectLeadRow;
      threadId: string;
    }
  | { ok: false; status: number; error: string; lead?: AdminProspectLeadRow }
> {
  const { data: lead, error: fetchErr } = await admin
    .from("admin_prospect_leads")
    .select("*")
    .eq("id", params.leadId)
    .maybeSingle();

  if (fetchErr) {
    return { ok: false, status: 500, error: fetchErr.message };
  }
  if (!lead) {
    return { ok: false, status: 404, error: "Lead não encontrado." };
  }

  const typedLead = lead as AdminProspectLeadRow;
  if (typedLead.status === "enviado") {
    return {
      ok: false,
      status: 409,
      error: "Este potencial cliente já recebeu um convite anteriormente.",
      lead: typedLead,
    };
  }

  const targetEmail = (typedLead.email_selecionado || "").trim().toLowerCase();
  if (!isValidPublicContactEmail(targetEmail)) {
    return {
      ok: false,
      status: 400,
      error: "Informe ou selecione um e-mail válido antes de enviar o convite.",
      lead: typedLead,
    };
  }

  const subject = typedLead.assunto_rascunho.trim();
  const bodyText = typedLead.corpo_rascunho.trim();
  if (!subject || bodyText.length < 10) {
    return {
      ok: false,
      status: 400,
      error: "Assunto e corpo do convite precisam estar preenchidos.",
      lead: typedLead,
    };
  }

  const sendResult = await composeAdminEmail(admin, {
    toEmail: targetEmail,
    toName: typedLead.nome_site,
    subject,
    bodyText,
    adminEmail: params.adminEmail,
  });

  const nowIso = new Date().toISOString();

  if (!sendResult.ok) {
    const { data: erroredLead } = await admin
      .from("admin_prospect_leads")
      .update({
        status: "erro",
        erro_detalhe: sendResult.error,
        updated_at: nowIso,
      })
      .eq("id", typedLead.id)
      .select("*")
      .single();

    return {
      ok: false,
      status: sendResult.status,
      error: sendResult.error,
      lead: (erroredLead ?? typedLead) as AdminProspectLeadRow,
    };
  }

  const { data: updatedLead, error: updateErr } = await admin
    .from("admin_prospect_leads")
    .update({
      status: "enviado",
      erro_detalhe: null,
      thread_id: sendResult.thread.id,
      resend_email_id: sendResult.resendId,
      enviado_em: nowIso,
      enviado_por_email: params.adminEmail,
      updated_at: nowIso,
    })
    .eq("id", typedLead.id)
    .select("*")
    .single();

  if (updateErr || !updatedLead) {
    return {
      ok: false,
      status: 500,
      error: updateErr?.message || "Convite enviado, mas falhou ao atualizar status.",
    };
  }

  return {
    ok: true,
    lead: updatedLead as AdminProspectLeadRow,
    threadId: sendResult.thread.id,
  };
}

export type InfluencerTone = "amigavel" | "direto" | "consultivo";

export type InfluencerOutreachDraft = {
  nomeCanal: string;
  plataforma: string;
  handle: string;
  nicho: string;
  inscritosOuAlcance: string;
  emailVisivel: string | null;
  ganchoPersonalizado: string;
  mensagemCurta: string;
  assuntoEmail: string;
  mensagemEmailCurta: string;
};

const ALLOWED_SCREENSHOT_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
]);

export function normalizeBase64ImageInput(
  rawImage: string,
  rawMimeType?: string
): { mimeType: string; data: string } | null {
  const trimmed = (rawImage || "").trim();
  if (!trimmed) return null;

  const dataUrlMatch = /^data:(image\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/i.exec(
    trimmed
  );
  if (dataUrlMatch) {
    const detectedMime = dataUrlMatch[1].toLowerCase();
    const mimeType = detectedMime === "image/jpg" ? "image/jpeg" : detectedMime;
    if (!ALLOWED_SCREENSHOT_MIME_TYPES.has(mimeType)) return null;
    const data = dataUrlMatch[2].replace(/\s+/g, "");
    return data.length >= 64 ? { mimeType, data } : null;
  }

  const normalizedMime = (rawMimeType || "image/png").trim().toLowerCase();
  const mimeType = normalizedMime === "image/jpg" ? "image/jpeg" : normalizedMime;
  if (!ALLOWED_SCREENSHOT_MIME_TYPES.has(mimeType)) return null;
  const data = trimmed.replace(/\s+/g, "");
  if (!/^[A-Za-z0-9+/=]+$/.test(data) || data.length < 64) return null;
  return { mimeType, data };
}

export function embedInviteLinkInMessage(
  rawMessage: string,
  inviteUrl: string
): string {
  const cleanUrl = inviteUrl.trim();
  const cleanText = (rawMessage || "").trim();
  if (!cleanUrl) return cleanText;

  const placeholderRe = /\{\{\s*link_convite\s*\}\}/gi;
  if (placeholderRe.test(cleanText)) {
    return cleanText.replace(placeholderRe, cleanUrl);
  }
  if (cleanText.includes(cleanUrl)) {
    return cleanText;
  }
  return cleanText ? `${cleanText}\n\nLink de convite: ${cleanUrl}` : cleanUrl;
}

const INFLUENCER_OUTREACH_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    nome_canal: {
      type: Type.STRING,
      description:
        "Nome exato do canal ou criador identificado no print ou nas observações.",
    },
    plataforma: {
      type: Type.STRING,
      description:
        "Plataforma identificada (ex.: YouTube, Instagram, TikTok, Blog, X).",
    },
    handle: {
      type: Type.STRING,
      description:
        "Arroba (@usuario) ou identificador curto do canal, ou vazio se não visível.",
    },
    nicho: {
      type: Type.STRING,
      description:
        "Tema principal do conteúdo do influenciador em até 10 palavras.",
    },
    inscritos_ou_alcance: {
      type: Type.STRING,
      description:
        "Quantidade de inscritos/seguidores ou resumo de alcance visível no print (ou 'Não visível').",
    },
    email_visivel: {
      type: Type.STRING,
      description:
        "E-mail público comercial visível no print, ou string vazia se não houver.",
    },
    gancho_personalizado: {
      type: Type.STRING,
      description:
        "1 frase curta destacando um detalhe real observado no print (título de vídeo, série ou estilo do canal).",
    },
    mensagem_curta: {
      type: Type.STRING,
      description:
        "Mensagem curta de prospecção em português (320 a 580 caracteres) para DM/WhatsApp/comentário, contendo exatamente o marcador {{LINK_CONVITE}}.",
    },
    assunto_email: {
      type: Type.STRING,
      description: "Assunto curto e humano de até 75 caracteres para envio por e-mail.",
    },
    mensagem_email_curta: {
      type: Type.STRING,
      description:
        "Versão curta para e-mail (2 a 3 parágrafos breves) contendo exatamente o marcador {{LINK_CONVITE}}.",
    },
  },
  required: [
    "nome_canal",
    "plataforma",
    "nicho",
    "gancho_personalizado",
    "mensagem_curta",
    "assunto_email",
    "mensagem_email_curta",
  ],
};

export async function generateInfluencerInviteFromScreenshot(params: {
  imageBase64?: string;
  imageMimeType?: string;
  canalUrl?: string;
  nomeManual?: string;
  notasAdmin?: string;
  tom?: InfluencerTone;
  percentualComissao?: number;
}): Promise<{
  draft: InfluencerOutreachDraft;
  modelo: string;
}> {
  const normalizedImage = params.imageBase64
    ? normalizeBase64ImageInput(params.imageBase64, params.imageMimeType)
    : null;

  if (!normalizedImage && !params.nomeManual?.trim() && !params.canalUrl?.trim()) {
    throw new Error(
      "Envie o print do canal do influenciador ou informe o nome/URL do canal."
    );
  }

  const tomLabel =
    params.tom === "direto"
      ? "Direto e objetivo (vai direto ao ponto com simpatia)"
      : params.tom === "consultivo"
        ? "Consultivo e focado em parceria estratégica"
        : "Amigável, próximo e natural de criador para criador";

  const comissaoTexto = Number.isFinite(params.percentualComissao)
    ? `${Math.round(Number(params.percentualComissao))}%`
    : "35%";

  const prompt = `Você é o responsável por parcerias do Artigen (https://criador.artificializar.site), uma plataforma brasileira de criação de artigos completos com IA, pesquisa web em tempo real, SEO e geração de imagens editoriais.

Sua tarefa é analisar ${
    normalizedImage
      ? "o print (captura de tela) anexado do canal/perfil do influenciador"
      : "as informações informadas do influenciador"
  } e redigir uma MENSAGEM CURTA e altamente personalizada de prospecção convidando o criador para:
1) Experimentar o Artigen gratuitamente na prática;
2) Se gostar, falar/mostrar o Artigen em seu canal ou conteúdos;
3) Entrar pelo link exclusivo {{LINK_CONVITE}} para ativar sua conta de parceiro e ganhar comissão recorrente por cada usuário que assinar usando a indicação (planos pagos pagam 20% no Starter e até ${comissaoTexto} recorrente no Pro e Agência).

CONTEXTO COMPLEMENTAR INFORMADO PELO ADMIN:
- Nome informado manualmente: ${params.nomeManual?.trim() || "Extrair do print"}
- URL do canal: ${params.canalUrl?.trim() || "Extrair do print se visível"}
- Observações extras: ${params.notasAdmin?.trim() || "Nenhuma"}
- Tom desejado: ${tomLabel}

REGRAS OBRIGATÓRIAS:
1. Leia com atenção o print para identificar o nome real do canal, @handle, tema/nicho, vídeos ou pautas visíveis e eventual e-mail público.
2. Em "mensagem_curta": escreva um texto curto e humano (entre 320 e 580 caracteres, ideal para DM no Instagram/WhatsApp/YouTube), citando algo concreto do canal logo na primeira frase para provar que não é spam, convidando-o a testar a plataforma, falar sobre ela se curtir e ganhar comissão recorrente por cada assinatura gerada, incluindo obrigatoriamente o marcador literal {{LINK_CONVITE}}.
3. Em "mensagem_email_curta": escreva uma versão curta para e-mail (2 ou 3 parágrafos breves, assinatura "Equipe Artigen"), também incluindo {{LINK_CONVITE}}.
4. Nunca substitua {{LINK_CONVITE}} por outro link nem invente métricas falsas de ganhos.
5. Escreva em português do Brasil natural, sem exageros nem caixa alta.`;

  const result = await generateArticleText(prompt, {
    responseSchema: INFLUENCER_OUTREACH_SCHEMA,
    ...(normalizedImage ? { inlineImages: [normalizedImage] } : {}),
  });

  const parsed = JSON.parse(result.text) as {
    nome_canal?: string;
    plataforma?: string;
    handle?: string;
    nicho?: string;
    inscritos_ou_alcance?: string;
    email_visivel?: string;
    gancho_personalizado?: string;
    mensagem_curta?: string;
    assunto_email?: string;
    mensagem_email_curta?: string;
  };

  const nomeCanal =
    (parsed.nome_canal || "").trim() ||
    params.nomeManual?.trim() ||
    "Criador Parceiro";
  const plataforma = (parsed.plataforma || "").trim() || "YouTube";
  const rawEmail = (parsed.email_visivel || "").trim().toLowerCase();
  const emailVisivel = isValidPublicContactEmail(rawEmail) ? rawEmail : null;

  const fallbackCurta = `Olá! Acompanhei o conteúdo do ${nomeCanal} e achei muito alinhado com nosso público. Quero te convidar para testar o Artigen na prática e, se curtir, apresentar a ferramenta para sua audiência ganhando comissão recorrente (até ${comissaoTexto}) por cada usuário que assinar: {{LINK_CONVITE}}`;
  const fallbackEmail = `Olá, ${nomeCanal},\n\nAcompanhamos o trabalho do seu canal e gostaríamos de te convidar para testar o Artigen gratuitamente e conhecer nosso programa de parceiros — você pode mostrar a plataforma para a sua audiência e receber comissão recorrente (20% no Starter e ${comissaoTexto} no Pro/Agência) por cada assinante indicado.\n\nSeu link exclusivo para ativar o teste e o painel de parceiro está aqui:\n{{LINK_CONVITE}}\n\nUm abraço,\nEquipe Artigen`;

  return {
    modelo: result.modelo,
    draft: {
      nomeCanal: nomeCanal.slice(0, 120),
      plataforma: plataforma.slice(0, 40),
      handle: (parsed.handle || "").trim().slice(0, 80),
      nicho: (parsed.nicho || "").trim().slice(0, 140) || "Conteúdo digital",
      inscritosOuAlcance:
        (parsed.inscritos_ou_alcance || "").trim().slice(0, 80) ||
        "Não visível",
      emailVisivel,
      ganchoPersonalizado:
        (parsed.gancho_personalizado || "").trim().slice(0, 260) ||
        `Canal ${nomeCanal} com forte aderência para criação de artigos e conteúdo digital.`,
      mensagemCurta: (parsed.mensagem_curta || "").trim() || fallbackCurta,
      assuntoEmail:
        (parsed.assunto_email || "").trim().slice(0, 120) ||
        `Convite de parceria Artigen · ${nomeCanal}`,
      mensagemEmailCurta:
        (parsed.mensagem_email_curta || "").trim() || fallbackEmail,
    },
  };
}

