import type { Metadata } from "next";
import Link from "next/link";
import LegalPageLayout, {
  type LegalSectionAnchor,
} from "@/components/LegalPageLayout";
import { SITE_NAME, SITE_URL } from "@/lib/seo";

const PAGE_PATH = "/sobre";
const PAGE_TITLE = "Sobre o Artigen e Transparência Editorial";
const PAGE_DESCRIPTION =
  "Conheça a missão do Artigen, nossa abordagem editorial que prioriza voz humana e fontes primárias, e os padrões de transparência da plataforma.";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: PAGE_PATH },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: `${SITE_URL}${PAGE_PATH}`,
    siteName: SITE_NAME,
    title: `${PAGE_TITLE} — ${SITE_NAME}`,
    description: PAGE_DESCRIPTION,
  },
  twitter: {
    card: "summary",
    title: `${PAGE_TITLE} — ${SITE_NAME}`,
    description: PAGE_DESCRIPTION,
  },
};

const SECTIONS: LegalSectionAnchor[] = [
  { id: "quem-somos", title: "1. Nossa missão editorial" },
  { id: "autoria-humana", title: "2. Prioridade ao trabalho humano" },
  { id: "fluxo-ia", title: "3. Como o Mulébi e a IA operam" },
  { id: "modelo-negocio", title: "4. Transparência comercial" },
  { id: "canais", title: "5. Canais oficiais e confiança" },
];

export default function SobrePage() {
  return (
    <LegalPageLayout
      currentPath={PAGE_PATH}
      badge="Institucional & E-E-A-T"
      title={PAGE_TITLE}
      subtitle={PAGE_DESCRIPTION}
      lastUpdated="22 de novembro de 2026"
      sections={SECTIONS}
    >
      <section id="quem-somos" className="scroll-mt-24 space-y-3">
        <h2 className="text-xl font-bold text-slate-950 dark:text-white">
          1. Nossa missão editorial
        </h2>
        <p>
          O <strong>Artigen</strong> (<code>criador.artificializar.site</code>)
          nasceu para resolver um desafio comum de autores, blogueiros e equipes
          de conteúdo: transformar ideias vividas, experiências reais e fontes
          confiáveis em artigos completos, bem estruturados e prontos para a
          web, sem perder a identidade de quem escreve.
        </p>
      </section>

      <section id="autoria-humana" className="scroll-mt-24 space-y-3">
        <h2 className="text-xl font-bold text-slate-950 dark:text-white">
          2. Prioridade absoluta ao trabalho humano e fontes primárias
        </h2>
        <p>
          Diferentemente de geradores genéricos que produzem textos rasos a
          partir de uma única palavra-chave, o fluxo editorial do Artigen foi
          projetado para valorizar a contribuição humana:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Narração por voz com o mascote Mulébi:</strong> você explica
            a história ou o tema falando naturalmente com suas próprias palavras,
            e a plataforma organiza o raciocínio preservando sua perspectiva.
          </li>
          <li>
            <strong>Fontes primárias do usuário em 1º lugar:</strong> quando
            você fornece links originais, estudos próprios ou reportagens de
            referência, o sistema extrai e prioriza esses conteúdos como{" "}
            <strong>fonte primária</strong>, utilizando buscas complementares na
            web apenas como fontes secundárias de apoio e checagem factual.
          </li>
          <li>
            <strong>Rastreabilidade clara:</strong> no estúdio de edição, o
            indicador de fontes mostra exatamente quantas fontes primárias e
            secundárias sustentam cada artigo gerado.
          </li>
        </ul>
      </section>

      <section id="fluxo-ia" className="scroll-mt-24 space-y-3">
        <h2 className="text-xl font-bold text-slate-950 dark:text-white">
          3. Transparência sobre Inteligência Artificial
        </h2>
        <p>
          Todo artigo produzido no Artigen pode ser editado seção por seção em
          tempo real antes da exportação em HTML limpo. Os modelos de IA atuam
          como assistentes de estruturação, pesquisa web e ilustração editorial,
          mantendo o usuário como responsável e titular final da publicação.
        </p>
      </section>

      <section id="modelo-negocio" className="scroll-mt-24 space-y-3">
        <h2 className="text-xl font-bold text-slate-950 dark:text-white">
          4. Transparência comercial e pagamentos
        </h2>
        <p>
          Operamos com um plano <strong>Grátis</strong> sem exigência de cartão
          e três planos de assinatura mensal ou anual em Real (R$) — Starter,
          Pro e Agência — com pagamentos processados pela <strong>Cakto</strong>{" "}
          via Pix, Cartão de Crédito ou Boleto, com política clara de
          cancelamento e garantia legal de 7 dias.
        </p>
      </section>

      <section id="canais" className="scroll-mt-24 space-y-3">
        <h2 className="text-xl font-bold text-slate-950 dark:text-white">
          5. Canais oficiais e documentação legal
        </h2>
        <p>
          Para atendimento comercial, suporte técnico ou solicitações legais,
          utilize nosso{" "}
          <Link
            href="/#contato"
            className="font-semibold text-indigo-600 underline underline-offset-2 dark:text-indigo-400"
          >
            formulário oficial de contato
          </Link>{" "}
          ou o e-mail{" "}
          <a
            href="mailto:contato@artificializar.site"
            className="font-semibold text-indigo-600 underline underline-offset-2 dark:text-indigo-400"
          >
            contato@artificializar.site
          </a>
          . Você também pode acessar diretamente os nossos{" "}
          <Link
            href="/termos-de-uso"
            className="font-semibold text-indigo-600 underline underline-offset-2 dark:text-indigo-400"
          >
            Termos de Uso
          </Link>
          ,{" "}
          <Link
            href="/privacidade"
            className="font-semibold text-indigo-600 underline underline-offset-2 dark:text-indigo-400"
          >
            Política de Privacidade
          </Link>{" "}
          e{" "}
          <Link
            href="/reembolso-e-cancelamento"
            className="font-semibold text-indigo-600 underline underline-offset-2 dark:text-indigo-400"
          >
            Política de Reembolso
          </Link>
          .
        </p>
      </section>
    </LegalPageLayout>
  );
}
