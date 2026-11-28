import dns from "node:dns/promises";
import net from "node:net";

export type ScrapedPrimarySource = {
  url: string;
  title: string;
  description: string;
  author?: string;
  publishedAt?: string;
  headings: string[];
  excerpt: string;
  ok: boolean;
  error?: string;
};

const MAX_LINKS = 5;
const MAX_REDIRECTS = 3;
const FETCH_TIMEOUT_MS = 10000;
const MAX_RESPONSE_BYTES = 1_500_000;
const MAX_CHARS_PER_LINK = 4200;
const MAX_TOTAL_PRIMARY_CHARS = 14000;

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "ip6-localhost",
  "ip6-loopback",
  "metadata.google.internal",
  "metadata",
  "0.0.0.0",
]);

function isBlockedIpv4(ip: string): boolean {
  const parts = ip.split(".").map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true;
  }
  const [a, b, c] = parts;

  if (a === 0) return true; // 0.0.0.0/8
  if (a === 10) return true; // 10.0.0.0/8 (RFC1918)
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 (CGNAT)
  if (a === 127) return true; // 127.0.0.0/8 (loopback)
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 (link-local / cloud metadata)
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12 (RFC1918)
  if (a === 192 && b === 0 && c === 0) return true; // 192.0.0.0/24
  if (a === 192 && b === 0 && c === 2) return true; // TEST-NET-1
  if (a === 192 && b === 168) return true; // 192.168.0.0/16 (RFC1918)
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
  if (a === 198 && b === 51 && c === 100) return true; // TEST-NET-2
  if (a === 203 && b === 0 && c === 113) return true; // TEST-NET-3
  if (a >= 224) return true; // multicast & reserved (224.0.0.0/4+)

  return false;
}

function isBlockedIpv6(ip: string): boolean {
  const clean = ip.toLowerCase().split("%")[0];
  if (clean === "::" || clean === "::1") return true;

  // Unwrap IPv4-mapped IPv6 (e.g. ::ffff:127.0.0.1 or ::ffff:7f00:1)
  if (clean.startsWith("::ffff:")) {
    const rest = clean.slice(7);
    if (net.isIPv4(rest)) {
      return isBlockedIpv4(rest);
    }
    const hexMatch = rest.match(/^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
    if (hexMatch) {
      const hi = parseInt(hexMatch[1], 16);
      const lo = parseInt(hexMatch[2], 16);
      const ipv4 = `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
      return isBlockedIpv4(ipv4);
    }
  }

  // Unique local addresses (fc00::/7 -> fc.. or fd..)
  if (clean.startsWith("fc") || clean.startsWith("fd")) return true;
  // Link-local (fe80::/10)
  if (/^fe[89ab]/.test(clean)) return true;
  // Multicast (ff00::/8)
  if (clean.startsWith("ff")) return true;

  return false;
}

function isBlockedIp(ip: string): boolean {
  const family = net.isIP(ip);
  if (family === 4) return isBlockedIpv4(ip);
  if (family === 6) return isBlockedIpv6(ip);
  return true;
}

async function assertSafeExternalUrl(rawUrl: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new Error("URL inválida.");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Apenas links HTTP ou HTTPS são permitidos.");
  }

  if (parsed.username || parsed.password) {
    throw new Error("URLs com credenciais embutidas não são permitidas.");
  }

  const host = parsed.hostname.toLowerCase().replace(/\.+$/, "");
  if (
    !host ||
    BLOCKED_HOSTNAMES.has(host) ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) {
    throw new Error("Destino de rede local ou reservado bloqueado.");
  }

  // Direct IP literal check
  if (net.isIP(host)) {
    if (isBlockedIp(host)) {
      throw new Error("Endereço IP privado ou reservado bloqueado.");
    }
    return parsed;
  }

  // Resolve DNS records and reject if any resolved IP is private/internal
  let records: Array<{ address: string; family: number }>;
  try {
    records = await dns.lookup(host, { all: true });
  } catch {
    throw new Error(`Não foi possível resolver o domínio ${host}.`);
  }

  if (!records || records.length === 0) {
    throw new Error(`Sem endereço IP válido para ${host}.`);
  }

  for (const rec of records) {
    if (isBlockedIp(rec.address)) {
      throw new Error(`Acesso bloqueado a endereço interno para ${host}.`);
    }
  }

  return parsed;
}

export function extractUrlsFromText(text: string): string[] {
  if (!text || typeof text !== "string") return [];
  const matches = text.match(/https?:\/\/[^\s<>"'`]+/gi) ?? [];
  const cleaned: string[] = [];
  for (const m of matches) {
    const trimmed = m.replace(/[),.;:!?\]}]+$/g, "");
    try {
      const u = new URL(trimmed);
      if (u.protocol === "http:" || u.protocol === "https:") {
        cleaned.push(u.toString());
      }
    } catch {
      // ignore invalid URL fragment
    }
  }
  return cleaned;
}

export function normalizeAndDedupeLinks(
  explicitLinks?: unknown,
  ...extraTexts: Array<string | undefined>
): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  const pushCandidate = (raw: string) => {
    const trimmed = raw.trim().replace(/[),.;:!?\]}]+$/g, "");
    if (!trimmed) return;
    const withScheme = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : /^[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(trimmed)
      ? `https://${trimmed}`
      : "";
    if (!withScheme) return;
    try {
      const u = new URL(withScheme);
      if (u.protocol !== "http:" && u.protocol !== "https:") return;
      const canonical = u.toString();
      if (!seen.has(canonical)) {
        seen.add(canonical);
        result.push(canonical);
      }
    } catch {
      // ignore invalid URL
    }
  };

  if (Array.isArray(explicitLinks)) {
    for (const item of explicitLinks) {
      if (typeof item === "string") {
        for (const piece of item.split(/[\s,;\n]+/)) {
          pushCandidate(piece);
        }
      }
    }
  } else if (typeof explicitLinks === "string") {
    for (const piece of explicitLinks.split(/[\s,;\n]+/)) {
      pushCandidate(piece);
    }
  }

  for (const text of extraTexts) {
    if (typeof text === "string" && text) {
      for (const found of extractUrlsFromText(text)) {
        pushCandidate(found);
      }
    }
  }

  return result.slice(0, MAX_LINKS);
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&ndash;/gi, "–")
    .replace(/&mdash;/gi, "—")
    .replace(/&hellip;/gi, "…")
    .replace(/&#(\d+);/g, (_, num) => {
      const code = Number(num);
      return Number.isFinite(code) && code > 0 && code < 0x10ffff
        ? String.fromCodePoint(code)
        : "";
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      const code = parseInt(hex, 16);
      return Number.isFinite(code) && code > 0 && code < 0x10ffff
        ? String.fromCodePoint(code)
        : "";
    });
}

function stripTagsToText(html: string): string {
  const withoutNoise = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|template|iframe|canvas|object|embed)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<(nav|footer|aside|form|menu)\b[^>]*>[\s\S]*?<\/\1>/gi, " ");

  const withBreaks = withoutNoise
    .replace(/<\/(p|div|section|article|li|blockquote|h[1-6]|tr|figcaption)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ");

  return decodeHtmlEntities(withBreaks)
    .replace(/[ \t\r]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractMetaTag(html: string, key: string): string {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const p1 = new RegExp(
    `<meta[^>]+(?:name|property)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`,
    "i"
  );
  const p2 = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${escaped}["'][^>]*>`,
    "i"
  );
  const raw = html.match(p1)?.[1] ?? html.match(p2)?.[1] ?? "";
  return decodeHtmlEntities(raw).trim();
}

function extractTagContent(html: string, tag: string): string {
  const match = html.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match?.[1] ?? "";
}

function extractHeadings(html: string): string[] {
  const headings: string[] = [];
  const regex = /<h[1-3]\b[^>]*>([\s\S]*?)<\/h[1-3]>/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null && headings.length < 15) {
    const clean = stripTagsToText(match[1]).replace(/\n+/g, " ").trim();
    if (clean.length >= 3 && clean.length <= 160 && !headings.includes(clean)) {
      headings.push(clean);
    }
  }
  return headings;
}

function extractJsonLdArticleText(html: string): {
  headline?: string;
  body?: string;
} {
  const matches = html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  );
  for (const m of matches) {
    try {
      const parsed = JSON.parse(m[1].trim());
      const list = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.["@graph"])
        ? parsed["@graph"]
        : [parsed];
      for (const item of list) {
        if (item && typeof item === "object") {
          const body =
            typeof item.articleBody === "string"
              ? item.articleBody.trim()
              : typeof item.text === "string"
              ? item.text.trim()
              : "";
          const headline =
            typeof item.headline === "string"
              ? item.headline.trim()
              : typeof item.name === "string"
              ? item.name.trim()
              : "";
          if (body.length > 150) {
            return { headline, body };
          }
        }
      }
    } catch {
      // ignore invalid JSON-LD
    }
  }
  return {};
}

async function readResponseWithLimit(
  res: Response,
  maxBytes: number
): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      total += value.byteLength;
      if (total > maxBytes) {
        const excess = total - maxBytes;
        chunks.push(value.subarray(0, value.byteLength - excess));
        await reader.cancel().catch(() => {});
        break;
      }
      chunks.push(value);
    }
  }

  const merged = new Uint8Array(Math.min(total, maxBytes));
  let offset = 0;
  for (const c of chunks) {
    merged.set(c, offset);
    offset += c.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(merged);
}

export async function fetchWithSafeRedirects(startUrl: string): Promise<{
  finalUrl: string;
  contentType: string;
  body: string;
}> {
  let currentUrl = startUrl;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const safeUrl = await assertSafeExternalUrl(currentUrl);
    const res = await fetch(safeUrl.toString(), {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; ArtigenBot/1.0; +https://criador.artificializar.site)",
        Accept:
          "text/html,application/xhtml+xml,text/plain,application/json;q=0.9,*/*;q=0.8",
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
      },
    });

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) {
        throw new Error(`Redirecionamento HTTP ${res.status} sem destino.`);
      }
      currentUrl = new URL(location, safeUrl).toString();
      continue;
    }

    if (!res.ok) {
      throw new Error(`A página respondeu com HTTP ${res.status}.`);
    }

    const contentType = (res.headers.get("content-type") ?? "text/html").toLowerCase();
    const isTextLike =
      contentType.includes("text/") ||
      contentType.includes("application/xhtml") ||
      contentType.includes("application/json") ||
      contentType.includes("application/xml") ||
      contentType.includes("+xml");

    if (!isTextLike) {
      throw new Error(
        `Tipo de ficheiro não textual (${contentType.split(";")[0]}).`
      );
    }

    const body = await readResponseWithLimit(res, MAX_RESPONSE_BYTES);
    return { finalUrl: safeUrl.toString(), contentType, body };
  }

  throw new Error("Demasiados redirecionamentos ao aceder ao link.");
}

async function scrapeSingleLink(url: string): Promise<ScrapedPrimarySource> {
  try {
    const { finalUrl, contentType, body } = await fetchWithSafeRedirects(url);

    if (contentType.includes("application/json")) {
      return {
        url: finalUrl,
        title: new URL(finalUrl).hostname,
        description: "Dados JSON fornecidos pelo utilizador",
        headings: [],
        excerpt: body.slice(0, MAX_CHARS_PER_LINK).trim(),
        ok: true,
      };
    }

    if (
      contentType.includes("text/plain") ||
      contentType.includes("text/markdown")
    ) {
      const firstLine =
        body
          .split("\n")
          .map((l) => l.trim())
          .find(Boolean)
          ?.replace(/^#+\s*/, "") ?? new URL(finalUrl).hostname;
      return {
        url: finalUrl,
        title: firstLine.slice(0, 140),
        description: "",
        headings: [],
        excerpt: body.slice(0, MAX_CHARS_PER_LINK).trim(),
        ok: true,
      };
    }

    // HTML extraction
    const titleTag = stripTagsToText(extractTagContent(body, "title"));
    const ogTitle = extractMetaTag(body, "og:title");
    const twitterTitle = extractMetaTag(body, "twitter:title");
    const description =
      extractMetaTag(body, "og:description") ||
      extractMetaTag(body, "description") ||
      extractMetaTag(body, "twitter:description");
    const author =
      extractMetaTag(body, "author") || extractMetaTag(body, "article:author");
    const publishedAt =
      extractMetaTag(body, "article:published_time") ||
      extractMetaTag(body, "date");

    const jsonLd = extractJsonLdArticleText(body);
    const title = (ogTitle || twitterTitle || jsonLd.headline || titleTag || new URL(finalUrl).hostname)
      .slice(0, 180)
      .trim();

    const articleHtml = extractTagContent(body, "article");
    const mainHtml = extractTagContent(body, "main");
    const bodyHtml = extractTagContent(body, "body") || body;

    const articleText = articleHtml ? stripTagsToText(articleHtml) : "";
    const mainText = mainHtml ? stripTagsToText(mainHtml) : "";
    const fullBodyText = stripTagsToText(bodyHtml);

    let primaryText =
      articleText.length >= 280
        ? articleText
        : mainText.length >= 280
        ? mainText
        : fullBodyText;

    if (jsonLd.body && jsonLd.body.length > primaryText.length) {
      primaryText = jsonLd.body;
    }

    const headings = extractHeadings(articleHtml || mainHtml || bodyHtml);

    if (!primaryText && description) {
      primaryText = description;
    }

    return {
      url: finalUrl,
      title,
      description: description.slice(0, 320),
      author: author || undefined,
      publishedAt: publishedAt || undefined,
      headings,
      excerpt: primaryText.slice(0, MAX_CHARS_PER_LINK).trim(),
      ok: Boolean(primaryText || description || titleTag),
      error:
        !primaryText && !description
          ? "A página não expôs conteúdo textual legível diretamente."
          : undefined,
    };
  } catch (err) {
    let fallbackHost = url;
    try {
      fallbackHost = new URL(url).hostname;
    } catch {
      // ignore
    }
    return {
      url,
      title: fallbackHost,
      description: "",
      headings: [],
      excerpt: "",
      ok: false,
      error: (err as Error).message,
    };
  }
}

export async function scrapePrimaryLinks(urls: string[]): Promise<{
  sources: ScrapedPrimarySource[];
  formattedContext: string;
}> {
  if (!urls || urls.length === 0) {
    return { sources: [], formattedContext: "" };
  }

  const limited = urls.slice(0, MAX_LINKS);
  const sources = await Promise.all(limited.map((u) => scrapeSingleLink(u)));

  let remainingChars = MAX_TOTAL_PRIMARY_CHARS;
  const blocks: string[] = [];

  sources.forEach((src, idx) => {
    const headerLines = [
      `[FONTE PRIMÁRIA ${idx + 1}] ${src.title}`,
      `URL: ${src.url}`,
      src.author ? `Autor: ${src.author}` : "",
      src.publishedAt ? `Data: ${src.publishedAt}` : "",
      src.description ? `Resumo da página: ${src.description}` : "",
      src.headings.length > 0
        ? `Tópicos principais na página: ${src.headings.join(" | ")}`
        : "",
    ].filter(Boolean);

    let bodyText = "";
    if (src.excerpt && remainingChars > 200) {
      const slice = src.excerpt.slice(0, Math.min(MAX_CHARS_PER_LINK, remainingChars));
      remainingChars -= slice.length;
      bodyText = `Conteúdo raspado da fonte primária:\n${slice}`;
    } else if (!src.ok && src.error) {
      bodyText = `Aviso na raspagem direta: ${src.error} (tenta consultar este URL diretamente na busca web e priorizá-lo como fonte primária).`;
    }

    blocks.push([...headerLines, bodyText].filter(Boolean).join("\n"));
  });

  const formattedContext =
    blocks.length > 0
      ? `=== FONTES PRIMÁRIAS FORNECIDAS PELO UTILIZADOR (PRIORIDADE MÁXIMA — TRABALHO ORIGINAL) ===\nAs informações abaixo foram raspadas diretamente dos links fornecidos pelo utilizador e DEVEM servir como a base principal do artigo:\n\n${blocks.join(
          "\n\n---\n\n"
        )}`
      : "";

  return { sources, formattedContext };
}
