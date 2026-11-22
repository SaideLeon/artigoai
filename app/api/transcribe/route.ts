import { NextResponse } from "next/server";
import { Groq } from "groq-sdk";

const MAX_AUDIO_BYTES = 24 * 1024 * 1024; // 24 MB (Groq Whisper limit is 25 MB)

const ALLOWED_EXTENSIONS = new Set([
  "flac",
  "mp3",
  "mp4",
  "mpeg",
  "mpga",
  "m4a",
  "ogg",
  "wav",
  "webm",
]);

function mapLanguageCode(idioma?: string | null): string | undefined {
  if (!idioma) return undefined;
  const lower = idioma.toLowerCase();
  if (lower.includes("portugu")) return "pt";
  if (lower.includes("english") || lower === "en") return "en";
  if (lower.includes("espa") || lower === "es") return "es";
  if (lower.includes("fran") || lower === "fr") return "fr";
  return undefined;
}

function resolveAudioFilename(originalName: string, mimeType: string): {
  filename: string;
  mime: string;
} {
  const cleanMime = mimeType.split(";")[0].trim().toLowerCase();
  const extFromName = originalName.split(".").pop()?.toLowerCase() ?? "";

  if (ALLOWED_EXTENSIONS.has(extFromName)) {
    return {
      filename: `narration.${extFromName}`,
      mime: cleanMime || `audio/${extFromName}`,
    };
  }

  if (cleanMime.includes("mp4") || cleanMime.includes("m4a")) {
    return { filename: "narration.m4a", mime: "audio/mp4" };
  }
  if (cleanMime.includes("mpeg") || cleanMime.includes("mp3")) {
    return { filename: "narration.mp3", mime: "audio/mpeg" };
  }
  if (cleanMime.includes("ogg")) {
    return { filename: "narration.ogg", mime: "audio/ogg" };
  }
  if (cleanMime.includes("wav")) {
    return { filename: "narration.wav", mime: "audio/wav" };
  }
  if (cleanMime.includes("flac")) {
    return { filename: "narration.flac", mime: "audio/flac" };
  }
  return { filename: "narration.webm", mime: "audio/webm" };
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GROQ_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json(
        {
          erro: "GROQ_API_KEY não configurada no servidor para transcrever o áudio com Whisper.",
        },
        { status: 500 }
      );
    }

    const formData = await req.formData();
    const audioEntry = formData.get("file");
    const idiomaRaw = formData.get("idioma");
    const idioma = typeof idiomaRaw === "string" ? idiomaRaw : undefined;

    if (!(audioEntry instanceof File)) {
      return NextResponse.json(
        { erro: "Nenhum ficheiro de áudio válido foi enviado." },
        { status: 400 }
      );
    }

    if (audioEntry.size === 0) {
      return NextResponse.json(
        { erro: "A gravação está vazia. Tente gravar novamente." },
        { status: 400 }
      );
    }

    if (audioEntry.size > MAX_AUDIO_BYTES) {
      return NextResponse.json(
        { erro: "O áudio excede o limite de 24 MB." },
        { status: 413 }
      );
    }

    const cleanType = (audioEntry.type || "").toLowerCase();
    const rawExt = audioEntry.name.split(".").pop()?.toLowerCase() ?? "";
    const isAudioType =
      cleanType.startsWith("audio/") ||
      cleanType.startsWith("video/webm") ||
      cleanType.startsWith("video/mp4") ||
      ALLOWED_EXTENSIONS.has(rawExt);

    if (!isAudioType) {
      return NextResponse.json(
        {
          erro: "Formato de ficheiro não suportado. Use áudio (webm, m4a, mp3, wav, ogg).",
        },
        { status: 400 }
      );
    }

    const { filename, mime } = resolveAudioFilename(
      audioEntry.name || "narration.webm",
      audioEntry.type || "audio/webm"
    );
    const buffer = await audioEntry.arrayBuffer();
    const normalizedFile = new File([buffer], filename, { type: mime });

    const groq = new Groq({ apiKey });
    const languageCode = mapLanguageCode(idioma);

    const transcription = await groq.audio.transcriptions.create({
      file: normalizedFile,
      model: "whisper-large-v3-turbo",
      temperature: 0,
      response_format: "verbose_json",
      ...(languageCode ? { language: languageCode } : {}),
    });

    const text = (transcription.text ?? "").trim();
    if (!text) {
      return NextResponse.json(
        {
          erro: "Não foi possível detectar fala clara no áudio. Tente aproximar-se do microfone.",
        },
        { status: 422 }
      );
    }

    const verboseResult = transcription as unknown as {
      text: string;
      duration?: number;
      language?: string;
    };

    return NextResponse.json({
      text,
      duration: verboseResult.duration ?? null,
      language: verboseResult.language ?? languageCode ?? null,
    });
  } catch (e) {
    return NextResponse.json(
      {
        erro:
          e instanceof Error
            ? e.message
            : "Erro ao transcrever narração com Groq Whisper.",
      },
      { status: 500 }
    );
  }
}
