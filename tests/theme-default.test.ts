import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { DEFAULT_THEME, resolveDefaultTheme } from "@/components/ThemeProvider";

describe("Tema Padrão do Artigen", () => {
  test("mantém modo claro (light) ativo por padrão sem preferência prévia", () => {
    assert.equal(DEFAULT_THEME, "light");
    assert.equal(resolveDefaultTheme(undefined), "light");
    assert.equal(resolveDefaultTheme(null), "light");
    assert.equal(resolveDefaultTheme("invalid"), "light");
  });

  test("respeita preferência explícita salva pelo usuário", () => {
    assert.equal(resolveDefaultTheme("dark"), "dark");
    assert.equal(resolveDefaultTheme("light"), "light");
  });
});
