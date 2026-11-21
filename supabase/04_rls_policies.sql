-- =============================================================================
-- 04. Papéis de Acesso e Segurança em Nível de Linha (RLS) por auth.uid()
-- Dependências: 01, 02 e 03
-- =============================================================================

alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.categories enable row level security;
alter table public.articles enable row level security;
alter table public.generations enable row level security;
alter table public.subscriptions enable row level security;
alter table public.usage_limits enable row level security;
alter table public.payments enable row level security;

-- Leitura e escrita apenas pelo próprio utilizador autenticado
drop policy if exists "profiles_owner_all" on public.profiles;
create policy "profiles_owner_all"
  on public.profiles for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "user_settings_owner_all" on public.user_settings;
create policy "user_settings_owner_all"
  on public.user_settings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "categories_owner_all" on public.categories;
create policy "categories_owner_all"
  on public.categories for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "articles_owner_all" on public.articles;
create policy "articles_owner_all"
  on public.articles for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "generations_owner_select_insert" on public.generations;
create policy "generations_owner_select_insert"
  on public.generations for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Billing e cotas: cliente só pode ler; escrita reservada à service_role no servidor
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
