import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  DEFAULT_ESTILO_IMAGEM,
  ESTILOS_IMAGEM,
  getEstiloImagemConfig,
  isValidEstiloImagemId,
} from "@/lib/types";

describe("Estilos de Design de Imagem para Artigos", () => {
  test("inclui padrão editorial, fotografia realista e estilos variados", () => {
    const ids = ESTILOS_IMAGEM.map((s) => s.id);
    assert.equal(DEFAULT_ESTILO_IMAGEM, "editorial-flat");
    assert.deepEqual(ids, [
      "editorial-flat",
      "fotografia-realista",
      "realismo-cinematografico",
      "render-3d-moderno",
      "aquarela-editorial",
      "minimalista-geometrico",
    ]);

    for (const style of ESTILOS_IMAGEM) {
      assert.ok(style.label.trim().length > 0);
      assert.ok(style.descricao.trim().length > 0);
      assert.equal(style.swatches.length, 3);
      assert.ok(style.promptPrefix.toLowerCase().includes("no text"));
      assert.ok(style.promptPrefix.toLowerCase().includes("no watermarks"));
      assert.ok(style.sectionHint.trim().length > 10);
    }
  });

  test("valida IDs de estilo de imagem corretamente", () => {
    assert.equal(isValidEstiloImagemId("editorial-flat"), true);
    assert.equal(isValidEstiloImagemId("fotografia-realista"), true);
    assert.equal(isValidEstiloImagemId("render-3d-moderno"), true);
    assert.equal(isValidEstiloImagemId("estilo-inexistente"), false);
    assert.equal(isValidEstiloImagemId(null), false);
    assert.equal(isValidEstiloImagemId(123), false);
  });

  test("retorna estilo solicitado ou fallback para o padrão", () => {
    const realistic = getEstiloImagemConfig("fotografia-realista");
    assert.equal(realistic.id, "fotografia-realista");
    assert.ok(realistic.promptPrefix.toLowerCase().includes("photorealistic"));

    const fallbackUnknown = getEstiloImagemConfig("desconhecido");
    assert.equal(fallbackUnknown.id, DEFAULT_ESTILO_IMAGEM);

    const fallbackUndefined = getEstiloImagemConfig(undefined);
    assert.equal(fallbackUndefined.id, DEFAULT_ESTILO_IMAGEM);
  });
});
