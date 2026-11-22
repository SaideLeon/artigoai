import type { Metadata } from "next";
import Link from "next/link";
import LegalPageLayout, {
  type LegalSectionAnchor,
} from "@/components/LegalPageLayout";
import { SITE_NAME, SITE_URL } from "@/lib/seo";

const PAGE_PATH = "/termos-de-uso";
const PAGE_TITLE = "Termos de Uso e Condições de Serviço";
const PAGE_DESCRIPTION =
  "Conheça as regras de utilização, propriedade intelectual, assinaturas via Cakto (Pix e Cartão) e responsabilidades no gerador de artigos Artigen.";

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
  { id: "aceitacao", title: "1. Aceitação e elegibilidade" },
  { id: "servicos", title: "2. Descrição dos serviços" },
  { id: "conta", title: "3. Conta e segurança de acesso" },
  { id: "propriedade", title: "4. Propriedade intelectual e autoria" },
  { id: "uso-aceitavel", title: "5. Regras de uso aceitável" },
  { id: "pagamentos", title: "6. Planos, assinaturas e pagamentos" },
  { id: "responsabilidade", title: "7. Limitação de responsabilidade" },
  { id: "foro", title: "8. Alterações e legislação aplicável" },
];

export default function TermosDeUsoPage() {
  return (
    <LegalPageLayout
      currentPath={PAGE_PATH}
      badge="Documento Legal"
      title={PAGE_TITLE}
      subtitle={PAGE_DESCRIPTION}
      lastUpdated="22 de novembro de 2026"
      sections={SECTIONS}
    >
      <section id="aceitacao" className="scroll-mt-24 space-y-3">
        <h2 className="text-xl font-bold text-slate-950 dark:text-white">
          1. Aceitação e elegibilidade
        </h2>
        <p>
          Ao acessar ou utilizar a plataforma <strong>Artigen</strong> (
          <code>criador.artificializar.site</code>), incluindo a página inicial,
          o estúdio de criação (<code>/studio</code>), a narração por voz com o
          mascote <strong>Mulébi</strong> e os recursos de pesquisa e
          exportação, você concorda integralmente com estes Termos de Uso e com a
          nossa{" "}
          <Link
            href="/privacidade"
            className="font-semibold text-indigo-600 underline underline-offset-2 dark:text-indigo-400"
          >
            Política de Privacidade
          </Link>
          .
        </p>
        <p>
          O uso da plataforma é destinado a pessoas com idade igual ou superior
          a 18 anos ou legalmente capazes nos termos da legislação civil
          brasileira. Caso utilize o serviço em nome de uma empresa ou agência,
          você declara possuir poderes para vinculá-la a este instrumento.
        </p>
      </section>

      <section id="servicos" className="scroll-mt-24 space-y-3">
        <h2 className="text-xl font-bold text-slate-950 dark:text-white">
          2. Descrição dos serviços
        </h2>
        <p>
          O Artigen oferece ferramentas editoriais assistidas por Inteligência
          Artificial para estruturar esboços, realizar pesquisa web em tempo
          real com citação de fontes primárias e secundárias, transcrever
          narrações por voz, redigir seções de blog, gerar imagens editoriais e
          exportar artigos completos em HTML limpo.
        </p>
        <p>
          Os recursos gratuitos e pagos possuem limites mensais distintos de
          geração e modelos de IA específicos, conforme detalhado na tabela de
          planos da plataforma.
        </p>
      </section>

      <section id="conta" className="scroll-mt-24 space-y-3">
        <h2 className="text-xl font-bold text-slate-950 dark:text-white">
          3. Conta e segurança de acesso
        </h2>
        <p>
          A autenticação na nuvem é realizada exclusivamente via{" "}
          <strong>Google OAuth</strong> (gerenciada pelo Supabase Auth), não
          exigindo criação ou armazenamento de senhas diretamente nos servidores
          do Artigen. Você é responsável por manter a segurança da sua conta
          Google e por toda atividade executada em seu perfil.
        </p>
      </section>

      <section id="propriedade" className="scroll-mt-24 space-y-3">
        <h2 className="text-xl font-bold text-slate-950 dark:text-white">
          4. Propriedade intelectual e autoria
        </h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Seu conteúdo:</strong> você mantém integralmente os direitos
            sobre suas ideias, narrações de áudio, textos originais, links de
            fontes primárias fornecidos e sobre os artigos finais gerados e
            exportados a partir do seu estúdio, podendo publicá-los em blogs
            pessoais, portais comerciais ou projetos de clientes.
          </li>
          <li>
            <strong>Plataforma e marca Artigen:</strong> o código-fonte,
            interface, logótipo, design, documentação e o mascote{" "}
            <strong>Mulébi</strong> são de propriedade exclusiva do Artigen e
            estão protegidos pelas leis de propriedade intelectual aplicáveis.
          </li>
        </ul>
      </section>

      <section id="uso-aceitavel" className="scroll-mt-24 space-y-3">
        <h2 className="text-xl font-bold text-slate-950 dark:text-white">
          5. Regras de uso aceitável
        </h2>
        <p>Não é permitido utilizar o Artigen para:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Produzir ou distribuir desinformação deliberada, discurso de ódio,
            difamação, conteúdo ilegal ou que viole direitos autorais de
            terceiros.
          </li>
          <li>
            Realizar engenharia reversa, raspagem abusiva das APIs, contornar
            cotas de uso mensal ou automatizar acessos maliciosos que
            comprometam a estabilidade do serviço.
          </li>
          <li>
            Compartilhar credenciais de sessão ou revender cotas individuais de
            forma não autorizada.
          </li>
        </ul>
      </section>

      <section id="pagamentos" className="scroll-mt-24 space-y-3">
        <h2 className="text-xl font-bold text-slate-950 dark:text-white">
          6. Planos, assinaturas e pagamentos
        </h2>
        <p>
          As assinaturas pagas (Starter, Pro e Agência, em ciclos mensais ou
          anuais) são cobradas em Real brasileiro (R$) por meio da processadora{" "}
          <strong>Cakto</strong>, aceitando <strong>Pix</strong>,{" "}
          <strong>Cartão de Crédito</strong> e <strong>Boleto</strong>.
        </p>
        <p>
          As cotas mensais de artigos são renovadas a cada ciclo de cobrança e{" "}
          <strong>não acumulam</strong> para o mês seguinte. Regras de
          cancelamento e direito de arrependimento (7 dias) estão detalhadas em
          nossa{" "}
          <Link
            href="/reembolso-e-cancelamento"
            className="font-semibold text-indigo-600 underline underline-offset-2 dark:text-indigo-400"
          >
            Política de Reembolso e Cancelamento
          </Link>
          .
        </p>
      </section>

      <section id="responsabilidade" className="scroll-mt-24 space-y-3">
        <h2 className="text-xl font-bold text-slate-950 dark:text-white">
          7. Limitação de responsabilidade
        </h2>
        <p>
          Embora o Artigen priorize fontes primárias fornecidas pelo usuário e
          consultas web em tempo real, ferramentas baseadas em Inteligência
          Artificial podem gerar imprecisões pontuais. Cabe ao autor ou editor
          revisar dados factuais, estatísticas e citações antes da publicação
          definitiva, especialmente em temas médicos, jurídicos ou financeiros.
        </p>
      </section>

      <section id="foro" className="scroll-mt-24 space-y-3">
        <h2 className="text-xl font-bold text-slate-950 dark:text-white">
          8. Alterações e legislação aplicável
        </h2>
        <p>
          Podemos atualizar estes Termos de Uso periodicamente para refletir
          melhorias técnicas ou requisitos legais, informando a nova data de
          revisão no topo desta página. Este instrumento é regido pelas leis da{" "}
          <strong>República Federativa do Brasil</strong>, em conformidade com o
          Marco Civil da Internet (Lei nº 12.965/2014), o Código de Defesa do
          Consumidor e a LGPD.
        </p>
      </section>
    </LegalPageLayout>
  );
}
