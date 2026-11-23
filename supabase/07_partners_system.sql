-- =============================================================================
-- 07. Sistema de Parceiros, Convites, Cliques Diários e Comissões Cakto
-- Dependências: 01_extensions_and_users.sql e 03_billing_and_limits.sql
-- =============================================================================

-- 1) Parceiros cadastrados (perfil único por utilizador)
create table if not exists public.partners (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  codigo text not null unique check (
    char_length(codigo) between 3 and 30
    and codigo ~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$'
  ),
  percentual_comissao numeric(5,2) not null default 45.00 check (
    percentual_comissao >= 0 and percentual_comissao <= 100
  ),
  ativo boolean not null default true,
  codigo_personalizado boolean not null default false,
  criado_em timestamptz not null default now()
);

create index if not exists idx_partners_codigo_ativo
  on public.partners (codigo, ativo);

-- 2) Convites de uso único gerados pelo admin (armazena apenas SHA-256 do token)
create table if not exists public.partner_invites (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  nome_sugerido text not null default '',
  percentual_comissao numeric(5,2) not null default 45.00 check (
    percentual_comissao >= 0 and percentual_comissao <= 100
  ),
  expira_em timestamptz not null,
  status text not null default 'pendente' check (
    status in ('pendente', 'aceito', 'expirado', 'cancelado')
  ),
  criado_em timestamptz not null default now(),
  aceito_em timestamptz,
  aceito_por_user_id uuid references auth.users (id) on delete set null,
  criado_por_email text not null default ''
);

create index if not exists idx_partner_invites_status_expira
  on public.partner_invites (status, expira_em desc);

-- 3) Cliques agregados por dia (sem dados pessoais de visitantes)
create table if not exists public.referral_clicks (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners (id) on delete cascade,
  data date not null default current_date,
  total integer not null default 0 check (total >= 0),
  unique (partner_id, data)
);

create index if not exists idx_referral_clicks_partner_data
  on public.referral_clicks (partner_id, data desc);

-- 4) Rastreio imutável do indicador na tabela de perfis de utilizadores
alter table public.profiles
  add column if not exists referred_by uuid references public.partners (id) on delete set null;

alter table public.profiles
  add column if not exists referred_at timestamptz;

create index if not exists idx_profiles_referred_by
  on public.profiles (referred_by)
  where referred_by is not null;

-- Trigger que impede alteração de referred_by / referred_at depois de gravado
-- e bloqueia gravação direta via cliente browser
create or replace function public.protect_profile_referral_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (
    new.referred_by is distinct from old.referred_by
    or new.referred_at is distinct from old.referred_at
  ) then
    if auth.uid() is not null then
      raise exception 'Os campos de indicação só podem ser gravados pelo servidor.';
    end if;

    if old.referred_by is not null then
      raise exception 'O indicador (referred_by) é permanente e não pode ser alterado.';
    end if;

    if new.referred_by is not null and exists (
      select 1 from public.partners p
      where p.id = new.referred_by and p.user_id = old.id
    ) then
      raise exception 'Um parceiro não pode indicar a si próprio.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_protect_profile_referral_fields on public.profiles;
create trigger trg_protect_profile_referral_fields
  before update on public.profiles
  for each row execute procedure public.protect_profile_referral_fields();

-- 5) Comissões registradas por transação Cakto (id_da_transacao_cakto único)
create table if not exists public.commissions (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  id_da_transacao_cakto text not null unique,
  plano text not null default 'starter',
  ciclo text not null default 'monthly' check (ciclo in ('monthly', 'yearly')),
  valor_bruto numeric(12,2) not null check (valor_bruto >= 0),
  percentual_aplicado numeric(5,2) not null check (
    percentual_aplicado >= 0 and percentual_aplicado <= 100
  ),
  valor_comissao numeric(12,2) not null check (valor_comissao >= 0),
  moeda text not null default 'BRL' check (moeda in ('BRL')),
  tipo text not null default 'primeiro_pagamento' check (
    tipo in ('primeiro_pagamento', 'renovacao')
  ),
  status text not null default 'pendente' check (
    status in ('pendente', 'paga', 'estornada')
  ),
  criado_em timestamptz not null default now(),
  paga_em timestamptz
);

create index if not exists idx_commissions_partner_criado
  on public.commissions (partner_id, criado_em desc);

create index if not exists idx_commissions_user_id
  on public.commissions (user_id);

-- 6) Função atómica para incrementar clique diário de indicação
create or replace function public.increment_referral_click(
  p_partner_id uuid,
  p_data date default current_date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.referral_clicks (partner_id, data, total)
  values (p_partner_id, coalesce(p_data, current_date), 1)
  on conflict (partner_id, data)
  do update set total = public.referral_clicks.total + 1;
end;
$$;

revoke all on function public.increment_referral_click(uuid, date) from public;
grant execute on function public.increment_referral_click(uuid, date) to service_role;

-- 6b) RPC segura para validar código ativo e registrar clique diário agregado
create or replace function public.track_referral_visit(
  p_codigo text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clean text;
  v_partner_id uuid;
begin
  v_clean := lower(trim(coalesce(p_codigo, '')));
  if v_clean !~ '^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$' then
    return false;
  end if;

  select id
    into v_partner_id
    from public.partners
   where codigo = v_clean
     and ativo = true
   limit 1;

  if v_partner_id is null then
    return false;
  end if;

  insert into public.referral_clicks (partner_id, data, total)
  values (v_partner_id, current_date, 1)
  on conflict (partner_id, data)
  do update set total = public.referral_clicks.total + 1;

  return true;
end;
$$;

revoke all on function public.track_referral_visit(text) from public;
grant execute on function public.track_referral_visit(text) to anon, authenticated, service_role;

-- 7) Políticas RLS (leitura restrita ao próprio parceiro; escrita via servidor/service_role)
alter table public.partners enable row level security;
alter table public.partner_invites enable row level security;
alter table public.referral_clicks enable row level security;
alter table public.commissions enable row level security;

drop policy if exists "partners_owner_select" on public.partners;
create policy "partners_owner_select"
  on public.partners for select
  using (auth.uid() = user_id);

drop policy if exists "referral_clicks_partner_select" on public.referral_clicks;
create policy "referral_clicks_partner_select"
  on public.referral_clicks for select
  using (
    exists (
      select 1 from public.partners p
      where p.id = referral_clicks.partner_id
        and p.user_id = auth.uid()
    )
  );

drop policy if exists "commissions_partner_select" on public.commissions;
create policy "commissions_partner_select"
  on public.commissions for select
  using (
    exists (
      select 1 from public.partners p
      where p.id = commissions.partner_id
        and p.user_id = auth.uid()
    )
  );
