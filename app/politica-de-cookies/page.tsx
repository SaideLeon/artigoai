import type { Metadata } from "next";
import Link from "next/link";
import LegalPageLayout, {
  type LegalSectionAnchor,
} from "@/components/LegalPageLayout";
import { SITE_NAME, SITE_URL } from "@/lib/seo";

const PAGE_PATH = "/politica-de-cookies";
const PAGE_TITLE = "Política de Cookies e Armazenamento Local";
const PAGE_DESCRIPTION =
  "Entenda quais cookies e dados de armazenamento local (localStorage) o Artigen utiliza para autenticação segura, tema visual e salvamento de rascunhos.";

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
  { id: "o-que-sao", title: "1. O que são cookies e armazenamento local" },
  { id: "categorias", title: "2. Categorias utilizadas pelo Artigen" },
  { id: "rastreamento", title: "3. Publicidade e terceiros" },
  { id: "gerenciamento", title: "4. Como gerenciar ou bloquear cookies" },
];

export default function PoliticaCookiesPage() {
  return (
    <LegalPageLayout
      currentPath={PAGE_PATH}
      badge="Transparência Técnica"
      title={PAGE_TITLE}
      subtitle={PAGE_DESCRIPTION}
      lastUpdated="22 de novembro de 2026"
      sections={SECTIONS}
    >
      <section id="o-que-sao" className="scroll-mt-24 space-y-3">
        <h2 className="text-xl font-bold text-slate-950 dark:text-white">
          1. O que são cookies e armazenamento local
        </h2>
        <p>
          Cookies são pequenos arquivos de texto gravados pelo navegador quando
          você visita um site. De forma complementar, aplicações web modernas
          também utilizam o armazenamento local do navegador (
          <code>localStorage</code>) para preservar suas preferências de
          interface sem precisar enviar esses dados ao servidor a cada
          requisição.
        </p>
      </section>

      <section id="categorias" className="scroll-mt-24 space-y-4">
        <h2 className="text-xl font-bold text-slate-950 dark:text-white">
          2. Categorias utilizadas pelo Artigen
        </h2>

        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full border-collapse text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-white">
                <th className="px-4 py-3 font-semibold">Categoria</th>
                <th className="px-4 py-3 font-semibold">Finalidade</th>
                <th className="px-4 py-3 font-semibold">Duração</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              <tr>
                <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                  Estritamente necessários (Autenticação)
                </td>
                <td className="px-4 py-3">
                  Cookies seguros do Supabase Auth (<code>sb-*</code>) para
                  manter sua sessão Google OAuth ativa e proteger chamadas de
                  API.
                </td>
                <td className="px-4 py-3 whitespace-nowrap">Sessão / Renovação</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                  Preferências e Rascunhos (<code>localStorage</code>)
                </td>
                <td className="px-4 py-3">
                  Armazena escolha de tema claro/escuro, idioma padrão, tom
                  editorial e rascunhos locais no navegador para evitar perda de
                  trabalho.
                </td>
                <td className="px-4 py-3 whitespace-nowrap">Persistente local</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                  Pagamentos (Cakto)
                </td>
                <td className="px-4 py-3">
                  Identificadores essenciais quando você inicia um checkout via
                  Pix, Cartão ou Boleto na Cakto para associar o pedido à sua
                  conta.
                </td>
                <td className="px-4 py-3 whitespace-nowrap">Temporária</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section id="rastreamento" className="scroll-mt-24 space-y-3">
        <h2 className="text-xl font-bold text-slate-950 dark:text-white">
          3. Publicidade e terceiros
        </h2>
        <p>
          O Artigen <strong>não utiliza cookies invasivos de rastreamento publicitário</strong>{" "}
          nem comercializa perfis comportamentais para redes de anúncios. Ao
          navegar para páginas externas de parceiros (como o ambiente seguro de
          checkout da Cakto ou login Google), aplicam-se também as respectivas
          políticas desses serviços.
        </p>
      </section>

      <section id="gerenciamento" className="scroll-mt-24 space-y-3">
        <h2 className="text-xl font-bold text-slate-950 dark:text-white">
          4. Como gerenciar ou bloquear cookies
        </h2>
        <p>
          Você pode limpar ou bloquear cookies e dados locais a qualquer momento
          nas configurações de privacidade do seu navegador (Google Chrome,
          Mozilla Firefox, Apple Safari ou Microsoft Edge). Note que a
          desativação de cookies estritamente necessários impedirá a manutenção
          da sessão autenticada no Estúdio.
        </p>
        <p>
          Para mais detalhes sobre como tratamos seus dados, consulte nossa{" "}
          <Link
            href="/privacidade"
            className="font-semibold text-indigo-600 underline underline-offset-2 dark:text-indigo-400"
          >
            Política de Privacidade (LGPD)
          </Link>
          .
        </p>
      </section>
    </LegalPageLayout>
  );
}
