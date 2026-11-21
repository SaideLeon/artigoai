-- =============================================================================
-- 02. Tabelas de conteúdo (Categorias, Artigos e Histórico de Gerações)
-- Dependências: 01_extensions_and_users.sql
-- =============================================================================

-- Categorias personalizadas por utilizador
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  slug text not null,
  created_at timestamptz not null default now(),
  unique (user_id, slug)
);

-- Artigos gerados e editados (incluindo secções, fontes e favorito)
create table if not exists public.articles (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  category_id uuid references public.categories (id) on delete set null,
  tema text not null,
  titulo text not null,
  descricao text not null default '',
  palavras_chave jsonb not null default '[]'::jsonb,
  tom text not null default 'Informativo e Didático',
  idioma text not null default 'Português (Brasil)',
  faixa_palavras text not null default '2000-2500'
    check (faixa_palavras in ('800-1200', '1200-1800', '2000-2500', '2600-3200')),
  primeira_pessoa boolean not null default true,
  pesquisa_usada boolean not null default false,
  fontes jsonb not null default '[]'::jsonb,
  secoes jsonb not null default '[]'::jsonb,
  favorito boolean not null default false,
  total_palavras integer not null default 0 check (total_palavras >= 0),
  criado_em timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_articles_user_criado
  on public.articles (user_id, criado_em desc);

-- Histórico de gerações (auditoria / métricas de produção)
create table if not exists public.generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  article_id text references public.articles (id) on delete set null,
  tema text not null,
  total_palavras integer not null default 0,
  pesquisa_usada boolean not null default false,
  created_at timestamptz not null default now()
);
