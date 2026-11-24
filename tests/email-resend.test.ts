import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  DEFAULT_EMAIL_FROM,
  VERIFIED_EMAIL_DOMAIN,
  escapeHtml,
  getEmailServiceSummary,
  isValidEmailAddress,
  resolveEmailFrom,
  sanitizeHeaderField,
  sendTransactionalEmail,
} from "@/lib/email";

describe("Serviço de E-mail Resend (domínio artificializar.site)", () => {
  test("usa Artigen <contato@artificializar.site> como remetente padrão quando EMAIL_FROM não está definido", () => {
    assert.equal(VERIFIED_EMAIL_DOMAIN, "artificializar.site");
    assert.equal(resolveEmailFrom(undefined), DEFAULT_EMAIL_FROM);
    assert.equal(resolveEmailFrom("   "), DEFAULT_EMAIL_FROM);
    assert.equal(
      resolveEmailFrom("Artigen <suporte@artificializar.site>\r\n"),
      "Artigen <suporte@artificializar.site>"
    );
  });

  test("valida endereços de e-mail e remove quebras de linha em cabeçalhos", () => {
    assert.equal(isValidEmailAddress("contato@artificializar.site"), true);
    assert.equal(isValidEmailAddress("user+tag@exemplo.com.br"), true);
    assert.equal(isValidEmailAddress("invalido@"), false);
    assert.equal(
      isValidEmailAddress("teste@dominio.com\r\nBcc:evil@x.com"),
      false
    );
    assert.equal(
      sanitizeHeaderField("Assunto\r\nBcc: outro@teste.com"),
      "Assunto Bcc: outro@teste.com"
    );
  });

  test("escapa HTML perigoso antes de montar o corpo dos e-mails", () => {
    const escaped = escapeHtml('<script>alert("xss")</script> & \'teste\'');
    assert.equal(
      escaped,
      "&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt; &amp; &#39;teste&#39;"
    );
  });

  test("retorna fallback seguro sem lançar erro quando RESEND_API_KEY está ausente", async () => {
    const prevKey = process.env.RESEND_API_KEY;
    delete process.env.RESEND_API_KEY;
    try {
      const summary = getEmailServiceSummary();
      assert.equal(summary.domain, "artificializar.site");
      assert.equal(summary.configured, false);

      const res = await sendTransactionalEmail({
        to: ["destinatario@artificializar.site"],
        subject: "Teste sem chave",
        html: "<p>Teste</p>",
        text: "Teste",
      });
      assert.equal(res.sent, false);
      assert.equal(res.provider, "unconfigured");
    } finally {
      if (prevKey !== undefined) process.env.RESEND_API_KEY = prevKey;
    }
  });
});
