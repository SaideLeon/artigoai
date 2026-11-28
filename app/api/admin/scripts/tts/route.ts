import { NextRequest, NextResponse } from "next/server";
import {
  synthesizeScriptSpeechWithGoogle,
  type GeminiTtsModelId,
  type GeminiTtsVoiceName,
} from "@/lib/admin-scripts";
import { requireSupremeAdmin } from "@/lib/partners-server";

export async function POST(req: NextRequest) {
  const auth = await requireSupremeAdmin();
  if (!auth.ok) {
    return NextResponse.json({ erro: auth.error }, { status: auth.status });
  }

  let body: {
    text?: unknown;
    voiceName?: unknown;
    model?: unknown;
    styleInstruction?: unknown;
  } = {};

  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { erro: "Corpo JSON inválido." },
      { status: 400 }
    );
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (text.length < 3) {
    return NextResponse.json(
      { erro: "Informe o texto da locução para gerar o áudio." },
      { status: 400 }
    );
  }

  if (text.length > 24000) {
    return NextResponse.json(
      {
        erro: "O texto excede 24.000 caracteres. Divida ou gere por cenas para síntese de áudio.",
      },
      { status: 400 }
    );
  }

  try {
    const result = await synthesizeScriptSpeechWithGoogle({
      text,
      voiceName:
        typeof body.voiceName === "string"
          ? (body.voiceName as GeminiTtsVoiceName)
          : undefined,
      model:
        typeof body.model === "string"
          ? (body.model as GeminiTtsModelId)
          : undefined,
      styleInstruction:
        typeof body.styleInstruction === "string"
          ? body.styleInstruction
          : undefined,
    });

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (err) {
    return NextResponse.json(
      {
        erro:
          err instanceof Error
            ? err.message
            : "Falha ao sintetizar áudio com o sistema Google TTS.",
      },
      { status: 500 }
    );
  }
}
