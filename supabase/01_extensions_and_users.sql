-- =============================================================================
-- 01. Extensões e tabelas base de utilizadores (Perfis + Configurações)
-- Dependências: auth.users (Supabase Auth)
-- =============================================================================

create extension if not exists "pgcrypto";

-- Perfis de utilizadores (sincronizado automaticamente via trigger 05)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null default '',
  full_name text not null default 'Usuário Artigen',
  avatar_url text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Preferências pessoais padrão do estúdio
create table if not exists public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  tom_padrao text not null default 'Informativo e Didático',
  idioma_padrao text not null default 'Português (Brasil)',
  faixa_palavras_padrao text not null default '2000-2500'
    check (faixa_palavras_padrao in ('800-1200', '1200-1800', '2000-2500', '2600-3200')),
  incluir_imagens_padrao boolean not null default true,
  primeira_pessoa_padrao boolean not null default true,
  pesquisa_web_padrao text not null default 'auto'
    check (pesquisa_web_padrao in ('auto', 'sempre', 'desativada')),
  theme text not null default 'light'
    check (theme in ('light', 'dark')),
  updated_at timestamptz not null default now()
);
