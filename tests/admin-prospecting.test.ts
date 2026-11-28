import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  computeProspectCounts,
  extractContactPageCandidates,
  extractPublicEmailsFromHtml,
  extractSocialLinksFromHtml,
  isValidPublicContactEmail,
  normalizeProspectIdentity,
  parseGeminiDiscoveryJson,
  type AdminProspectLeadRow,
} from "@/lib/admin-prospecting";

describe("Prospecção Inteligente Artigen (lib/admin-prospecting)", () => {
  test("normaliza domínios padrão e preserva perfis em plataformas multiusuário", () => {
    assert.equal(
      normalizeProspectIdentity("https://www.BlogTech.com.br/artigos/ia"),
      "blogtech.com.br"
    );
    assert.equal(
      normalizeProspectIdentity("https://instagram.com/CriadorBR/reels"),
      "instagram.com/criadorbr"
    );
    assert.equal(
      normalizeProspectIdentity("https://medium.com/@MariaEdita/artigo"),
      "medium.com/@mariaedita"
    );
  });

  test("valida e-mails públicos descartando imagens, placeholders e noreply", () => {
    assert.equal(isValidPublicContactEmail("contato@meublog.com.br"), true);
    assert.equal(isValidPublicContactEmail("redacao@portal.org"), true);
    assert.equal(isValidPublicContactEmail("banner@2x.png"), false);
    assert.equal(isValidPublicContactEmail("noreply@empresa.com.br"), false);
    assert.equal(isValidPublicContactEmail("contato@example.com"), false);
    assert.equal(isValidPublicContactEmail("abc@sentry.io"), false);
  });

  test("extrai e prioriza e-mails comerciais do próprio domínio a partir de HTML", () => {
    const html = `
      <html>
        <body>
          <img src="logo@2x.png" />
          <p>Não envie para noreply@blogexemplo.com.br</p>
          <a href="mailto:parcerias%40blogexemplo.com.br">Parcerias</a>
          <p>Ou fale com joao.silva@gmail.com</p>
          <p>Redação: redacao [at] blogexemplo.com.br</p>
        </body>
      </html>
    `;
    const emails = extractPublicEmailsFromHtml(html, "blogexemplo.com.br");
    assert.equal(emails.includes("parcerias@blogexemplo.com.br"), true);
    assert.equal(emails.includes("redacao@blogexemplo.com.br"), true);
    assert.equal(emails.includes("joao.silva@gmail.com"), true);
    assert.equal(emails.includes("noreply@blogexemplo.com.br"), false);
    assert.equal(emails.some((e) => e.endsWith(".png")), false);
    // E-mails do próprio domínio devem aparecer antes do gmail
    assert.ok(
      emails.indexOf("parcerias@blogexemplo.com.br") <
        emails.indexOf("joao.silva@gmail.com")
    );
  });

  test("extrai redes sociais públicas ignorando botões de compartilhamento", () => {
    const html = `
      <a href="https://www.instagram.com/blogtechbr/">Instagram</a>
      <a href="https://linkedin.com/company/agenciadigital">LinkedIn</a>
      <a href="https://twitter.com/intent/tweet?text=oi">Compartilhar</a>
      <a href="https://www.facebook.com/sharer/sharer.php?u=x">Share</a>
    `;
    const socials = extractSocialLinksFromHtml(html, "https://blogtech.com.br");
    assert.equal(socials.length, 2);
    assert.equal(socials[0].rede, "Instagram");
    assert.equal(socials[0].handle, "@blogtechbr");
    assert.equal(socials[1].rede, "LinkedIn");
  });

  test("seleciona páginas internas de contato e sobre no mesmo domínio", () => {
    const html = `
      <nav>
        <a href="/blog">Blog</a>
        <a href="/fale-conosco">Fale Conosco</a>
        <a href="https://externo.com/contato">Externo</a>
      </nav>
    `;
    const candidates = extractContactPageCandidates(
      html,
      "https://meusite.com.br/"
    );
    assert.equal(
      candidates.includes("https://meusite.com.br/fale-conosco"),
      true
    );
    assert.equal(
      candidates.some((u) => u.includes("externo.com")),
      false
    );
  });

  test("faz parse resiliente do JSON retornado pelo Gemini Discovery", () => {
    const raw = `\`\`\`json
    {
      "candidatos": [
        { "nome": "Portal Tech", "url": "https://portaltech.com.br", "categoria": "blog" }
      ]
    }
    \`\`\``;
    const parsed = parseGeminiDiscoveryJson(raw);
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0].nome, "Portal Tech");
  });

  test("calcula contadores de leads por status corretamente", () => {
    const stub = (status: AdminProspectLeadRow["status"]): AdminProspectLeadRow =>
      ({
        id: Math.random().toString(),
        campaign_id: "c1",
        nome_site: "Site",
        dominio: "site.com",
        url: "https://site.com",
        categoria: "blog",
        descricao_site: "",
        motivo_aderencia: "",
        emails_encontrados: [],
        email_selecionado: null,
        redes_sociais: [],
        assunto_rascunho: "",
        corpo_rascunho: "",
        status,
        erro_detalhe: null,
        thread_id: null,
        resend_email_id: null,
        enviado_em: null,
        enviado_por_email: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }) as AdminProspectLeadRow;

    const counts = computeProspectCounts([
      stub("rascunho_pronto"),
      stub("aprovado"),
      stub("sem_email"),
      stub("enviado"),
      stub("ignorado"),
    ]);
    assert.deepEqual(counts, {
      total: 5,
      prontos: 1,
      aprovados: 1,
      semEmail: 1,
      enviados: 1,
      ignorados: 1,
      erros: 0,
    });
  });
});
