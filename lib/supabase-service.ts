import type { User } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabase";
import {
  FAIXAS_PALAVRAS,
  type ArtigoSalvo,
  type ConfiguracoesPadrao,
  type FaixaPalavrasId,
  type FontePesquisa,
  type ModoPesquisa,
  type Secao,
} from "@/lib/types";

const ALLOWED_FAIXAS = new Set<string>(FAIXAS_PALAVRAS.map((f) => f.id));
const ALLOWED_PESQUISA = new Set<string>(["auto", "sempre", "desativada"]);

export function sanitizeDocumentId(rawId: string): string {
  const cleaned = rawId.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 128);
  return cleaned || `art_${Date.now()}`;
}

function clampStr(val: string | undefined | null, max: number): string {
  return String(val ?? "").slice(0, max);
}

function sanitizeSecoesForCloud(secoes: Secao[]): Secao[] {
  return secoes.slice(0, 15).map((s) => {
    const clean: Secao = {
      titulo: clampStr(s.titulo, 250),
      objetivo: clampStr(s.objetivo, 500),
      texto: clampStr(s.texto ?? "", 25000),
    };
    if (s.prompt) clean.prompt = clampStr(s.prompt, 1000);
    if (s.img && s.img.length <= 2048 && !s.img.startsWith("data:")) {
      clean.img = s.img;
    }
    return clean;
  });
}

function sanitizeFontesForCloud(fontes: FontePesquisa[] = []): FontePesquisa[] {
  return fontes.slice(0, 30).map((f) => ({
    titulo: clampStr(f.titulo, 240),
    url: clampStr(f.url, 1024),
  }));
}

type ArticleRow = {
  id: string;
  user_id: string;
  tema: string;
  titulo: string;
  descricao: string;
  palavras_chave: unknown;
  tom: string;
  idioma: string;
  faixa_palavras: string;
  primeira_pessoa: boolean;
  pesquisa_usada: boolean;
  fontes: unknown;
  secoes: unknown;
  favorito: boolean;
  total_palavras: number;
  criado_em: string;
};

function mapRowToArticle(row: ArticleRow): ArtigoSalvo {
  return {
    id: String(row.id),
    tema: String(row.tema ?? ""),
    titulo: String(row.titulo ?? ""),
    descricao: String(row.descricao ?? ""),
    palavrasChave: Array.isArray(row.palavras_chave)
      ? row.palavras_chave.map(String)
      : [],
    tom: String(row.tom ?? "Informativo e Didático"),
    idioma: String(row.idioma ?? "Português (Brasil)"),
    faixaPalavras: ALLOWED_FAIXAS.has(row.faixa_palavras)
      ? (row.faixa_palavras as FaixaPalavrasId)
      : "2000-2500",
    primeiraPessoa: Boolean(row.primeira_pessoa),
    pesquisaUsada: Boolean(row.pesquisa_usada),
    fontes: Array.isArray(row.fontes) ? (row.fontes as FontePesquisa[]) : [],
    secoes: Array.isArray(row.secoes) ? (row.secoes as Secao[]) : [],
    criadoEm: String(row.criado_em ?? new Date().toISOString()),
    favorito: Boolean(row.favorito),
    totalPalavras: Number(row.total_palavras ?? 0),
  };
}

export async function upsertUserProfile(user: User): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const fullName = clampStr(
    (user.user_metadata?.full_name as string | undefined) ||
      (user.user_metadata?.name as string | undefined) ||
      "Usuário Artigen",
    160
  );
  const avatarUrl = clampStr(
    (user.user_metadata?.avatar_url as string | undefined) ||
      (user.user_metadata?.picture as string | undefined) ||
      "",
    1024
  );

  const { error } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      email: clampStr(user.email, 254),
      full_name: fullName,
      avatar_url: avatarUrl,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  if (error) {
    console.error("Erro ao sincronizar perfil Supabase:", error.message);
  }
}

export function subscribeUserSettings(
  userId: string,
  onData: (
    config: Partial<ConfiguracoesPadrao> & { theme?: "light" | "dark" }
  ) => void
): () => void {
  const supabase = getSupabaseClient();
  if (!supabase) return () => {};

  let active = true;

  const loadSettings = async () => {
    const { data, error } = await supabase
      .from("user_settings")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (!active || error || !data) return;
    onData({
      tomPadrao: typeof data.tom_padrao === "string" ? data.tom_padrao : undefined,
      idiomaPadrao:
        typeof data.idioma_padrao === "string" ? data.idioma_padrao : undefined,
      faixaPalavrasPadrao: ALLOWED_FAIXAS.has(data.faixa_palavras_padrao)
        ? (data.faixa_palavras_padrao as FaixaPalavrasId)
        : undefined,
      incluirImagensPadrao:
        typeof data.incluir_imagens_padrao === "boolean"
          ? data.incluir_imagens_padrao
          : undefined,
      primeiraPessoaPadrao:
        typeof data.primeira_pessoa_padrao === "boolean"
          ? data.primeira_pessoa_padrao
          : undefined,
      pesquisaWebPadrao: ALLOWED_PESQUISA.has(data.pesquisa_web_padrao)
        ? (data.pesquisa_web_padrao as ModoPesquisa)
        : undefined,
      theme:
        data.theme === "dark" || data.theme === "light" ? data.theme : undefined,
    });
  };

  void loadSettings();

  const channel = supabase
    .channel(`settings-${userId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "user_settings",
        filter: `user_id=eq.${userId}`,
      },
      () => {
        void loadSettings();
      }
    )
    .subscribe();

  return () => {
    active = false;
    void supabase.removeChannel(channel);
  };
}

export async function saveUserSettings(
  userId: string,
  config: ConfiguracoesPadrao,
  theme: "light" | "dark"
): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const safeFaixa: FaixaPalavrasId = ALLOWED_FAIXAS.has(
    config.faixaPalavrasPadrao
  )
    ? config.faixaPalavrasPadrao
    : "2000-2500";
  const safePesquisa: ModoPesquisa = ALLOWED_PESQUISA.has(
    config.pesquisaWebPadrao ?? "auto"
  )
    ? (config.pesquisaWebPadrao as ModoPesquisa)
    : "auto";

  const { error } = await supabase.from("user_settings").upsert(
    {
      user_id: userId,
      tom_padrao: clampStr(config.tomPadrao || "Informativo e Didático", 80),
      idioma_padrao: clampStr(config.idiomaPadrao || "Português (Brasil)", 60),
      faixa_palavras_padrao: safeFaixa,
      incluir_imagens_padrao: Boolean(config.incluirImagensPadrao),
      primeira_pessoa_padrao: Boolean(config.primeiraPessoaPadrao),
      pesquisa_web_padrao: safePesquisa,
      theme: theme === "dark" ? "dark" : "light",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) {
    console.error("Erro ao guardar configurações Supabase:", error.message);
  }
}

export function subscribeUserArticles(
  userId: string,
  onData: (articles: ArtigoSalvo[]) => void
): () => void {
  const supabase = getSupabaseClient();
  if (!supabase) return () => {};

  let active = true;

  const loadArticles = async () => {
    const { data, error } = await supabase
      .from("articles")
      .select("*")
      .eq("user_id", userId)
      .order("criado_em", { ascending: false });

    if (!active || error || !data) return;
    onData((data as ArticleRow[]).map(mapRowToArticle));
  };

  void loadArticles();

  const channel = supabase
    .channel(`articles-${userId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "articles",
        filter: `user_id=eq.${userId}`,
      },
      () => {
        void loadArticles();
      }
    )
    .subscribe();

  return () => {
    active = false;
    void supabase.removeChannel(channel);
  };
}

export async function saveArticleCloud(
  userId: string,
  artigo: ArtigoSalvo
): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const safeId = sanitizeDocumentId(artigo.id);
  const safeFaixa: FaixaPalavrasId = ALLOWED_FAIXAS.has(artigo.faixaPalavras)
    ? artigo.faixaPalavras
    : "2000-2500";
  const safeTotal = Math.min(
    50000,
    Math.max(0, Math.round(Number(artigo.totalPalavras) || 0))
  );
  const safeTema = clampStr(
    artigo.tema.trim() || artigo.titulo.trim() || "Artigo",
    300
  );
  const safeTitulo = clampStr(artigo.titulo.trim() || safeTema, 300);

  const { error } = await supabase.from("articles").upsert(
    {
      id: safeId,
      user_id: userId,
      tema: safeTema,
      titulo: safeTitulo,
      descricao: clampStr(artigo.descricao ?? "", 1000),
      palavras_chave: (artigo.palavrasChave ?? [])
        .slice(0, 20)
        .map((k) => clampStr(k, 80))
        .filter(Boolean),
      tom: clampStr(artigo.tom || "Informativo e Didático", 80),
      idioma: clampStr(artigo.idioma || "Português (Brasil)", 60),
      faixa_palavras: safeFaixa,
      primeira_pessoa: Boolean(artigo.primeiraPessoa),
      pesquisa_usada: Boolean(artigo.pesquisaUsada),
      fontes: sanitizeFontesForCloud(artigo.fontes ?? []),
      secoes: sanitizeSecoesForCloud(artigo.secoes ?? []),
      criado_em: artigo.criadoEm || new Date().toISOString(),
      favorito: Boolean(artigo.favorito),
      total_palavras: safeTotal,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  if (error) {
    console.error("Erro ao salvar artigo no Supabase:", error.message);
    return;
  }

  await supabase.from("generations").insert({
    user_id: userId,
    article_id: safeId,
    tema: safeTema,
    total_palavras: safeTotal,
    pesquisa_usada: Boolean(artigo.pesquisaUsada),
  });
}

export async function updateArticleContentCloud(
  userId: string,
  articleId: string,
  titulo: string,
  descricao: string,
  secoes: Secao[],
  totalPalavras: number
): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const safeId = sanitizeDocumentId(articleId);
  const { error } = await supabase
    .from("articles")
    .update({
      titulo: clampStr(titulo.trim() || "Artigo", 300),
      descricao: clampStr(descricao ?? "", 1000),
      secoes: sanitizeSecoesForCloud(secoes),
      total_palavras: Math.min(50000, Math.max(0, Math.round(totalPalavras))),
      updated_at: new Date().toISOString(),
    })
    .eq("id", safeId)
    .eq("user_id", userId);

  if (error) {
    console.error("Erro ao atualizar artigo no Supabase:", error.message);
  }
}

export async function toggleArticleFavoriteCloud(
  userId: string,
  articleId: string,
  favorito: boolean
): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const safeId = sanitizeDocumentId(articleId);
  const { error } = await supabase
    .from("articles")
    .update({
      favorito: Boolean(favorito),
      updated_at: new Date().toISOString(),
    })
    .eq("id", safeId)
    .eq("user_id", userId);

  if (error) {
    console.error("Erro ao atualizar favorito no Supabase:", error.message);
  }
}

export async function deleteArticleCloud(
  userId: string,
  articleId: string
): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const safeId = sanitizeDocumentId(articleId);
  const { error } = await supabase
    .from("articles")
    .delete()
    .eq("id", safeId)
    .eq("user_id", userId);

  if (error) {
    console.error("Erro ao excluir artigo no Supabase:", error.message);
  }
}

export async function clearAllArticlesCloud(userId: string): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const { error } = await supabase
    .from("articles")
    .delete()
    .eq("user_id", userId);

  if (error) {
    console.error("Erro ao limpar artigos no Supabase:", error.message);
  }
}
