import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import {
  GEMINI_TTS_MODELS,
  GEMINI_TTS_VOICES,
  mergeWavBuffers,
  OFFICIAL_COURSE_MODULES,
  sanitizeForTtsNarration,
  splitTextForTts,
  YOUTUBE_LEAD_PRESETS,
} from "@/lib/admin-scripts";

function createFakeWav(pcmBytes: number[]): Buffer {
  const pcm = Buffer.from(pcmBytes);
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(24000, 24);
  header.writeUInt32LE(48000, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

describe("Roteiros YouTube, Módulos de Curso e Google TTS (Admin-only)", () => {
  test("limpa marcações de cena, colchetes, markdown e timestamps para colar em IA de áudio", () => {
    const raw =
      "## Cena 1\n[TELA: /studio]\n0:00 **Olá!** (zoom na tela) Hoje você vai aprender *tudo* sobre o `Artigen`.\n- Passo um";
    const clean = sanitizeForTtsNarration(raw);

    assert.equal(clean.includes("[TELA"), false);
    assert.equal(clean.includes("(zoom"), false);
    assert.equal(clean.includes("##"), false);
    assert.equal(clean.includes("**"), false);
    assert.equal(clean.includes("0:00"), false);
    assert.ok(clean.includes("Olá! Hoje você vai aprender tudo sobre o Artigen."));
  });

  test("divide textos longos em blocos respeitando limite e preservando o conteúdo", () => {
    const sentence =
      "O Artigen permite criar artigos completos para blogs com pesquisa na web e imagens por seção.";
    const longText = Array.from({ length: 25 }, () => sentence).join(" ");
    const chunks = splitTextForTts(longText, 450);

    assert.ok(chunks.length >= 4);
    for (const chunk of chunks) {
      assert.ok(chunk.length <= 450);
    }
    const rejoined = chunks.join(" ");
    assert.ok(rejoined.includes("pesquisa na web e imagens por seção"));
  });

  test("combina múltiplos arquivos WAV em um único WAV RIFF válido", () => {
    const wav1 = createFakeWav([1, 2, 3, 4]);
    const wav2 = createFakeWav([5, 6, 7, 8, 9, 10]);

    const merged = mergeWavBuffers([wav1, wav2]);
    assert.equal(merged.toString("ascii", 0, 4), "RIFF");
    assert.equal(merged.toString("ascii", 8, 12), "WAVE");
    assert.equal(merged.toString("ascii", 36, 40), "data");

    const dataSize = merged.readUInt32LE(40);
    const riffSize = merged.readUInt32LE(4);
    assert.equal(dataSize, 10);
    assert.equal(riffSize, 36 + 10);
    assert.deepEqual(
      Array.from(merged.subarray(44)),
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    );
  });

  test("inclui os 8 módulos oficiais de curso e modelos/vozes Google TTS válidos", () => {
    assert.equal(OFFICIAL_COURSE_MODULES.length, 8);
    assert.ok(YOUTUBE_LEAD_PRESETS.length >= 4);
    assert.deepEqual(
      GEMINI_TTS_MODELS.map((m) => m.id),
      ["gemini-3.8-flash-lite-tts", "gemini-3.8-flash-tts"]
    );
    assert.deepEqual(
      GEMINI_TTS_VOICES.map((v) => v.id),
      ["Kore", "Puck", "Charon", "Fenrir", "Zephyr"]
    );
  });

  test("endpoints de roteiro e TTS estão protegidos por requireSupremeAdmin", () => {
    const genRoute = readFileSync(
      path.join(process.cwd(), "app/api/admin/scripts/generate/route.ts"),
      "utf8"
    );
    const ttsRoute = readFileSync(
      path.join(process.cwd(), "app/api/admin/scripts/tts/route.ts"),
      "utf8"
    );

    assert.ok(genRoute.includes("requireSupremeAdmin"));
    assert.ok(ttsRoute.includes("requireSupremeAdmin"));
  });
});
