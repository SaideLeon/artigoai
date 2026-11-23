-- =============================================================================
-- 13. Papel Superadmin Protegido na Tabela public.profiles
-- Dependências: 01_extensions_and_users.sql e 04_rls_policies.sql
-- =============================================================================

-- 1) Adiciona coluna role ('user' | 'superadmin') com padrão 'user'
alter table public.profiles
  add column if not exists role text not null default 'user';

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('user', 'superadmin'));

create index if not exists idx_profiles_superadmin
  on public.profiles (id)
  where role = 'superadmin';

-- 2) Trigger que impede auto-promoção pelo cliente autenticado no browser
-- Apenas SQL Editor (postgres) ou service_role (auth.uid() is null) pode alterar role
create or replace function public.protect_profile_role_field()
returns trigger
language plpgsql
security definer
set search_path = public
as $trg_role$
begin
  if auth.uid() is not null then
    if tg_op = 'INSERT' and new.role is distinct from 'user' then
      raise exception 'Apenas o administrador do banco pode atribuir o papel superadmin.';
    end if;

    if tg_op = 'UPDATE' and new.role is distinct from old.role then
      raise exception 'O campo role é protegido e só pode ser alterado pelo SQL Editor ou servidor.';
    end if;
  end if;

  return new;
end;
$trg_role$;

drop trigger if exists trg_protect_profile_role_field on public.profiles;
create trigger trg_protect_profile_role_field
  before insert or update on public.profiles
  for each row execute procedure public.protect_profile_role_field();

notify pgrst, 'reload schema';
