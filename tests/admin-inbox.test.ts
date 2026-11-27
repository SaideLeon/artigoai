import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  buildAdminReplyEmailHtml,
  buildSnippet,
  normalizeEmailSubject,
  parseSenderIdentity,
  sanitizeSandboxedEmailHtml,
  stripHtmlToText,
} from "@/lib/admin-inbox";

describe("Caixa de E-mail Administrativa Artigen (lib/admin-inbox)", () => {
  test("extrai nome e e-mail corretamente em parseSenderIdentity", () => {
    assert.deepEqual(parseSenderIdentity("Maria Silva <Maria@Gmail.com>"), {
      name: "Maria Silva",
      email: "maria@gmail.com",
    });

    assert.deepEqual(parseSenderIdentity('"João Pedro" <joao@empresa.com.br>'), {
      name: "João Pedro",
      email: "joao@empresa.com.br",
    });

    assert.deepEqual(parseSenderIdentity("suporte@artificializar.site"), {
      name: "suporte",
      email: "suporte@artificializar.site",
    });

    assert.deepEqual(parseSenderIdentity(""), {
      name: "Remetente desconhecido",
      email: "",
    });
  });

  test("normaliza assuntos removendo prefixos Re:, Res:, Fwd: e Enc:", () => {
    assert.equal(normalizeEmailSubject("Re: Dúvida sobre plano Pro"), "dúvida sobre plano pro");
    assert.equal(normalizeEmailSubject("Res: Re: Fwd: Enc: Assinatura"), "assinatura");
    assert.equal(normalizeEmailSubject("   "), "(sem assunto)");
  });

  test("converte HTML para texto legível e gera snippet truncado", () => {
    const text = stripHtmlToText(
      "<style>.x{color:red}</style><script>alert(1)</script><p>Olá <strong>Artigen</strong>!</p><p>Preciso de ajuda.</p>"
    );
    assert.equal(text.includes("alert(1)"), false);
    assert.equal(text.includes("color:red"), false);
    assert.equal(text, "Olá Artigen!\nPreciso de ajuda.");

    const longBody = "A".repeat(180);
    const snippet = buildSnippet(longBody);
    assert.equal(snippet.length, 138);
    assert.equal(snippet.endsWith("…"), true);
  });

  test("escapa HTML e XSS ao montar respostas enviadas pelo administrador", () => {
    const html = buildAdminReplyEmailHtml({
      bodyText: 'Olá! Segue <script>alert("xss")</script> resposta.',
      quotedText: '<img src=x onerror="alert(1)"> Mensagem original',
      quotedAuthor: 'Cliente <evil@x.com>',
    });

    assert.equal(html.includes("<script>"), false);
    assert.equal(html.includes("&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;"), true);
    assert.equal(html.includes("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;"), true);
  });

  test("sanitiza HTML recebido antes de renderizar em iframe isolado", () => {
    const dirty =
      '<div onclick="steal()">Oi</div><script>bad()</script><iframe src="https://evil.test"></iframe><a href="javascript:alert(1)">Clique</a>';
    const clean = sanitizeSandboxedEmailHtml(dirty);

    assert.equal(clean.includes("<script"), false);
    assert.equal(clean.includes("<iframe"), false);
    assert.equal(clean.includes("onclick"), false);
    assert.equal(clean.includes("javascript:"), false);
    assert.equal(clean.includes('href="#"'), true);
  });
});
