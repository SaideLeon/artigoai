-- =============================================================================
-- Artigen — Esquema PostgreSQL completo para Supabase (Auth + RLS + Realtime)
-- Execute este script no SQL Editor do seu projeto Supabase.
-- =============================================================================

create extension if not exists "pgcrypto";

-- 1. Perfis de utilizadores (sincronizado automaticamente com auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null default '',
  full_name text not null default 'Usuário Artigen',
  avatar_url text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Preferências pessoais padrão do estúdio
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

-- 3. Categorias personalizadas por utilizador
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  slug text not null,
  created_at timestamptz not null default now(),
  unique (user_id, slug)
);

-- 4. Artigos gerados e editados (incluindo secções, fontes e favorito)
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

-- 5. Histórico de gerações (auditoria / métricas de produção)
create table if not exists public.generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  article_id text references public.articles (id) on delete set null,
  tema text not null,
  total_palavras integer not null default 0,
  pesquisa_usada boolean not null default false,
  created_at timestamptz not null default now()
);

-- 6. Assinaturas e limites de utilização
create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'pro', 'enterprise')),
  status text not null default 'active' check (status in ('active', 'canceled', 'past_due')),
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.usage_limits (
  user_id uuid primary key references auth.users (id) on delete cascade,
  monthly_articles_used integer not null default 0 check (monthly_articles_used >= 0),
  monthly_articles_limit integer not null default 5 check (monthly_articles_limit > 0),
  reset_at timestamptz not null default (date_trunc('month', now()) + interval '1 month')
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan text not null,
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null default 'BRL',
  status text not null default 'paid',
  created_at timestamptz not null default now()
);

-- =============================================================================
-- Row Level Security (RLS) — Isolamento estrito por auth.uid()
-- =============================================================================
alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.categories enable row level security;
alter table public.articles enable row level security;
alter table public.generations enable row level security;
alter table public.subscriptions enable row level security;
alter table public.usage_limits enable row level security;
alter table public.payments enable row level security;

-- Profiles
drop policy if exists "profiles_owner_all" on public.profiles;
create policy "profiles_owner_all"
  on public.profiles for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- User Settings
drop policy if exists "user_settings_owner_all" on public.user_settings;
create policy "user_settings_owner_all"
  on public.user_settings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Categories
drop policy if exists "categories_owner_all" on public.categories;
create policy "categories_owner_all"
  on public.categories for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Articles
drop policy if exists "articles_owner_all" on public.articles;
create policy "articles_owner_all"
  on public.articles for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Generations
drop policy if exists "generations_owner_select_insert" on public.generations;
create policy "generations_owner_select_insert"
  on public.generations for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Subscriptions, Usage Limits & Payments (leitura apenas pelo próprio utilizador)
drop policy if exists "subscriptions_owner_select" on public.subscriptions;
create policy "subscriptions_owner_select"
  on public.subscriptions for select
  using (auth.uid() = user_id);

drop policy if exists "usage_limits_owner_select" on public.usage_limits;
create policy "usage_limits_owner_select"
  on public.usage_limits for select
  using (auth.uid() = user_id);

drop policy if exists "payments_owner_select" on public.payments;
create policy "payments_owner_select"
  on public.payments for select
  using (auth.uid() = user_id);

-- =============================================================================
-- Trigger automático ao registar utilizador (Google Auth -> Perfil + Configs)
-- =============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', 'Usuário Artigen'),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture', '')
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = excluded.full_name,
        avatar_url = excluded.avatar_url,
        updated_at = now();

  insert into public.user_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  insert into public.subscriptions (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  insert into public.usage_limits (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- =============================================================================
-- Realtime + Storage Bucket para imagens de artigos
-- =============================================================================
alter publication supabase_realtime add table public.articles;
alter publication supabase_realtime add table public.user_settings;

insert into storage.buckets (id, name, public)
values ('article-images', 'article-images', true)
on conflict (id) do nothing;

drop policy if exists "article_images_public_read" on storage.objects;
create policy "article_images_public_read"
  on storage.objects for select
  using (bucket_id = 'article-images');

drop policy if exists "article_images_owner_write" on storage.objects;
create policy "article_images_owner_write"
  on storage.objects for insert
  with check (
    bucket_id = 'article-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "article_images_owner_delete" on storage.objects;
create policy "article_images_owner_delete"
  on storage.objects for delete
  using (
    bucket_id = 'article-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
