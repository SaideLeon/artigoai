import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import { ESTILOS_IMAGEM, FAIXAS_PALAVRAS, IDIOMAS, TONS_TEXTO } from "@/lib/types";
import {
  FREE_PLAN,
  MAX_IMAGES_PER_ARTICLE,
  SUBSCRIPTION_PLANS,
} from "@/lib/pricing";
import {
  GARANTIA_DIAS,
  PLAN_COMMISSION_RATES,
  SAQUE_MINIMO_CENTAVOS,
} from "@/lib/partners";

describe("llms.txt e LLM.txt documentação completa do sistema", () => {
  const llmsPath = path.join(process.cwd(), "public", "llms.txt");
  const content = readFileSync(llmsPath, "utf8");

  test("arquivo existe, é detalhado e não contém referências desatualizadas", () => {
    assert.equal(existsSync(llmsPath), true);
    assert.ok(content.length > 8000);
    assert.doesNotMatch(content, /Stripe/i);
    assert.doesNotMatch(content, /gemini-2\.5/i);
  });

  test("documenta corretamente planos, preços em BRL via Cakto e limites atuais", () => {
    assert.ok(content.includes("Cakto"));
    assert.ok(content.includes(`${FREE_PLAN.artigosMes}`));
    assert.ok(content.includes(`${FREE_PLAN.imagensMes}`));
    assert.ok(content.includes(`${MAX_IMAGES_PER_ARTICLE}`));

    for (const plan of SUBSCRIPTION_PLANS) {
      assert.ok(content.includes(plan.nome));
      assert.ok(content.includes(`${plan.artigosMes}`));
      assert.ok(content.includes(`${plan.imagensMes}`));
    }
  });

  test("documenta modelos atuais de IA (Gemini série 3 gratuito, NVIDIA FLUX.3 Klein e Groq Whisper)", () => {
    assert.ok(content.includes("gemini-3.5-flash-lite"));
    assert.ok(content.includes("gemini-3.1-flash-lite"));
    assert.ok(content.includes("gemini-3.5-flash"));
    assert.ok(content.includes("black-forest-labs/flux-3-image-klein"));
    assert.ok(content.includes("Groq Whisper"));
    assert.ok(content.includes("Resend"));
  });

  test("documenta todos os tons, idiomas, faixas de palavras e os 6 estilos de imagem", () => {
    for (const ton of TONS_TEXTO) {
      assert.ok(content.includes(ton));
    }
    for (const idioma of IDIOMAS) {
      assert.ok(content.includes(idioma.label));
    }
    for (const faixa of FAIXAS_PALAVRAS) {
      assert.ok(content.includes(faixa.id));
    }
    for (const estilo of ESTILOS_IMAGEM) {
      assert.ok(content.includes(estilo.id));
      assert.ok(content.includes(estilo.label));
    }
  });

  test("documenta funcionalidades chave do estúdio, parceiros e administração", () => {
    assert.ok(content.includes("Mulébi"));
    assert.ok(content.includes("VoiceNarrationModal"));
    assert.ok(content.includes("Fonte Primária"));
    assert.ok(content.includes("Prévia"));
    assert.ok(content.includes("Editor"));
    assert.ok(content.includes("SEO"));
    assert.ok(content.includes("Baixar HTML"));
    assert.ok(content.includes(`${PLAN_COMMISSION_RATES.starter}%`));
    assert.ok(content.includes(`${PLAN_COMMISSION_RATES.pro}%`));
    assert.ok(content.includes(`${GARANTIA_DIAS} dias`));
    assert.ok(
      content.includes(
        `R$ ${(SAQUE_MINIMO_CENTAVOS / 100).toFixed(2).replace(".", ",")}`
      )
    );
    assert.ok(content.includes("/admin/prospeccao"));
    assert.ok(content.includes("Convite por Print"));
    assert.ok(content.includes("/parceiro/convite/[token]"));
    assert.ok(content.includes("/LLM.txt"));
  });
});
