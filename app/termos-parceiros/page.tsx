import type { Metadata } from "next";
import Link from "next/link";
import LegalPageLayout, {
  type LegalSectionAnchor,
} from "@/components/LegalPageLayout";
import { SITE_NAME, SITE_URL } from "@/lib/seo";

const PAGE_PATH = "/termos-parceiros";
const PAGE_TITLE = "Termos do Programa de Parceiros";
const PAGE_DESCRIPTION =
  "Regras de elegibilidade, atribuição por link de indicação (60 dias), cálculo de comissões recorrentes, estornos e conduta no Programa de Parceiros Artigen.";

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
  { id: "adesao", title: "1. Adesão por convite" },
  { id: "rastreio", title: "2. Link, cookie de 60 dias e atribuição" },
  { id: "comissoes", title: "3. Cálculo de comissões e estornos" },
  { id: "conduta", title: "4. Boas práticas e proibições" },
  { id: "desativacao", title: "5. Suspensão e alterações" },
];

export default function TermosParceirosPage() {
  return (
    <LegalPageLayout
      currentPath={PAGE_PATH}
      badge="Parcerias e Afiliação"
      title={PAGE_TITLE}
      subtitle={PAGE_DESCRIPTION}
      lastUpdated="23 de novembro de 2026"
      sections={SECTIONS}
    >
      <section id="adesao" className="scroll-mt-24 space-y-3">
        <h2 className="text-xl font-bold text-slate-950 dark:text-white">
          1. Adesão por convite
        </h2>
        <p>
          O Programa de Parceiros do <strong>Artigen</strong> funciona
          mediante convite exclusivo de uso único emitido pela administração. Ao
          aceitar o convite autenticado em sua conta, você recebe um perfil de
          parceiro com o percentual de comissão definido para o seu acordo e um
          código único de divulgação, podendo personalizá-lo uma única vez no{" "}
          <Link
            href="/parceiro"
            className="font-semibold text-indigo-600 underline underline-offset-2 dark:text-indigo-400"
          >
            Painel do Parceiro
          </Link>
          .
        </p>
      </section>

      <section id="rastreio" className="scroll-mt-24 space-y-3">
        <h2 className="text-xl font-bold text-slate-950 dark:text-white">
          2. Link, cookie de 60 dias e atribuição
        </h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Modelo first-touch (60 dias):</strong> quando um visitante
            acessa o site por meio de <code>?ref=CODIGO</code>, gravamos um
            cookie técnico de indicação (<code>artigen_ref</code>) válido por 60
            dias. Caso o visitante já possua um cookie de indicação ativo, o
            primeiro código registrado é mantido.
          </li>
          <li>
            <strong>Contas novas apenas:</strong> a vinculação definitiva ao
            parceiro ocorre no momento em que o visitante cria uma{" "}
            <strong>conta nova</strong> no Artigen. Contas já existentes não são
            associadas retroativamente e a indicação gravada é permanente.
          </li>
          <li>
            <strong>Proibição de autoindicação:</strong> o sistema bloqueia
            automaticamente indicações feitas pelo próprio parceiro para sua
            conta.
          </li>
        </ul>
      </section>

      <section id="comissoes" className="scroll-mt-24 space-y-3">
        <h2 className="text-xl font-bold text-slate-950 dark:text-white">
          3. Cálculo de comissões, saques e estornos
        </h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Percentuais oficiais por plano (sobre valor bruto):</strong>{" "}
            a comissão incide sobre o <strong>valor bruto</strong> efetivamente
            recebido em cada pagamento aprovado na Cakto (Pix, Cartão de Crédito
            ou Boleto) pelo usuário indicado, nas seguintes alíquotas oficiais:{" "}
            <strong>20% no plano Starter</strong> (ex.: R$ 34,90 gera R$ 6,98),{" "}
            <strong>35% no plano Pro</strong> (ex.: R$ 94,90 gera R$ 33,22) e{" "}
            <strong>35% no plano Agência</strong> (ex.: R$ 149,90 gera R$ 52,47),
            tanto no primeiro pagamento quanto nas renovações enquanto a
            assinatura estiver ativa.
          </li>
          <li>
            <strong>Ciclo de estados (garantia de 7 dias):</strong> toda comissão
            inicia como <em>pendente</em> durante o período de garantia de 7
            dias e passa automaticamente para <em>disponível</em> após esse
            prazo, podendo ser incluída em pedido de saque (<em>em saque</em>) e
            concluída como <em>paga</em>.
          </li>
          <li>
            <strong>Saques (mínimo R$ 50,00):</strong> quando o saldo disponível
            atingir o mínimo configurável (padrão R$ 50,00), o parceiro pode
            solicitar saque via Pix ou outro método informado no painel, sendo
            permitido 1 pedido em aberto por vez.
          </li>
          <li>
            <strong>Reembolsos e chargebacks:</strong> caso haja estorno antes do
            pagamento, a comissão é marcada como <em>estornada</em> e removida
            do saldo. Se a comissão já tiver sido paga, o estorno gera saldo
            negativo equivalente para compensação automática nos ganhos
            futuros.
          </li>
          <li>
            <strong>Privacidade dos indicados:</strong> o painel do parceiro
            exibe apenas estatísticas agregadas de cliques e endereços de e-mail
            mascarados (ex.: <code>jo***@gmail.com</code>) em conformidade com a
            LGPD.
          </li>
        </ul>
      </section>

      <section id="conduta" className="scroll-mt-24 space-y-3">
        <h2 className="text-xl font-bold text-slate-950 dark:text-white">
          4. Boas práticas e proibições
        </h2>
        <p>
          O parceiro compromete-se a divulgar o Artigen de maneira honesta e
          transparente. São expressamente vedados:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Autoindicação, criação de múltiplas contas falsas ou manipulação
            artificial de cliques e cadastros;
          </li>
          <li>
            Veiculação de anúncios pagos utilizando termos de marca registrada do
            Artigen (brand bidding) sem autorização prévia por escrito;
          </li>
          <li>
            Envio de spam, promessas enganosas de resultados ou uso de técnicas
            de cookie stuffing.
          </li>
        </ul>
      </section>

      <section id="desativacao" className="scroll-mt-24 space-y-3">
        <h2 className="text-xl font-bold text-slate-950 dark:text-white">
          5. Suspensão e alterações
        </h2>
        <p>
          A administração pode desativar um código de parceiro em caso de
          violação destes termos ou encerramento da parceria. Ao ser desativado,
          o link deixa de rastrear novos cadastros, mantendo-se o histórico das
          comissões já geradas. Consulte também nossa{" "}
          <Link
            href="/privacidade"
            className="font-semibold text-indigo-600 underline underline-offset-2 dark:text-indigo-400"
          >
            Política de Privacidade (LGPD)
          </Link>{" "}
          e os{" "}
          <Link
            href="/termos-de-uso"
            className="font-semibold text-indigo-600 underline underline-offset-2 dark:text-indigo-400"
          >
            Termos de Uso
          </Link>
          .
        </p>
      </section>
    </LegalPageLayout>
  );
}
