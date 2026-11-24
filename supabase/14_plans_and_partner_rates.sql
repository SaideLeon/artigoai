-- =============================================================================
-- 14. Atualização dos Planos (Starter 14, Pro 33, Agência 48), Limites de Imagens
--     por Artigo (7/artigo) e Taxas Oficiais de Parceiros (20% / 35% / 35%)
-- Dependências: 03_billing_and_limits.sql, 07_partners_system.sql, 08_partners_ledger_and_withdrawals.sql
-- Não-destrutiva: preserva todos os utilizadores, assinaturas, artigos e histórico.
-- =============================================================================

-- 1) Evolução segura de public.usage_limits para rastrear imagens mensais
alter table public.usage_limits
  add column if not exists monthly_images_used integer not null default 0 check (monthly_images_used >= 0);

alter table public.usage_limits
  add column if not exists monthly_images_limit integer not null default 14 check (monthly_images_limit > 0);

-- 2) Sessões de geração por artigo para:
--    a) Contar múltiplos pedidos (/api/outline, /api/section) do mesmo artigo como 1 crédito
--    b) Controlar o máximo de 7 imagens incluídas por artigo + débito de artigos não gerados se > 7
create table if not exists public.article_usage_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  session_key text not null,
  images_used integer not null default 0 check (images_used >= 0),
  images_allowance integer not null default 7 check (images_allowance >= 7),
  extra_article_credits_used integer not null default 0 check (extra_article_credits_used >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, session_key)
);

create index if not exists idx_article_usage_sessions_user_updated
  on public.article_usage_sessions (user_id, updated_at desc);

alter table public.article_usage_sessions enable row level security;

drop policy if exists "article_usage_sessions_owner_select" on public.article_usage_sessions;
create policy "article_usage_sessions_owner_select"
  on public.article_usage_sessions for select
  using (auth.uid() = user_id);

-- 3) Atualiza limites dos planos ativos existentes sem apagar o consumo do ciclo atual
update public.usage_limits u
   set monthly_articles_limit = case
         when s.status = 'active' and lower(s.plan) = 'starter' then 14
         when s.status = 'active' and lower(s.plan) = 'pro' then 33
         when s.status = 'active' and lower(s.plan) = 'agencia' then 48
         else 2
       end,
       monthly_images_limit = case
         when s.status = 'active' and lower(s.plan) = 'starter' then 98
         when s.status = 'active' and lower(s.plan) = 'pro' then 231
         when s.status = 'active' and lower(s.plan) = 'agencia' then 336
         else 14
       end
  from public.subscriptions s
 where s.user_id = u.user_id;

-- Garante também que linhas sem subscription fiquem coerentes com o plano Grátis
update public.usage_limits
   set monthly_images_limit = greatest(14, monthly_articles_limit * 7)
 where monthly_images_limit < monthly_articles_limit * 7;

-- 4) Atualiza o default de comissão para novos convites/parceiros (35% base / tabela por plano)
alter table public.partners
  alter column percentual_comissao set default 35.00;

alter table public.partner_invites
  alter column percentual_comissao set default 35.00;

-- 5) RPC atómica para consumir cota de artigo (idempotente por session_key)
create or replace function public.consume_article_quota(
  p_user_id uuid,
  p_session_key text,
  p_articles_limit integer,
  p_images_limit integer,
  p_max_images_per_article integer default 7,
  p_reset_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $rpc_art$
declare
  v_now timestamptz := now();
  v_usage public.usage_limits%rowtype;
  v_session public.article_usage_sessions%rowtype;
  v_clean_key text := coalesce(nullif(trim(p_session_key), ''), 'default');
  v_next_reset timestamptz := coalesce(p_reset_at, v_now + interval '1 month');
  v_allowance integer := greatest(1, coalesce(p_max_images_per_article, 7));
begin
  if p_user_id is null then
    return jsonb_build_object('ok', false, 'reason', 'missing_user');
  end if;

  insert into public.usage_limits (
    user_id,
    monthly_articles_used,
    monthly_articles_limit,
    monthly_images_used,
    monthly_images_limit,
    reset_at
  )
  values (
    p_user_id,
    0,
    greatest(1, coalesce(p_articles_limit, 2)),
    0,
    greatest(1, coalesce(p_images_limit, 14)),
    v_next_reset
  )
  on conflict (user_id) do nothing;

  select *
    into v_usage
    from public.usage_limits
   where user_id = p_user_id
   for update;

  if v_usage.reset_at <= v_now then
    v_usage.monthly_articles_used := 0;
    v_usage.monthly_images_used := 0;
    v_usage.reset_at := case
      when v_next_reset > v_now then v_next_reset
      else v_now + interval '1 month'
    end;
    delete from public.article_usage_sessions where user_id = p_user_id;
  end if;

  v_usage.monthly_articles_limit := greatest(1, coalesce(p_articles_limit, v_usage.monthly_articles_limit));
  v_usage.monthly_images_limit := greatest(1, coalesce(p_images_limit, v_usage.monthly_images_limit));

  select *
    into v_session
    from public.article_usage_sessions
   where user_id = p_user_id
     and session_key = v_clean_key
   for update;

  if found then
    update public.usage_limits
       set monthly_articles_limit = v_usage.monthly_articles_limit,
           monthly_images_limit = v_usage.monthly_images_limit,
           monthly_articles_used = v_usage.monthly_articles_used,
           monthly_images_used = v_usage.monthly_images_used,
           reset_at = v_usage.reset_at
     where user_id = p_user_id;

    return jsonb_build_object(
      'ok', true,
      'already_counted', true,
      'monthly_articles_used', v_usage.monthly_articles_used,
      'monthly_articles_limit', v_usage.monthly_articles_limit,
      'monthly_images_used', v_usage.monthly_images_used,
      'monthly_images_limit', v_usage.monthly_images_limit
    );
  end if;

  if v_usage.monthly_articles_used < v_usage.monthly_articles_limit then
    v_usage.monthly_articles_used := v_usage.monthly_articles_used + 1;
  elsif v_usage.article_credits > 0 then
    v_usage.article_credits := v_usage.article_credits - 1;
  else
    update public.usage_limits
       set monthly_articles_limit = v_usage.monthly_articles_limit,
           monthly_images_limit = v_usage.monthly_images_limit,
           monthly_articles_used = v_usage.monthly_articles_used,
           monthly_images_used = v_usage.monthly_images_used,
           reset_at = v_usage.reset_at
     where user_id = p_user_id;

    return jsonb_build_object(
      'ok', false,
      'reason', 'article_limit_reached',
      'monthly_articles_used', v_usage.monthly_articles_used,
      'monthly_articles_limit', v_usage.monthly_articles_limit,
      'monthly_images_used', v_usage.monthly_images_used,
      'monthly_images_limit', v_usage.monthly_images_limit
    );
  end if;

  insert into public.article_usage_sessions (
    user_id,
    session_key,
    images_used,
    images_allowance,
    extra_article_credits_used
  )
  values (
    p_user_id,
    v_clean_key,
    0,
    v_allowance,
    0
  );

  update public.usage_limits
     set monthly_articles_used = v_usage.monthly_articles_used,
         monthly_articles_limit = v_usage.monthly_articles_limit,
         monthly_images_used = v_usage.monthly_images_used,
         monthly_images_limit = v_usage.monthly_images_limit,
         article_credits = v_usage.article_credits,
         articles_generated_total = v_usage.articles_generated_total + 1,
         reset_at = v_usage.reset_at
   where user_id = p_user_id;

  return jsonb_build_object(
    'ok', true,
    'already_counted', false,
    'monthly_articles_used', v_usage.monthly_articles_used,
    'monthly_articles_limit', v_usage.monthly_articles_limit,
    'monthly_images_used', v_usage.monthly_images_used,
    'monthly_images_limit', v_usage.monthly_images_limit
  );
end;
$rpc_art$;

revoke all on function public.consume_article_quota(uuid, text, integer, integer, integer, timestamptz) from public;
grant execute on function public.consume_article_quota(uuid, text, integer, integer, integer, timestamptz) to service_role;

-- 6) RPC atómica para consumir cota de imagem:
--    - Limite mensal de imagens (14 / 98 / 231 / 336)
--    - Máximo de 7 imagens incluídas por artigo
--    - Acima de 7 no mesmo artigo: desconta 1 crédito de artigo ainda não gerado (+7 slots)
create or replace function public.consume_image_quota(
  p_user_id uuid,
  p_session_key text,
  p_articles_limit integer,
  p_images_limit integer,
  p_max_images_per_article integer default 7,
  p_reset_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $rpc_img$
declare
  v_now timestamptz := now();
  v_usage public.usage_limits%rowtype;
  v_session public.article_usage_sessions%rowtype;
  v_clean_key text := coalesce(nullif(trim(p_session_key), ''), 'default');
  v_next_reset timestamptz := coalesce(p_reset_at, v_now + interval '1 month');
  v_allowance integer := greatest(1, coalesce(p_max_images_per_article, 7));
  v_deducted_credit boolean := false;
begin
  if p_user_id is null then
    return jsonb_build_object('ok', false, 'reason', 'missing_user');
  end if;

  insert into public.usage_limits (
    user_id,
    monthly_articles_used,
    monthly_articles_limit,
    monthly_images_used,
    monthly_images_limit,
    reset_at
  )
  values (
    p_user_id,
    0,
    greatest(1, coalesce(p_articles_limit, 2)),
    0,
    greatest(1, coalesce(p_images_limit, 14)),
    v_next_reset
  )
  on conflict (user_id) do nothing;

  select *
    into v_usage
    from public.usage_limits
   where user_id = p_user_id
   for update;

  if v_usage.reset_at <= v_now then
    v_usage.monthly_articles_used := 0;
    v_usage.monthly_images_used := 0;
    v_usage.reset_at := case
      when v_next_reset > v_now then v_next_reset
      else v_now + interval '1 month'
    end;
    delete from public.article_usage_sessions where user_id = p_user_id;
  end if;

  v_usage.monthly_articles_limit := greatest(1, coalesce(p_articles_limit, v_usage.monthly_articles_limit));
  v_usage.monthly_images_limit := greatest(1, coalesce(p_images_limit, v_usage.monthly_images_limit));

  if v_usage.monthly_images_used >= v_usage.monthly_images_limit then
    return jsonb_build_object(
      'ok', false,
      'reason', 'monthly_image_limit_reached',
      'monthly_articles_used', v_usage.monthly_articles_used,
      'monthly_articles_limit', v_usage.monthly_articles_limit,
      'monthly_images_used', v_usage.monthly_images_used,
      'monthly_images_limit', v_usage.monthly_images_limit
    );
  end if;

  select *
    into v_session
    from public.article_usage_sessions
   where user_id = p_user_id
     and session_key = v_clean_key
   for update;

  if not found then
    if v_usage.monthly_articles_used < v_usage.monthly_articles_limit then
      v_usage.monthly_articles_used := v_usage.monthly_articles_used + 1;
    elsif v_usage.article_credits > 0 then
      v_usage.article_credits := v_usage.article_credits - 1;
    else
      return jsonb_build_object(
        'ok', false,
        'reason', 'article_image_limit_reached',
        'monthly_articles_used', v_usage.monthly_articles_used,
        'monthly_articles_limit', v_usage.monthly_articles_limit,
        'monthly_images_used', v_usage.monthly_images_used,
        'monthly_images_limit', v_usage.monthly_images_limit
      );
    end if;

    insert into public.article_usage_sessions (
      user_id,
      session_key,
      images_used,
      images_allowance,
      extra_article_credits_used
    )
    values (
      p_user_id,
      v_clean_key,
      0,
      v_allowance,
      0
    )
    returning * into v_session;
  end if;

  if v_session.images_used >= v_session.images_allowance then
    if v_usage.monthly_articles_used < v_usage.monthly_articles_limit then
      v_usage.monthly_articles_used := v_usage.monthly_articles_used + 1;
      v_deducted_credit := true;
    elsif v_usage.article_credits > 0 then
      v_usage.article_credits := v_usage.article_credits - 1;
      v_deducted_credit := true;
    else
      return jsonb_build_object(
        'ok', false,
        'reason', 'article_image_limit_reached',
        'article_images_used', v_session.images_used,
        'article_images_allowance', v_session.images_allowance,
        'monthly_articles_used', v_usage.monthly_articles_used,
        'monthly_articles_limit', v_usage.monthly_articles_limit,
        'monthly_images_used', v_usage.monthly_images_used,
        'monthly_images_limit', v_usage.monthly_images_limit
      );
    end if;

    v_session.images_allowance := v_session.images_allowance + v_allowance;
    v_session.extra_article_credits_used := v_session.extra_article_credits_used + 1;
  end if;

  v_session.images_used := v_session.images_used + 1;
  v_usage.monthly_images_used := v_usage.monthly_images_used + 1;

  update public.article_usage_sessions
     set images_used = v_session.images_used,
         images_allowance = v_session.images_allowance,
         extra_article_credits_used = v_session.extra_article_credits_used,
         updated_at = v_now
   where id = v_session.id;

  update public.usage_limits
     set monthly_articles_used = v_usage.monthly_articles_used,
         monthly_articles_limit = v_usage.monthly_articles_limit,
         monthly_images_used = v_usage.monthly_images_used,
         monthly_images_limit = v_usage.monthly_images_limit,
         article_credits = v_usage.article_credits,
         reset_at = v_usage.reset_at
   where user_id = p_user_id;

  return jsonb_build_object(
    'ok', true,
    'deducted_article_credit', v_deducted_credit,
    'article_images_used', v_session.images_used,
    'article_images_allowance', v_session.images_allowance,
    'monthly_articles_used', v_usage.monthly_articles_used,
    'monthly_articles_limit', v_usage.monthly_articles_limit,
    'monthly_images_used', v_usage.monthly_images_used,
    'monthly_images_limit', v_usage.monthly_images_limit
  );
end;
$rpc_img$;

revoke all on function public.consume_image_quota(uuid, text, integer, integer, integer, timestamptz) from public;
grant execute on function public.consume_image_quota(uuid, text, integer, integer, integer, timestamptz) to service_role;

notify pgrst, 'reload schema';
