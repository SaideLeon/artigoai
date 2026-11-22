# Artigen — Gerador de Artigos com Inteligência Artificial

Plataforma SaaS construída em **Next.js (App Router)**, **TypeScript**, **Tailwind CSS**, **Three.js** e **Supabase** para criar artigos completos (~800 a 3.200 palavras), otimizados para SEO, com pesquisa na web e ilustrações geradas secção a secção.

---

## Principais Recursos

- **Estúdio de Criação (`/studio`)**: sugestão automática de palavras-chave, descrição, tom e estilo (`/api/suggest`), pesquisa web em tempo real (`/api/research`), esboço estruturado (`/api/outline`), redação progressiva por secção (`/api/section`) e geração de imagens (`/api/image`).
- **Roteamento de IA por Plano**:
  - **Plano Gratuito (`free`)**: utiliza **OpenRouter** para geração de texto (`openrouter/free`), **Groq** para pesquisa web (`openai/gpt-oss-120b` com `browser_search`) e **NVIDIA** para geração de imagens (`black-forest-labs/flux.2-klein-4b`).
  - **Plano Pago (`paid`)**: utiliza exclusivamente modelos **Google Gemini** via `@google/genai` (`gemini-4-hydrogen` para texto e pesquisa com `googleSearch`, e `gemini-nano-banana-2.1` para imagens em `1K`).
- **Landing Page & Mascote 3D (`/`, `/mascote`)**: computador 3D interativo no hero (abre ao passar o cursor no cabeçalho) e mascote humanoide 3D em Three.js com expressões e animações em tempo real (*idle*, *wave*, *thinking*, *writing*, *excited*, *pointing*, *sleeping*).
- **Persistência no Supabase**: autenticação Google OAuth (`/auth/callback`), sincronização em tempo real de artigos, favoritos, configurações pessoais, assinaturas e cotas mensais (`supabase/01_*.sql` a `supabase/06_*.sql`), com fallback local em `localStorage` quando o Supabase não estiver configurado.
- **Assinaturas Mensais e Anuais em BRL (`lib/pricing.ts`) + Cakto (Pix, Cartão e Boleto)**: plano **Grátis** (2 artigos/mês) e 3 planos pagos recorrentes (**Starter** 5/mês · R$ 34,90, **Pro** 16/mês · R$ 94,90, **Agência** 30/mês · R$ 149,90, com opção anual de 10 meses pelo preço de 12), checkout via **Cakto** (`/api/cakto/checkout`, `/api/cakto/verify-order`, `/api/cakto/webhook`, `/api/cakto/portal`) com suporte a **Pix** e renovação mensal automática em `payments`, `subscriptions` e `usage_limits`.

---

## Como Funciona a Geração

1. `/api/suggest` *(opcional)*: sugere palavras-chave, descrição, tom, extensão e modo de pesquisa a partir do título (OpenRouter no gratuito; Gemini no pago).
2. `/api/research`: avalia se o tema precisa de dados recentes e consulta fontes na web (Groq `browser_search` no plano gratuito; Google Gemini `googleSearch` grounding no plano pago).
3. `/api/outline`: gera o título final e a lista estruturada de secções (OpenRouter no gratuito; Gemini no pago).
4. `/api/section`: escreve cada secção mantendo continuidade com o que já foi produzido e extrai o prompt visual (OpenRouter no gratuito; Gemini no pago).
5. `/api/image`: gera a ilustração da secção (NVIDIA `flux.2-klein-4b` no plano gratuito; Gemini `gemini-nano-banana-2.1` no plano pago).

---

## Executar Localmente

```bash
npm install
cp .env.example .env.local
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

### Configurar o Supabase (opcional para nuvem)

1. Crie um projeto no [Supabase](https://supabase.com).
2. Execute em ordem os scripts modulares na pasta [`supabase/`](./supabase/schema.sql) (`01_extensions_and_users.sql` até `06_realtime_and_storage.sql`) no **SQL Editor** do Supabase (criam tabelas, RLS, triggers, Realtime e bucket `article-images`).
3. Ative o provedor **Google** em **Authentication > Providers** e adicione `http://localhost:3000/auth/callback` (e a URL de produção) nas Redirect URLs.
4. Preencha `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (ou `NEXT_PUBLIC_SUPABASE_ANON_KEY`) em `.env.local`.

---

## Variáveis de Ambiente

| Variável | Plano / Serviço | Descrição |
| --- | --- | --- |
| `GEMINI_API_KEY` | Pago (Google Gemini) | Chave da API Gemini usada no servidor (`@google/genai`) |
| `GEMINI_TEXT_MODEL` | Pago (Google Gemini) | Modelo de texto e pesquisa (padrão: `gemini-4-hydrogen`) |
| `GEMINI_IMAGE_MODEL` | Pago (Google Gemini) | Modelo de imagem (padrão: `gemini-nano-banana-2.1`) |
| `OPENROUTER_API_KEY` | Gratuito (OpenRouter) | Chave da API OpenRouter usada para gerar texto no plano gratuito |
| `OPENROUTER_TEXT_MODEL` | Gratuito (OpenRouter) | Modelo de texto no OpenRouter (padrão: `openrouter/free`) |
| `GROQ_API_KEY` | Gratuito (Groq) | Chave da API Groq usada para pesquisa web (`browser_search`) |
| `GROQ_RESEARCH_MODEL` | Gratuito (Groq) | Modelo de pesquisa web na Groq (padrão: `openai/gpt-oss-120b`) |
| `NVIDIA_API_KEY` | Gratuito (NVIDIA) | Chave da API NVIDIA usada para geração de imagens |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase | URL pública do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase | Chave publicável (`sb_publishable_...`) do Supabase para SSR/Client |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase | Chave anónima legada opcional (`anon`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase | Chave de serviço (apenas servidor — grava créditos/pagamentos após Cakto) |
| `CAKTO_CLIENT_ID` | Cakto (OAuth2 API) | Client ID da API Pública da Cakto (apenas servidor) |
| `CAKTO_CLIENT_SECRET` | Cakto (OAuth2 API) | Client Secret da API Pública da Cakto (apenas servidor) |
| `CAKTO_WEBHOOK_SECRET` | Cakto (Webhook) | Segredo de validação do webhook (`/api/cakto/webhook`) |
| `CAKTO_OFFER_*` | Cakto (Ofertas) | IDs ou URLs das ofertas (`STARTER_MONTHLY`, `STARTER_YEARLY`, `PRO_MONTHLY`, `PRO_YEARLY`, `AGENCIA_MONTHLY`, `AGENCIA_YEARLY`) |
