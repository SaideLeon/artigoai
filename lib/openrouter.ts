const URL_CHAT = "https://openrouter.ai/api/v1/chat/completions";
const URL_IMAGES = "https://openrouter.ai/api/v1/images";

// Envia um pedido ao OpenRouter e repete se houver erro 429 (demasiados pedidos).
async function postOpenRouter(
  url: string,
  body: Record<string, unknown>,
  tentativas = 3
) {
  for (let i = 0; i < tentativas; i++) {
    const r = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (r.status === 429 && i < tentativas - 1) {
      await new Promise((ok) => setTimeout(ok, 4000 * (i + 1)));
      continue;
    }

    const data = await r.json();
    if (!r.ok) throw new Error(data?.error?.message ?? `Erro ${r.status}`);
    return data;
  }
  throw new Error("Limite de pedidos excedido. Tenta daqui a um minuto.");
}

export function chat(body: Record<string, unknown>, tentativas = 3) {
  return postOpenRouter(URL_CHAT, body, tentativas);
}

export function gerarImagem(body: Record<string, unknown>, tentativas = 3) {
  return postOpenRouter(URL_IMAGES, body, tentativas);
}

export const MODELO_TEXTO = process.env.TEXT_MODEL || "openrouter/free";
export const MODELO_IMAGEM =
  process.env.IMAGE_MODEL || "recraft/recraft-v4.1-flash-v2:free";
