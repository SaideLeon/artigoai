const URL_API = "https://openrouter.ai/api/v1/chat/completions";

// Envia um pedido ao OpenRouter e repete se houver erro 429 (demasiados pedidos).
export async function chat(body: Record<string, unknown>, tentativas = 3) {
  for (let i = 0; i < tentativas; i++) {
    const r = await fetch(URL_API, {
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

export const MODELO_TEXTO = process.env.TEXT_MODEL ?? "openrouter/free";
export const MODELO_IMAGEM =
  process.env.IMAGE_MODEL ?? "recraft/recraft-v4.1-flash-v2:free";
