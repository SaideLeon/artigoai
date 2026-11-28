import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  GEMINI_RESEARCH_FALLBACK_MODEL,
  GEMINI_RESEARCH_MODEL,
  GEMINI_TEXT_FALLBACK_MODEL,
  GEMINI_TEXT_MODEL,
  NVIDIA_IMAGE_MODEL,
  NVIDIA_IMAGE_STEPS,
  NVIDIA_IMAGE_URL,
  generateArticleText,
  stripReasoningTags,
} from "@/lib/ai-providers";

describe("Provedores de IA — Gemini Gratuito (Texto + Busca Web) e NVIDIA FLUX.3 Klein (Imagem)", () => {
  test("usa modelos Gemini gratuitos para texto sem usar modelos pagos da série 4", () => {
    assert.equal(GEMINI_TEXT_MODEL, "gemini-3.1-flash-lite");
    assert.equal(GEMINI_TEXT_FALLBACK_MODEL, "gemini-2.5-flash");
    assert.equal(GEMINI_TEXT_MODEL.includes("gemini-4"), false);
    assert.equal(GEMINI_TEXT_FALLBACK_MODEL.includes("gemini-4"), false);
  });

  test("usa modelos Gemini gratuitos (2.5 Flash / 2.5 Flash-Lite) para pesquisa na web", () => {
    assert.equal(GEMINI_RESEARCH_MODEL, "gemini-2.5-flash");
    assert.equal(GEMINI_RESEARCH_FALLBACK_MODEL, "gemini-2.5-flash-lite");
    assert.equal(GEMINI_RESEARCH_MODEL.includes("gemini-4"), false);
    assert.equal(GEMINI_RESEARCH_FALLBACK_MODEL.includes("gemini-4"), false);
  });

  test("configura NVIDIA FLUX.3 Klein para geração de imagens", () => {
    assert.equal(
      NVIDIA_IMAGE_URL,
      "https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux-3-image-klein"
    );
    assert.equal(NVIDIA_IMAGE_MODEL, "black-forest-labs/flux-3-image-klein");
    assert.equal(NVIDIA_IMAGE_STEPS, 50);
  });

  test("remove tags <think> do texto gerado quando presentes", () => {
    const cleaned = stripReasoningTags(
      '<think>Raciocínio interno aqui</think>\n{"titulo": "Artigo Teste", "secoes": []}'
    );
    assert.equal(cleaned, '{"titulo": "Artigo Teste", "secoes": []}');
  });

  test("retorna erro claro quando GEMINI_API_KEY não está definida", async () => {
    const prevKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    try {
      await assert.rejects(
        () => generateArticleText("Olá"),
        /GEMINI_API_KEY/
      );
    } finally {
      if (prevKey !== undefined) process.env.GEMINI_API_KEY = prevKey;
    }
  });
});
