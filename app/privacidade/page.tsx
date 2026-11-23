import type { Metadata } from "next";
import Link from "next/link";
import LegalPageLayout, {
  type LegalSectionAnchor,
} from "@/components/LegalPageLayout";
import { SITE_NAME, SITE_URL } from "@/lib/seo";

const PAGE_PATH = "/privacidade";
const PAGE_TITLE = "Política de Privacidade e LGPD";
const PAGE_DESCRIPTION =
  "Saiba como o Artigen coleta, protege, armazena e exclui dados pessoais em conformidade com a Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018).";

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
  { id: "compromisso", title: "1. Compromisso com a LGPD" },
  { id: "dados-coletados", title: "2. Dados pessoais coletados" },
  { id: "finalidade", title: "3. Finalidade e bases legais" },
  { id: "voz-ia", title: "4. Áudio, narração e modelos de IA" },
  { id: "compartilhamento", title: "5. Operadores e compartilhamento" },
  { id: "seguranca", title: "6. Segurança e retenção de dados" },
  { id: "direitos", title: "7. Seus direitos como titular" },
  { id: "contato-dpo", title: "8. Contato do Encarregado (DPO)" },
];

export default function PrivacidadePage() {
  return (
    <LegalPageLayout
      currentPath={PAGE_PATH}
      badge="Privacidade e LGPD"
      title={PAGE_TITLE}
      subtitle={PAGE_DESCRIPTION}
      lastUpdated="22 de novembro de 2026"
      sections={SECTIONS}
    >
      <section id="compromisso" className="scroll-mt-24 space-y-3">
        <h2 className="text-xl font-bold text-slate-950 dark:text-white">
          1. Compromisso com a LGPD
        </h2>
        <p>
          O <strong>Artigen</strong> trata os dados pessoais de seus usuários com
          rigor técnico e transparência, em plena conformidade com a{" "}
          <strong>
            Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018 — LGPD)
          </strong>
          . Não vendemos, alugamos ou comercializamos informações pessoais ou
          artigos produzidos na plataforma para terceiros.
        </p>
      </section>

      <section id="dados-coletados" className="scroll-mt-24 space-y-3">
        <h2 className="text-xl font-bold text-slate-950 dark:text-white">
          2. Dados pessoais coletados
        </h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Dados de autenticação (Google OAuth / Supabase):</strong>{" "}
            nome completo, endereço de e-mail, identificador único de usuário e
            foto de perfil fornecidos pela sua conta Google ao optar pelo login.
          </li>
          <li>
            <strong>Conteúdo editorial produzido:</strong> temas, palavras-chave,
            links de referência, artigos gerados, favoritos e imagens vinculadas
            à sua biblioteca na nuvem (ou armazenadas apenas localmente no
            navegador caso utilize o estúdio sem login).
          </li>
          <li>
            <strong>Dados de faturamento e assinatura (Cakto):</strong> status
            da assinatura, plano contratado, método de pagamento utilizado (Pix,
            Cartão ou Boleto) e identificador do pedido. Dados sensíveis de
            cartão de crédito são processados exclusivamente pela Cakto e nunca
            trafegam nem são armazenados em nossos servidores.
          </li>
          <li>
            <strong>Registros técnicos essenciais:</strong> endereço IP e logs
            mínimos de requisição estritamente necessários para segurança,
            prevenção a fraudes e validação de webhooks.
          </li>
          <li>
            <strong>Cookie de indicação de parceiros (<code>artigen_ref</code>):</strong>{" "}
            quando você acessa o site por um link de parceiro (<code>?ref=CODIGO</code>),
            armazenamos um cookie seguro (<code>HttpOnly</code>,{" "}
            <code>SameSite=Lax</code>) válido por 60 dias para atribuir
            exclusivamente novos cadastros ao parceiro indicador. A contagem de
            cliques nos links é registrada apenas de forma agregada por dia, sem
            armazenar dados pessoais do visitante.
          </li>
        </ul>
      </section>

      <section id="finalidade" className="scroll-mt-24 space-y-3">
        <h2 className="text-xl font-bold text-slate-950 dark:text-white">
          3. Finalidade e bases legais
        </h2>
        <p>Tratamos seus dados com base nos incisos do Art. 7º da LGPD:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Execução de contrato:</strong> autenticar sua sessão,
            sincronizar seus artigos, gerenciar cotas mensais e liberar
            assinaturas contratadas via Pix/Cartão.
          </li>
          <li>
            <strong>Cumprimento de obrigação legal:</strong> manutenção de
            registros fiscais, de cobrança e logs mínimos previstos no Marco
            Civil da Internet.
          </li>
          <li>
            <strong>Legítimo interesse e prevenção a fraudes:</strong> proteção
            das rotas de API contra abusos automatizados e verificação da
            titularidade dos pedidos de pagamento.
          </li>
        </ul>
      </section>

      <section id="voz-ia" className="scroll-mt-24 space-y-3">
        <h2 className="text-xl font-bold text-slate-950 dark:text-white">
          4. Áudio, narração e modelos de IA
        </h2>
        <p>
          Quando você utiliza a função <strong>Narrar Artigo por Voz</strong>{" "}
          com o mascote Mulébi, o acesso ao microfone ocorre apenas mediante sua
          autorização explícita no navegador. O áudio gravado é enviado em conexão
          criptografada apenas para transcrição em tempo real (via Groq Whisper)
          e organização do rascunho —{" "}
          <strong>
            não armazenamos arquivos de gravação de voz após a transcrição
          </strong>
          .
        </p>
      </section>

      <section id="compartilhamento" className="scroll-mt-24 space-y-3">
        <h2 className="text-xl font-bold text-slate-950 dark:text-white">
          5. Operadores e compartilhamento
        </h2>
        <p>
          Para viabilizar o funcionamento técnico do serviço, dados estritamente
          necessários são processados pelos seguintes operadores sob padrões de
          segurança adequados:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Supabase:</strong> autenticação Google OAuth, banco de dados
            PostgreSQL com políticas de isolamento por linha (RLS) e armazenamento
            das imagens dos seus artigos.
          </li>
          <li>
            <strong>Cakto:</strong> intermediação de pagamentos via Pix, Cartão
            de Crédito e Boleto e gestão de assinaturas.
          </li>
          <li>
            <strong>Provedores de IA sob demanda:</strong> processamento dos
            prompts editoriais para geração de texto, pesquisa web, transcrição
            e ilustrações conforme o plano selecionado.
          </li>
        </ul>
      </section>

      <section id="seguranca" className="scroll-mt-24 space-y-3">
        <h2 className="text-xl font-bold text-slate-950 dark:text-white">
          6. Segurança e retenção de dados
        </h2>
        <p>
          Adotamos criptografia em trânsito (HTTPS/TLS), cabeçalhos de
          segurança HTTP (<code>Content-Security-Policy</code>,{" "}
          <code>X-Content-Type-Options</code>, <code>Referrer-Policy</code>),
          chaves de API restritas ao servidor e validação criptográfica em
          webhooks e links de pagamento. Os artigos ficam armazenados enquanto
          sua conta estiver ativa ou até que você opte por excluí-los no
          estúdio.
        </p>
      </section>

      <section id="direitos" className="scroll-mt-24 space-y-3">
        <h2 className="text-xl font-bold text-slate-950 dark:text-white">
          7. Seus direitos como titular (Art. 18 da LGPD)
        </h2>
        <p>Você pode solicitar a qualquer momento:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Confirmação da existência de tratamento e acesso aos seus dados;</li>
          <li>Correção de dados incompletos, inexatos ou desatualizados;</li>
          <li>
            Exportação dos seus artigos em HTML ou eliminação definitiva do seu
            histórico e da sua conta no Supabase;
          </li>
          <li>
            Revogação de consentimento e informações sobre compartilhamento com
            operadores.
          </li>
        </ul>
      </section>

      <section id="contato-dpo" className="scroll-mt-24 space-y-3">
        <h2 className="text-xl font-bold text-slate-950 dark:text-white">
          8. Contato do Encarregado (DPO)
        </h2>
        <p>
          Para exercer qualquer direito previsto na LGPD ou esclarecer dúvidas
          sobre privacidade, entre em contato pelo e-mail{" "}
          <a
            href="mailto:contato@artificializar.site"
            className="font-semibold text-indigo-600 underline underline-offset-2 dark:text-indigo-400"
          >
            contato@artificializar.site
          </a>{" "}
          ou através do{" "}
          <Link
            href="/#contato"
            className="font-semibold text-indigo-600 underline underline-offset-2 dark:text-indigo-400"
          >
            formulário oficial de atendimento
          </Link>
          . Responderemos dentro do prazo legal.
        </p>
      </section>
    </LegalPageLayout>
  );
}
