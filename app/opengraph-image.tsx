import { ImageResponse } from "next/og";

export const alt = "Artigen — Gerador de Artigos para Blogs com IA";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          background:
            "linear-gradient(135deg, #0B1124 0%, #151F42 52%, #1D4ED8 100%)",
          color: "#F8FAFC",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "18px",
          }}
        >
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "16px",
              background: "linear-gradient(135deg, #5B4AF4 0%, #2563EB 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "30px",
              fontWeight: 800,
              color: "#FFFFFF",
              boxShadow: "0 12px 30px rgba(37, 99, 235, 0.35)",
            }}
          >
            A
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
            }}
          >
            <span
              style={{
                fontSize: "28px",
                fontWeight: 700,
                letterSpacing: "-0.02em",
                color: "#FFFFFF",
              }}
            >
              Artigen
            </span>
            <span
              style={{
                fontSize: "16px",
                color: "#93C5FD",
              }}
            >
              criador.artificializar.site
            </span>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "20px",
            maxWidth: "940px",
          }}
        >
          <div
            style={{
              fontSize: "58px",
              fontWeight: 800,
              lineHeight: 1.1,
              letterSpacing: "-0.03em",
              color: "#FFFFFF",
            }}
          >
            Gerador de Artigos para Blogs com Inteligência Artificial
          </div>
          <div
            style={{
              fontSize: "26px",
              lineHeight: 1.4,
              color: "#CBD5E1",
            }}
          >
            Estruture posts seção por seção, ilustre com IA, cite fontes reais
            da web e exporte em HTML limpo para o seu blog.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: "1px solid rgba(148, 163, 184, 0.25)",
            paddingTop: "24px",
            fontSize: "20px",
            color: "#E2E8F0",
          }}
        >
          <span>Pesquisa Web em Tempo Real</span>
          <span>·</span>
          <span>Imagens por Seção</span>
          <span>·</span>
          <span>Exportação HTML Limpa</span>
          <span>·</span>
          <span style={{ color: "#93C5FD", fontWeight: 700 }}>
            Comece Grátis
          </span>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
