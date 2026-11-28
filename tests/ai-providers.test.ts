import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  GEMINI_RESEARCH_CANDIDATE_MODELS,
  GEMINI_RESEARCH_FALLBACK_MODEL,
  GEMINI_RESEARCH_MODEL,
  GEMINI_TEXT_CANDIDATE_MODELS,
  GEMINI_TEXT_FALLBACK_MODEL,
  GEMINI_TEXT_MODEL,
  NVIDIA_IMAGE_MODEL,
  NVIDIA_IMAGE_STEPS,
  NVIDIA_IMAGE_URL,
  formatGeminiError,
  generateArticleText,
  stripReasoningTags,
} from "@/lib/ai-providers";

describe("Provedores de IA — Gemini Gratuito (Texto + Busca Web) e NVIDIA FLUX.3 Klein (Imagem)", () => {
  test("usa modelos Gemini 3.5/3.1 gratuitos para texto sem usar modelos 2.5 descontinuados ou série 4 paga", () => {
    assert.equal(GEMINI_TEXT_MODEL, "gemini-3.5-flash-lite");
    assert.equal(GEMINI_TEXT_FALLBACK_MODEL, "gemini-3.1-flash-lite");
    assert.deepEqual(GEMINI_TEXT_CANDIDATE_MODELS, [
      "gemini-3.5-flash-lite",
      "gemini-3.1-flash-lite",
      "gemini-3.5-flash",
    ]);
    for (const model of GEMINI_TEXT_CANDIDATE_MODELS) {
      assert.equal(model.includes("gemini-4"), false);
      assert.equal(model.includes("gemini-2.5"), false);
    }
  });

  test("usa modelos Gemini 3.5/3.1 gratuitos para pesquisa na web sem modelos 2.5 ou série 4", () => {
    assert.equal(GEMINI_RESEARCH_MODEL, "gemini-3.5-flash-lite");
    assert.equal(GEMINI_RESEARCH_FALLBACK_MODEL, "gemini-3.5-flash");
    assert.deepEqual(GEMINI_RESEARCH_CANDIDATE_MODELS, [
      "gemini-3.5-flash-lite",
      "gemini-3.5-flash",
      "gemini-3.1-flash-lite",
    ]);
    for (const model of GEMINI_RESEARCH_CANDIDATE_MODELS) {
      assert.equal(model.includes("gemini-4"), false);
      assert.equal(model.includes("gemini-2.5"), false);
    }
  });

  test("formata erros JSON 404 da API Gemini em mensagem legível em português", () => {
    const rawJsonError = JSON.stringify({
      error: {
        code: 404,
        message:
          "This model models/gemini-2.5-flash-lite is no longer available to new users. Please update your code to use models/gemini-3.5-flash-lite.",
        status: "NOT_FOUND",
      },
    });
    const formatted = formatGeminiError(new Error(rawJsonError));
    assert.equal(formatted.message.startsWith("Modelo Gemini indisponível"), true);
    assert.equal(formatted.message.includes('{"error"'), false);
    assert.equal(formatted.message.includes("gemini-3.5-flash-lite"), true);
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
