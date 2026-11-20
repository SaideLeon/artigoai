import type { User } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { OperationType, handleFirestoreError } from "@/lib/firestore-errors";
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
    // Avoid storing > 1MB base64 data URIs inside Firestore documents
    if (s.img && !s.img.startsWith("data:") && s.img.length <= 2048) {
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

function buildArticlePayload(artigo: ArtigoSalvo, userId: string) {
  const safeId = sanitizeDocumentId(artigo.id);
  const safeFaixa: FaixaPalavrasId = ALLOWED_FAIXAS.has(artigo.faixaPalavras)
    ? artigo.faixaPalavras
    : "2000-2500";
  const safeTotal = Math.min(
    50000,
    Math.max(0, Math.round(Number(artigo.totalPalavras) || 0))
  );
  const safeTema = clampStr(artigo.tema.trim() || artigo.titulo.trim() || "Artigo", 300);
  const safeTitulo = clampStr(artigo.titulo.trim() || safeTema, 300);
  const safePalavrasChave = (artigo.palavrasChave ?? [])
    .slice(0, 20)
    .map((k) => clampStr(k, 80))
    .filter(Boolean);

  return {
    id: safeId,
    userId,
    tema: safeTema,
    titulo: safeTitulo,
    descricao: clampStr(artigo.descricao ?? "", 1000),
    palavrasChave: safePalavrasChave,
    tom: clampStr(artigo.tom || "Informativo e Didático", 80),
    idioma: clampStr(artigo.idioma || "Português (Brasil)", 60),
    faixaPalavras: safeFaixa,
    primeiraPessoa: Boolean(artigo.primeiraPessoa),
    pesquisaUsada: Boolean(artigo.pesquisaUsada),
    fontes: sanitizeFontesForCloud(artigo.fontes ?? []),
    secoes: sanitizeSecoesForCloud(artigo.secoes ?? []),
    criadoEm: clampStr(artigo.criadoEm || new Date().toISOString(), 64),
    favorito: Boolean(artigo.favorito),
    totalPalavras: safeTotal,
  };
}

export async function upsertUserProfile(user: User): Promise<void> {
  const path = `users/${user.uid}`;
  const ref = doc(db, "users", user.uid);
  try {
    const snap = await getDoc(ref);
    const displayName = clampStr(user.displayName || "Usuário Artigen", 160);
    const email = clampStr(user.email || "", 254);
    const photoURL = clampStr(user.photoURL || "", 1024);

    if (!snap.exists()) {
      await setDoc(ref, {
        uid: user.uid,
        displayName,
        email,
        photoURL,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        displayName,
        email,
        photoURL,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeUserSettings(
  userId: string,
  onData: (config: Partial<ConfiguracoesPadrao> & { theme?: "light" | "dark" }) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = `users/${userId}/settings/preferences`;
  const ref = doc(db, "users", userId, "settings", "preferences");
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) return;
      const d = snap.data();
      onData({
        tomPadrao: typeof d.tomPadrao === "string" ? d.tomPadrao : undefined,
        idiomaPadrao:
          typeof d.idiomaPadrao === "string" ? d.idiomaPadrao : undefined,
        faixaPalavrasPadrao: ALLOWED_FAIXAS.has(d.faixaPalavrasPadrao)
          ? (d.faixaPalavrasPadrao as FaixaPalavrasId)
          : undefined,
        incluirImagensPadrao:
          typeof d.incluirImagensPadrao === "boolean"
            ? d.incluirImagensPadrao
            : undefined,
        primeiraPessoaPadrao:
          typeof d.primeiraPessoaPadrao === "boolean"
            ? d.primeiraPessoaPadrao
            : undefined,
        pesquisaWebPadrao: ALLOWED_PESQUISA.has(d.pesquisaWebPadrao)
          ? (d.pesquisaWebPadrao as ModoPesquisa)
          : undefined,
        theme: d.theme === "dark" || d.theme === "light" ? d.theme : undefined,
      });
    },
    (error) => {
      console.error(`Erro ao escutar preferências (${path}):`, error);
      onError?.(error);
    }
  );
}

export async function saveUserSettings(
  userId: string,
  config: ConfiguracoesPadrao,
  theme: "light" | "dark"
): Promise<void> {
  const path = `users/${userId}/settings/preferences`;
  const ref = doc(db, "users", userId, "settings", "preferences");

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

  const fields = {
    tomPadrao: clampStr(config.tomPadrao || "Informativo e Didático", 80),
    idiomaPadrao: clampStr(config.idiomaPadrao || "Português (Brasil)", 60),
    faixaPalavrasPadrao: safeFaixa,
    incluirImagensPadrao: Boolean(config.incluirImagensPadrao),
    primeiraPessoaPadrao: Boolean(config.primeiraPessoaPadrao),
    pesquisaWebPadrao: safePesquisa,
    theme: theme === "dark" ? "dark" : "light",
    updatedAt: serverTimestamp(),
  };

  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        userId,
        ...fields,
        createdAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, fields);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeUserArticles(
  userId: string,
  onData: (articles: ArtigoSalvo[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = `users/${userId}/articles`;
  const q = query(
    collection(db, "users", userId, "articles"),
    where("userId", "==", userId)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const items: ArtigoSalvo[] = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: String(d.id ?? docSnap.id),
          tema: String(d.tema ?? ""),
          titulo: String(d.titulo ?? ""),
          descricao: String(d.descricao ?? ""),
          palavrasChave: Array.isArray(d.palavrasChave)
            ? d.palavrasChave.map(String)
            : [],
          tom: String(d.tom ?? "Informativo e Didático"),
          idioma: String(d.idioma ?? "Português (Brasil)"),
          faixaPalavras: ALLOWED_FAIXAS.has(d.faixaPalavras)
            ? (d.faixaPalavras as FaixaPalavrasId)
            : "2000-2500",
          primeiraPessoa: Boolean(d.primeiraPessoa),
          pesquisaUsada: Boolean(d.pesquisaUsada),
          fontes: Array.isArray(d.fontes) ? (d.fontes as FontePesquisa[]) : [],
          secoes: Array.isArray(d.secoes) ? (d.secoes as Secao[]) : [],
          criadoEm: String(d.criadoEm ?? new Date().toISOString()),
          favorito: Boolean(d.favorito),
          totalPalavras: Number(d.totalPalavras ?? 0),
        };
      });

      items.sort(
        (a, b) => Date.parse(b.criadoEm) - Date.parse(a.criadoEm)
      );
      onData(items);
    },
    (error) => {
      console.error(`Erro ao escutar artigos (${path}):`, error);
      onError?.(error);
    }
  );
}

export async function saveArticleCloud(
  userId: string,
  artigo: ArtigoSalvo
): Promise<void> {
  const payload = buildArticlePayload(artigo, userId);
  const path = `users/${userId}/articles/${payload.id}`;
  const ref = doc(db, "users", userId, "articles", payload.id);

  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        tema: payload.tema,
        titulo: payload.titulo,
        descricao: payload.descricao,
        palavrasChave: payload.palavrasChave,
        tom: payload.tom,
        idioma: payload.idioma,
        faixaPalavras: payload.faixaPalavras,
        primeiraPessoa: payload.primeiraPessoa,
        pesquisaUsada: payload.pesquisaUsada,
        fontes: payload.fontes,
        secoes: payload.secoes,
        favorito: payload.favorito,
        totalPalavras: payload.totalPalavras,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateArticleContentCloud(
  userId: string,
  articleId: string,
  titulo: string,
  descricao: string,
  secoes: Secao[],
  totalPalavras: number
): Promise<void> {
  const safeId = sanitizeDocumentId(articleId);
  const path = `users/${userId}/articles/${safeId}`;
  const ref = doc(db, "users", userId, "articles", safeId);

  try {
    await updateDoc(ref, {
      titulo: clampStr(titulo.trim() || "Artigo", 300),
      descricao: clampStr(descricao ?? "", 1000),
      secoes: sanitizeSecoesForCloud(secoes),
      totalPalavras: Math.min(50000, Math.max(0, Math.round(totalPalavras))),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function toggleArticleFavoriteCloud(
  userId: string,
  articleId: string,
  favorito: boolean
): Promise<void> {
  const safeId = sanitizeDocumentId(articleId);
  const path = `users/${userId}/articles/${safeId}`;
  const ref = doc(db, "users", userId, "articles", safeId);

  try {
    await updateDoc(ref, {
      favorito: Boolean(favorito),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteArticleCloud(
  userId: string,
  articleId: string
): Promise<void> {
  const safeId = sanitizeDocumentId(articleId);
  const path = `users/${userId}/articles/${safeId}`;
  const ref = doc(db, "users", userId, "articles", safeId);

  try {
    await deleteDoc(ref);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function clearAllArticlesCloud(
  userId: string,
  articleIds: string[]
): Promise<void> {
  if (articleIds.length === 0) return;
  const path = `users/${userId}/articles`;
  try {
    const batch = writeBatch(db);
    for (const id of articleIds) {
      const safeId = sanitizeDocumentId(id);
      batch.delete(doc(db, "users", userId, "articles", safeId));
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
