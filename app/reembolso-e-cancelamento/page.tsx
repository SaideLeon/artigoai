import type { Metadata } from "next";
import Link from "next/link";
import LegalPageLayout, {
  type LegalSectionAnchor,
} from "@/components/LegalPageLayout";
import { SITE_NAME, SITE_URL } from "@/lib/seo";

const PAGE_PATH = "/reembolso-e-cancelamento";
const PAGE_TITLE = "Política de Cancelamento e Reembolso";
const PAGE_DESCRIPTION =
  "Regras claras sobre cancelamento de assinaturas Cakto, direito de arrependimento em 7 dias (CDC) e prazos de estorno via Pix, Cartão ou Boleto.";

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
  { id: "arrependimento", title: "1. Direito de arrependimento (7 dias)" },
  { id: "cancelamento", title: "2. Como cancelar sua assinatura" },
  { id: "prazos-estorno", title: "3. Prazos de estorno (Pix, Cartão e Boleto)" },
  { id: "cotas-mensais", title: "4. Renovação e uso de cotas" },
  { id: "suporte-cobranca", title: "5. Suporte para cobranças" },
];

export default function ReembolsoECancelamentoPage() {
  return (
    <LegalPageLayout
      currentPath={PAGE_PATH}
      badge="Direitos do Consumidor"
      title={PAGE_TITLE}
      subtitle={PAGE_DESCRIPTION}
      lastUpdated="22 de novembro de 2026"
      sections={SECTIONS}
    >
      <section id="arrependimento" className="scroll-mt-24 space-y-3">
        <h2 className="text-xl font-bold text-slate-950 dark:text-white">
          1. Direito de arrependimento (7 dias — Art. 49 do CDC)
        </h2>
        <p>
          Em estrito cumprimento ao artigo 49 do{" "}
          <strong>Código de Defesa do Consumidor (Lei nº 8.078/1990)</strong>,
          você pode solicitar o cancelamento e o reembolso integral de qualquer
          primeira assinatura contratada no Artigen em até{" "}
          <strong>7 (sete) dias corridos</strong> a contar da data da aprovação
          do pagamento.
        </p>
      </section>

      <section id="cancelamento" className="scroll-mt-24 space-y-3">
        <h2 className="text-xl font-bold text-slate-950 dark:text-white">
          2. Como cancelar sua assinatura a qualquer momento
        </h2>
        <p>
          Não há fidelidade nem multa de cancelamento. Você pode interromper a
          renovação automática da sua assinatura a qualquer instante por dois
          caminhos:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Portal do Assinante Cakto:</strong> acesse{" "}
            <a
              href="https://assinatura.cakto.com.br/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-indigo-600 underline underline-offset-2 dark:text-indigo-400"
            >
              assinatura.cakto.com.br
            </a>{" "}
            com o mesmo e-mail utilizado na compra para gerenciar métodos de
            pagamento, consultar faturas ou cancelar sua assinatura.
          </li>
          <li>
            <strong>Diretamente pelo Estúdio:</strong> dentro de{" "}
            <Link
              href="/studio"
              className="font-semibold text-indigo-600 underline underline-offset-2 dark:text-indigo-400"
            >
              /studio
            </Link>
            , abra o painel <strong>Ver Planos</strong> e clique em{" "}
            <strong>Portal do Assinante</strong>.
          </li>
        </ul>
        <p>
          Após o cancelamento fora do prazo de reembolso, não haverá novas
          cobranças nos ciclos seguintes e sua conta retorna automaticamente ao{" "}
          <strong>Plano Grátis</strong> ao término do período vigente ou
          imediatamente após o processamento do estorno.
        </p>
      </section>

      <section id="prazos-estorno" className="scroll-mt-24 space-y-3">
        <h2 className="text-xl font-bold text-slate-950 dark:text-white">
          3. Prazos de estorno conforme meio de pagamento
        </h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Pix:</strong> após a aprovação do reembolso na Cakto, a
            devolução é enviada para a conta bancária de origem geralmente em
            poucos minutos ou em até 1 dia útil.
          </li>
          <li>
            <strong>Cartão de Crédito:</strong> o cancelamento da cobrança é
            comunicado à operadora do cartão, aparecendo como crédito na fatura
            atual ou nas 1 a 2 faturas subsequentes, conforme a data de
            fechamento do banco emissor.
          </li>
          <li>
            <strong>Boleto Bancário:</strong> o reembolso é transferido para
            conta bancária de mesma titularidade (CPF/CNPJ do comprador) em até
            5 dias úteis após confirmação dos dados na Cakto.
          </li>
        </ul>
      </section>

      <section id="cotas-mensais" className="scroll-mt-24 space-y-3">
        <h2 className="text-xl font-bold text-slate-950 dark:text-white">
          4. Renovação e uso de cotas
        </h2>
        <p>
          As cotas mensais (14 artigos e 98 imagens no Starter, 33 artigos e 231
          imagens no Pro, e 48 artigos e 336 imagens na Agência, com limite de 7
          imagens incluídas por artigo) são disponibilizadas por ciclo de 30 dias
          e não acumulam para o mês subsequente. Os artigos já salvos na sua
          biblioteca e exportados permanecem acessíveis mesmo se você voltar ao
          Plano Grátis.
        </p>
      </section>

      <section id="suporte-cobranca" className="scroll-mt-24 space-y-3">
        <h2 className="text-xl font-bold text-slate-950 dark:text-white">
          5. Suporte para cobranças e divergências
        </h2>
        <p>
          Caso perceba qualquer cobrança duplicada, atraso na compensação do Pix
          ou dificuldade para solicitar reembolso dentro dos 7 dias legais,
          escreva para{" "}
          <a
            href="mailto:contato@artificializar.site"
            className="font-semibold text-indigo-600 underline underline-offset-2 dark:text-indigo-400"
          >
            contato@artificializar.site
          </a>{" "}
          ou utilize o{" "}
          <Link
            href="/#contato"
            className="font-semibold text-indigo-600 underline underline-offset-2 dark:text-indigo-400"
          >
            formulário de contato
          </Link>{" "}
          informando o e-mail da compra e o código do pedido Cakto.
        </p>
      </section>
    </LegalPageLayout>
  );
}
