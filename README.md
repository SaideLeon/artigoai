# Artigen — Gerador de Artigos com Inteligência Artificial

Plataforma SaaS construída em **Next.js (App Router)**, **TypeScript**, **Tailwind CSS**, **Three.js** e **Supabase** para criar artigos completos (~800 a 3.200 palavras), otimizados para SEO, com pesquisa na web e ilustrações geradas secção a secção.

---

## Principais Recursos

- **Estúdio de Criação (`/studio`)**: sugestão automática de palavras-chave, descrição, tom e estilo (`/api/suggest`), pesquisa web em tempo real (`/api/research`), esboço estruturado (`/api/outline`), redação progressiva por secção (`/api/section`) e geração de imagens (`/api/image`).
- **Roteamento de IA por Plano**:
  - **Plano Gratuito (`free`)**: utiliza **OpenRouter** para geração de texto (`openrouter/free`), **Groq** para pesquisa web (`openai/gpt-oss-120b` com `browser_search`) e **NVIDIA** para geração de imagens (`black-forest-labs/flux.2-klein-4b`).
  - **Plano Pago (`paid`)**: utiliza exclusivamente modelos **Google Gemini** via `@google/genai` (`gemini-4-hydrogen` para texto e pesquisa com `googleSearch`, e `gemini-nano-banana-2.1` para imagens em `1K`).
- **Landing Page & Mascote 3D (`/`, `/mascote`)**: computador 3D interativo no hero (abre ao passar o cursor no cabeçalho) e mascote humanoide 3D em Three.js com expressões e animações em tempo real (*idle*, *wave*, *thinking*, *writing*, *excited*, *pointing*, *sleeping*).
- **Persistência no Supabase**: autenticação Google OAuth (`/auth/callback`), sincronização em tempo real de artigos, favoritos, configurações pessoais, assinaturas e cotas mensais (`supabase/schema.sql`), com fallback local em `localStorage` quando o Supabase não estiver configurado.
- **Assinaturas Mensais e Anuais em BRL (`lib/pricing.ts`) + Stripe**: plano **Grátis** (2 artigos/mês) e 3 planos pagos recorrentes (**Starter** 5/mês · R$ 34,90, **Pro** 16/mês · R$ 94,90, **Agência** 30/mês · R$ 149,90, com opção anual de 10 meses pelo preço de 12), checkout recorrente via **Stripe** (`/api/stripe/checkout`, `/api/stripe/verify-session`, `/api/stripe/webhook`, `/api/stripe/portal`) e renovação mensal automática em `payments`, `subscriptions` e `usage_limits`.

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
2. Execute o script [`supabase/schema.sql`](./supabase/schema.sql) no **SQL Editor** do Supabase (cria tabelas, RLS, triggers, Realtime e bucket `article-images`).
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
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase | Chave de serviço (apenas servidor — grava créditos/pagamentos após Stripe) |
| `STRIPE_SECRET_KEY` | Stripe (Pagamentos) | Chave secreta da Stripe (`sk_test_...` / `sk_live_...`, apenas servidor) |
| `STRIPE_WEBHOOK_SECRET` | Stripe (Webhook) | Segredo de assinatura do webhook (`/api/stripe/webhook`, `whsec_...`) |
| `STRIPE_PRODUCT_STARTER_ID` | Stripe (Starter) | ID do produto Stripe para o plano Starter (padrão: `prod_VfVM45LGSnWLoH`) |
| `STRIPE_PRODUCT_PRO_ID` | Stripe (Pro) | ID do produto Stripe para o plano Pro (padrão: `prod_VfW1i8hFclTPOh`) |
| `STRIPE_PRODUCT_AGENCIA_ID` | Stripe (Agência) | ID do produto Stripe para o plano Agência (padrão: `prod_VfWGdFmGE4oQnu`) |
