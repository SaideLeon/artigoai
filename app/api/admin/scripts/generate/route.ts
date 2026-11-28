import { NextRequest, NextResponse } from "next/server";
import {
  generateAdminYoutubeScript,
  type LeadGoalPreset,
  type ScriptCreationMode,
  type VideoDurationPreset,
} from "@/lib/admin-scripts";
import { requireSupremeAdmin } from "@/lib/partners-server";

export async function POST(req: NextRequest) {
  const auth = await requireSupremeAdmin();
  if (!auth.ok) {
    return NextResponse.json({ erro: auth.error }, { status: auth.status });
  }

  let body: {
    modo?: unknown;
    numeroModulo?: unknown;
    tituloModulo?: unknown;
    tema?: unknown;
    objetivoConversao?: unknown;
    duracao?: unknown;
    tomLocucao?: unknown;
    idioma?: unknown;
    linkDestino?: unknown;
    notasAdmin?: unknown;
  } = {};

  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { erro: "Corpo JSON inválido." },
      { status: 400 }
    );
  }

  const modo: ScriptCreationMode =
    body.modo === "curso_modulo" ? "curso_modulo" : "video_leads";

  const numeroModulo =
    typeof body.numeroModulo === "number" && Number.isInteger(body.numeroModulo)
      ? body.numeroModulo
      : undefined;

  const tituloModulo =
    typeof body.tituloModulo === "string" ? body.tituloModulo.trim() : undefined;
  const tema = typeof body.tema === "string" ? body.tema.trim() : undefined;

  if (modo === "video_leads" && (!tema || tema.length < 4)) {
    return NextResponse.json(
      {
        erro: "Informe o tema ou ângulo do vídeo de YouTube (mínimo 4 caracteres).",
      },
      { status: 400 }
    );
  }

  const objetivoConversao: LeadGoalPreset =
    body.objetivoConversao === "assinatura_planos" ||
    body.objetivoConversao === "programa_parceiros"
      ? body.objetivoConversao
      : "teste_gratis_studio";

  const duracao: VideoDurationPreset =
    body.duracao === "short_60s" ||
    body.duracao === "completo_8_12m" ||
    body.duracao === "direto_3_5m"
      ? body.duracao
      : modo === "curso_modulo"
      ? "completo_8_12m"
      : "direto_3_5m";

  try {
    const script = await generateAdminYoutubeScript({
      modo,
      numeroModulo,
      tituloModulo,
      tema,
      objetivoConversao,
      duracao,
      tomLocucao:
        typeof body.tomLocucao === "string" ? body.tomLocucao : undefined,
      idioma: typeof body.idioma === "string" ? body.idioma : undefined,
      linkDestino:
        typeof body.linkDestino === "string" ? body.linkDestino : undefined,
      notasAdmin:
        typeof body.notasAdmin === "string" ? body.notasAdmin : undefined,
    });

    return NextResponse.json({
      ok: true,
      script,
    });
  } catch (err) {
    return NextResponse.json(
      {
        erro:
          err instanceof Error
            ? err.message
            : "Não foi possível gerar o roteiro.",
      },
      { status: 500 }
    );
  }
}
