const CACHE_NAME = "artigen-pwa-v1";
const STATIC_ASSETS = [
  "/manifest.webmanifest",
  "/pwa-192x192.png",
  "/pwa-512x512.png",
  "/pwa-maskable-512x512.png",
  "/apple-touch-icon.png",
  "/icon.svg",
];

function buildOfflineResponse() {
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Sem conexão — Artigen</title>
  <style>
    :root { color-scheme: light dark; }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 24px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #f4f6fb;
      color: #0f172a;
    }
    @media (prefers-color-scheme: dark) {
      body { background: #020617; color: #f8fafc; }
      .card { background: #0f172a; border-color: #1e293b; }
      .muted { color: #94a3b8; }
    }
    .card {
      max-width: 420px;
      width: 100%;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 20px;
      padding: 28px;
      text-align: center;
      box-shadow: 0 12px 30px rgba(15, 23, 42, 0.08);
    }
    h1 { margin: 0 0 10px; font-size: 20px; font-weight: 700; }
    p { margin: 0 0 20px; font-size: 14px; line-height: 1.55; }
    .muted { color: #475569; }
    button {
      border: 0;
      border-radius: 12px;
      background: linear-gradient(135deg, #5b4af4, #2563eb);
      color: #ffffff;
      font-weight: 600;
      font-size: 14px;
      padding: 11px 18px;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <main class="card">
    <h1>Você está offline</h1>
    <p class="muted">
      O Artigen precisa de conexão com a internet para gerar artigos e imagens com IA.
      Verifique sua rede e tente novamente.
    </p>
    <button type="button" onclick="window.location.reload()">Tentar novamente</button>
  </main>
</body>
</html>`;

  return new Response(html, {
    status: 503,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .catch(() => undefined)
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((oldKey) => caches.delete(oldKey))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/auth/") ||
    url.pathname.startsWith("/_next/webpack-hmr")
  ) {
    return;
  }

  if (STATIC_ASSETS.includes(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const networkFetch = fetch(request)
          .then((response) => {
            if (response && response.ok) {
              const copy = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            }
            return response;
          })
          .catch(() => cached);
        return cached || networkFetch;
      })
    );
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => buildOfflineResponse()));
  }
});
