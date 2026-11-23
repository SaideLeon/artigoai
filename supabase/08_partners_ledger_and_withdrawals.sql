-- =============================================================================
-- 08. Livro-Caixa em Centavos, Garantia de 7 Dias, Saques e Auditoria
-- Dependências: 07_partners_system.sql
-- =============================================================================

-- 1) Pedidos de saque dos parceiros
create table if not exists public.withdrawal_requests (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners (id) on delete cascade,
  valor_centavos integer not null check (valor_centavos > 0),
  saldo_no_momento_centavos integer not null,
  metodo text not null check (metodo in ('pix', 'outro')),
  pix_tipo_chave text check (
    pix_tipo_chave is null
    or pix_tipo_chave in ('cpf', 'cnpj', 'email', 'telefone', 'aleatoria')
  ),
  dados_pagamento text not null check (char_length(trim(dados_pagamento)) >= 3),
  status text not null default 'solicitado' check (
    status in ('solicitado', 'em_analise', 'pago', 'recusado')
  ),
  comprovativo_ref text,
  motivo_recusa text,
  solicitado_em timestamptz not null default now(),
  analisado_em timestamptz,
  pago_em timestamptz,
  recusado_em timestamptz,
  atualizado_em timestamptz not null default now()
);

create index if not exists idx_withdrawal_requests_partner_solicitado
  on public.withdrawal_requests (partner_id, solicitado_em desc);

create index if not exists idx_withdrawal_requests_status_solicitado
  on public.withdrawal_requests (status, solicitado_em desc);

-- Garante no banco que só pode existir 1 pedido de saque aberto por parceiro
create unique index if not exists idx_withdrawal_one_open_per_partner
  on public.withdrawal_requests (partner_id)
  where status in ('solicitado', 'em_analise');

-- 2) Evolução da tabela commissions para centavos inteiros, 5 estados e garantia
alter table public.commissions
  add column if not exists valor_base_centavos integer;

alter table public.commissions
  add column if not exists valor_comissao_centavos integer;

alter table public.commissions
  add column if not exists base_calculo text not null default 'valor_bruto';

alter table public.commissions
  add column if not exists disponivel_em timestamptz;

alter table public.commissions
  add column if not exists withdrawal_request_id uuid references public.withdrawal_requests (id) on delete set null;

alter table public.commissions
  add column if not exists estornada_em timestamptz;

-- Preenche colunas novas para registos legados caso existam
update public.commissions
   set valor_base_centavos = coalesce(valor_base_centavos, round(valor_bruto * 100)::integer),
       valor_comissao_centavos = coalesce(valor_comissao_centavos, round(valor_comissao * 100)::integer),
       disponivel_em = coalesce(disponivel_em, criado_em + interval '7 days')
 where valor_base_centavos is null
    or valor_comissao_centavos is null
    or disponivel_em is null;

alter table public.commissions
  alter column valor_base_centavos set default 0,
  alter column valor_comissao_centavos set default 0,
  alter column disponivel_em set default (now() + interval '7 days');

-- Atualiza CHECK de status da tabela commissions para os 5 estados oficiais
do $$
declare
  v_constraint_name text;
begin
  select c.conname
    into v_constraint_name
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
   where n.nspname = 'public'
     and t.relname = 'commissions'
     and c.contype = 'c'
     and pg_get_constraintdef(c.oid) like '%status%'
   limit 1;

  if v_constraint_name is not null then
    execute format('alter table public.commissions drop constraint %I', v_constraint_name);
  end if;
end $$;

alter table public.commissions
  add constraint commissions_status_check
  check (status in ('pendente', 'disponivel', 'em_saque', 'paga', 'estornada'));

alter table public.commissions
  drop constraint if exists commissions_base_calculo_check;

alter table public.commissions
  add constraint commissions_base_calculo_check
  check (base_calculo in ('valor_bruto', 'valor_liquido'));

create index if not exists idx_commissions_status_disponivel_em
  on public.commissions (status, disponivel_em);

create index if not exists idx_commissions_withdrawal_request_id
  on public.commissions (withdrawal_request_id)
  where withdrawal_request_id is not null;

-- 3) Livro-caixa de lançamentos em centavos (créditos, reservas, compensações e estornos)
create table if not exists public.partner_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners (id) on delete cascade,
  commission_id uuid references public.commissions (id) on delete set null,
  withdrawal_request_id uuid references public.withdrawal_requests (id) on delete set null,
  settled_withdrawal_id uuid references public.withdrawal_requests (id) on delete set null,
  tipo text not null check (
    tipo in (
      'comissao_pendente',
      'liberacao_disponivel',
      'reserva_saque',
      'pagamento_saque',
      'liberacao_saque_recusado',
      'estorno_comissao',
      'ajuste_estorno_pos_pagamento',
      'credito_troco_saque'
    )
  ),
  valor_centavos integer not null,
  saldo_afetado text not null check (
    saldo_afetado in ('pendente', 'disponivel', 'em_saque', 'pago', 'compensacao')
  ),
  descricao text not null default '',
  criado_em timestamptz not null default now()
);

create index if not exists idx_partner_ledger_partner_criado
  on public.partner_ledger_entries (partner_id, criado_em desc);

create index if not exists idx_partner_ledger_open_adjustments
  on public.partner_ledger_entries (partner_id, tipo)
  where settled_withdrawal_id is null;

-- 4) Auditoria completa de mudanças de estado (quem, quando, antes e depois)
create table if not exists public.partner_audit_logs (
  id uuid primary key default gen_random_uuid(),
  entidade text not null check (entidade in ('commission', 'withdrawal_request')),
  entidade_id uuid not null,
  partner_id uuid not null references public.partners (id) on delete cascade,
  actor_type text not null check (
    actor_type in ('webhook', 'cron', 'partner', 'admin', 'system')
  ),
  actor_id uuid,
  actor_email text not null default '',
  acao text not null,
  estado_anterior jsonb,
  estado_novo jsonb,
  motivo text,
  criado_em timestamptz not null default now()
);

create index if not exists idx_partner_audit_logs_partner_criado
  on public.partner_audit_logs (partner_id, criado_em desc);

create index if not exists idx_partner_audit_logs_entidade
  on public.partner_audit_logs (entidade, entidade_id, criado_em desc);

-- 5) RLS nas novas tabelas
alter table public.withdrawal_requests enable row level security;
alter table public.partner_ledger_entries enable row level security;
alter table public.partner_audit_logs enable row level security;

drop policy if exists "withdrawal_requests_partner_select" on public.withdrawal_requests;
create policy "withdrawal_requests_partner_select"
  on public.withdrawal_requests for select
  using (
    exists (
      select 1 from public.partners p
      where p.id = withdrawal_requests.partner_id
        and p.user_id = auth.uid()
    )
  );

drop policy if exists "partner_ledger_entries_partner_select" on public.partner_ledger_entries;
create policy "partner_ledger_entries_partner_select"
  on public.partner_ledger_entries for select
  using (
    exists (
      select 1 from public.partners p
      where p.id = partner_ledger_entries.partner_id
        and p.user_id = auth.uid()
    )
  );

-- 6) RPC: Rotina automática diária para maturar comissões (pendente -> disponivel)
create or replace function public.maturar_comissoes_pendentes(
  p_now timestamptz default now()
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ref_time timestamptz := coalesce(p_now, now());
  v_row record;
  v_count integer := 0;
begin
  for v_row in
    select id, partner_id, valor_comissao_centavos, disponivel_em
      from public.commissions
     where status = 'pendente'
       and disponivel_em <= v_ref_time
     for update skip locked
  loop
    update public.commissions
       set status = 'disponivel'
     where id = v_row.id;

    insert into public.partner_ledger_entries (
      partner_id,
      commission_id,
      tipo,
      valor_centavos,
      saldo_afetado,
      descricao
    ) values (
      v_row.partner_id,
      v_row.id,
      'liberacao_disponivel',
      v_row.valor_comissao_centavos,
      'disponivel',
      'Prazo de garantia concluído: comissão liberada para saque.'
    );

    insert into public.partner_audit_logs (
      entidade,
      entidade_id,
      partner_id,
      actor_type,
      actor_email,
      acao,
      estado_anterior,
      estado_novo,
      motivo
    ) values (
      'commission',
      v_row.id,
      v_row.partner_id,
      'cron',
      'system:cron',
      'maturada',
      jsonb_build_object('status', 'pendente', 'disponivel_em', v_row.disponivel_em),
      jsonb_build_object('status', 'disponivel'),
      'Liberação automática após prazo de garantia.'
    );

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.maturar_comissoes_pendentes(timestamptz) from public;
grant execute on function public.maturar_comissoes_pendentes(timestamptz) to service_role;

-- 7) RPC Atómica: Criar pedido de saque dentro de transação com lock por parceiro
create or replace function public.create_partner_withdrawal(
  p_partner_id uuid,
  p_actor_user_id uuid,
  p_actor_email text,
  p_requested_cents integer,
  p_min_saque_cents integer,
  p_metodo text,
  p_pix_tipo_chave text,
  p_dados_pagamento text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_partner public.partners%rowtype;
  v_open_count integer;
  v_avail_comm_cents integer := 0;
  v_open_adjust_cents integer := 0;
  v_saldo_disponivel integer := 0;
  v_target_cents integer := 0;
  v_withdrawal public.withdrawal_requests%rowtype;
  v_selected_comm_sum integer := 0;
  v_needed_from_comms integer := 0;
  v_comm record;
  v_moved_count integer := 0;
  v_remainder integer := 0;
begin
  select *
    into v_partner
    from public.partners
   where id = p_partner_id
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found', 'error', 'Perfil de parceiro não encontrado.');
  end if;

  if not v_partner.ativo then
    return jsonb_build_object('ok', false, 'code', 'inactive', 'error', 'Sua conta de parceiro está desativada no momento.');
  end if;

  select count(*)
    into v_open_count
    from public.withdrawal_requests
   where partner_id = p_partner_id
     and status in ('solicitado', 'em_analise');

  if v_open_count > 0 then
    return jsonb_build_object('ok', false, 'code', 'open_exists', 'error', 'Já existe um pedido de saque em aberto aguardando análise ou pagamento.');
  end if;

  select coalesce(sum(valor_comissao_centavos), 0)
    into v_avail_comm_cents
    from public.commissions
   where partner_id = p_partner_id
     and status = 'disponivel';

  select coalesce(sum(valor_centavos), 0)
    into v_open_adjust_cents
    from public.partner_ledger_entries
   where partner_id = p_partner_id
     and tipo in ('ajuste_estorno_pos_pagamento', 'credito_troco_saque')
     and settled_withdrawal_id is null;

  v_saldo_disponivel := v_avail_comm_cents + v_open_adjust_cents;

  if v_saldo_disponivel < p_min_saque_cents then
    return jsonb_build_object(
      'ok', false,
      'code', 'insufficient_balance',
      'error', 'Saldo disponível abaixo do mínimo para saque.',
      'saldoDisponivelCentavos', v_saldo_disponivel
    );
  end if;

  v_target_cents := coalesce(nullif(p_requested_cents, 0), v_saldo_disponivel);

  if v_target_cents < p_min_saque_cents then
    return jsonb_build_object(
      'ok', false,
      'code', 'below_minimum',
      'error', 'O valor solicitado é inferior ao mínimo permitido.'
    );
  end if;

  if v_target_cents > v_saldo_disponivel then
    return jsonb_build_object(
      'ok', false,
      'code', 'insufficient_balance',
      'error', 'Saldo disponível insuficiente para o valor solicitado.',
      'saldoDisponivelCentavos', v_saldo_disponivel
    );
  end if;

  insert into public.withdrawal_requests (
    partner_id,
    valor_centavos,
    saldo_no_momento_centavos,
    metodo,
    pix_tipo_chave,
    dados_pagamento,
    status
  ) values (
    p_partner_id,
    v_target_cents,
    v_saldo_disponivel,
    p_metodo,
    case when p_metodo = 'pix' then p_pix_tipo_chave else null end,
    trim(p_dados_pagamento),
    'solicitado'
  )
  returning * into v_withdrawal;

  -- Liquida ajustes em aberto (compensações negativas ou créditos de troco anteriores)
  update public.partner_ledger_entries
     set settled_withdrawal_id = v_withdrawal.id
   where partner_id = p_partner_id
     and tipo in ('ajuste_estorno_pos_pagamento', 'credito_troco_saque')
     and settled_withdrawal_id is null;

  v_needed_from_comms := v_target_cents - v_open_adjust_cents;

  -- Seleciona comissões disponíveis FIFO até cobrir o saque (ou todas se for saque total)
  for v_comm in
    select id, valor_comissao_centavos, status
      from public.commissions
     where partner_id = p_partner_id
       and status = 'disponivel'
     order by disponivel_em asc, criado_em asc
     for update
  loop
    exit when v_target_cents < v_saldo_disponivel and v_selected_comm_sum >= v_needed_from_comms;

    update public.commissions
       set status = 'em_saque',
           withdrawal_request_id = v_withdrawal.id
     where id = v_comm.id;

    insert into public.partner_audit_logs (
      entidade,
      entidade_id,
      partner_id,
      actor_type,
      actor_id,
      actor_email,
      acao,
      estado_anterior,
      estado_novo,
      motivo
    ) values (
      'commission',
      v_comm.id,
      p_partner_id,
      'partner',
      p_actor_user_id,
      coalesce(p_actor_email, ''),
      'incluida_em_saque',
      jsonb_build_object('status', 'disponivel'),
      jsonb_build_object('status', 'em_saque', 'withdrawal_request_id', v_withdrawal.id),
      'Comissão incluída em pedido de saque.'
    );

    v_selected_comm_sum := v_selected_comm_sum + v_comm.valor_comissao_centavos;
    v_moved_count := v_moved_count + 1;
  end loop;

  v_remainder := (v_selected_comm_sum + v_open_adjust_cents) - v_target_cents;
  if v_remainder > 0 then
    insert into public.partner_ledger_entries (
      partner_id,
      withdrawal_request_id,
      settled_withdrawal_id,
      tipo,
      valor_centavos,
      saldo_afetado,
      descricao
    ) values (
      p_partner_id,
      v_withdrawal.id,
      null,
      'credito_troco_saque',
      v_remainder,
      'disponivel',
      'Saldo remanescente mantido disponível após solicitação parcial de saque.'
    );
  end if;

  insert into public.partner_ledger_entries (
    partner_id,
    withdrawal_request_id,
    tipo,
    valor_centavos,
    saldo_afetado,
    descricao
  ) values (
    p_partner_id,
    v_withdrawal.id,
    'reserva_saque',
    v_target_cents,
    'em_saque',
    'Pedido de saque solicitado pelo parceiro.'
  );

  insert into public.partner_audit_logs (
    entidade,
    entidade_id,
    partner_id,
    actor_type,
    actor_id,
    actor_email,
    acao,
    estado_anterior,
    estado_novo,
    motivo
  ) values (
    'withdrawal_request',
    v_withdrawal.id,
    p_partner_id,
    'partner',
    p_actor_user_id,
    coalesce(p_actor_email, ''),
    'saque_solicitado',
    null,
    jsonb_build_object(
      'status', 'solicitado',
      'valor_centavos', v_withdrawal.valor_centavos,
      'metodo', v_withdrawal.metodo
    ),
    'Solicitação de saque criada pelo parceiro.'
  );

  return jsonb_build_object(
    'ok', true,
    'withdrawal', to_jsonb(v_withdrawal),
    'movedCommissions', v_moved_count
  );
exception
  when unique_violation then
    return jsonb_build_object(
      'ok', false,
      'code', 'open_exists',
      'error', 'Já existe um pedido de saque em aberto para este parceiro.'
    );
end;
$$;

revoke all on function public.create_partner_withdrawal(uuid, uuid, text, integer, integer, text, text, text) from public;
grant execute on function public.create_partner_withdrawal(uuid, uuid, text, integer, integer, text, text, text) to service_role;

-- 8) RPC Atómica: Admin atualiza estado do saque (em_analise / pago / recusado)
create or replace function public.admin_update_withdrawal_status(
  p_withdrawal_id uuid,
  p_action text,
  p_admin_user_id uuid,
  p_admin_email text,
  p_comprovativo_ref text default null,
  p_pago_em timestamptz default null,
  p_motivo_recusa text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_w public.withdrawal_requests%rowtype;
  v_pago_time timestamptz := coalesce(p_pago_em, now());
  v_comm record;
begin
  select *
    into v_w
    from public.withdrawal_requests
   where id = p_withdrawal_id
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found', 'error', 'Pedido de saque não encontrado.');
  end if;

  if v_w.status in ('pago', 'recusado') then
    return jsonb_build_object('ok', false, 'code', 'already_finalized', 'error', 'Este pedido de saque já foi finalizado.');
  end if;

  if p_action = 'em_analise' then
    if v_w.status <> 'solicitado' then
      return jsonb_build_object('ok', false, 'code', 'invalid_transition', 'error', 'Apenas pedidos solicitados podem ir para análise.');
    end if;

    update public.withdrawal_requests
       set status = 'em_analise',
           analisado_em = now(),
           atualizado_em = now()
     where id = p_withdrawal_id;

    insert into public.partner_audit_logs (
      entidade, entidade_id, partner_id, actor_type, actor_id, actor_email,
      acao, estado_anterior, estado_novo, motivo
    ) values (
      'withdrawal_request', v_w.id, v_w.partner_id, 'admin', p_admin_user_id, coalesce(p_admin_email, ''),
      'saque_em_analise',
      jsonb_build_object('status', v_w.status),
      jsonb_build_object('status', 'em_analise'),
      'Pedido marcado em análise pelo administrador.'
    );

    select * into v_w from public.withdrawal_requests where id = p_withdrawal_id;
    return jsonb_build_object('ok', true, 'withdrawal', to_jsonb(v_w));
  end if;

  if p_action = 'pago' then
    update public.withdrawal_requests
       set status = 'pago',
           comprovativo_ref = nullif(trim(coalesce(p_comprovativo_ref, '')), ''),
           pago_em = v_pago_time,
           atualizado_em = now()
     where id = p_withdrawal_id;

    for v_comm in
      select id, status
        from public.commissions
       where withdrawal_request_id = p_withdrawal_id
         and status = 'em_saque'
       for update
    loop
      update public.commissions
         set status = 'paga',
             paga_em = v_pago_time
       where id = v_comm.id;

      insert into public.partner_audit_logs (
        entidade, entidade_id, partner_id, actor_type, actor_id, actor_email,
        acao, estado_anterior, estado_novo, motivo
      ) values (
        'commission', v_comm.id, v_w.partner_id, 'admin', p_admin_user_id, coalesce(p_admin_email, ''),
        'paga',
        jsonb_build_object('status', v_comm.status, 'withdrawal_request_id', p_withdrawal_id),
        jsonb_build_object('status', 'paga', 'paga_em', v_pago_time),
        coalesce(nullif(trim(coalesce(p_comprovativo_ref, '')), ''), 'Saque marcado como pago.')
      );
    end loop;

    insert into public.partner_ledger_entries (
      partner_id, withdrawal_request_id, tipo, valor_centavos, saldo_afetado, descricao
    ) values (
      v_w.partner_id, v_w.id, 'pagamento_saque', v_w.valor_centavos, 'pago',
      coalesce(nullif(trim(coalesce(p_comprovativo_ref, '')), ''), 'Saque pago ao parceiro.')
    );

    insert into public.partner_audit_logs (
      entidade, entidade_id, partner_id, actor_type, actor_id, actor_email,
      acao, estado_anterior, estado_novo, motivo
    ) values (
      'withdrawal_request', v_w.id, v_w.partner_id, 'admin', p_admin_user_id, coalesce(p_admin_email, ''),
      'saque_pago',
      jsonb_build_object('status', v_w.status),
      jsonb_build_object(
        'status', 'pago',
        'comprovativo_ref', nullif(trim(coalesce(p_comprovativo_ref, '')), ''),
        'pago_em', v_pago_time
      ),
      'Pagamento de saque confirmado pelo administrador.'
    );

    select * into v_w from public.withdrawal_requests where id = p_withdrawal_id;
    return jsonb_build_object('ok', true, 'withdrawal', to_jsonb(v_w));
  end if;

  if p_action = 'recusado' then
    if trim(coalesce(p_motivo_recusa, '')) = '' then
      return jsonb_build_object('ok', false, 'code', 'reason_required', 'error', 'Informe o motivo da recusa do saque.');
    end if;

    update public.withdrawal_requests
       set status = 'recusado',
           motivo_recusa = trim(p_motivo_recusa),
           recusado_em = now(),
           atualizado_em = now()
     where id = p_withdrawal_id;

    for v_comm in
      select id, status
        from public.commissions
       where withdrawal_request_id = p_withdrawal_id
         and status = 'em_saque'
       for update
    loop
      update public.commissions
         set status = 'disponivel',
             withdrawal_request_id = null
       where id = v_comm.id;

      insert into public.partner_audit_logs (
        entidade, entidade_id, partner_id, actor_type, actor_id, actor_email,
        acao, estado_anterior, estado_novo, motivo
      ) values (
        'commission', v_comm.id, v_w.partner_id, 'admin', p_admin_user_id, coalesce(p_admin_email, ''),
        'devolvida_para_disponivel',
        jsonb_build_object('status', 'em_saque', 'withdrawal_request_id', p_withdrawal_id),
        jsonb_build_object('status', 'disponivel', 'withdrawal_request_id', null),
        trim(p_motivo_recusa)
      );
    end loop;

    -- Restaura ajustes negativos/créditos vinculados a este saque e anula troco gerado por ele
    delete from public.partner_ledger_entries
     where withdrawal_request_id = p_withdrawal_id
       and tipo = 'credito_troco_saque';

    update public.partner_ledger_entries
       set settled_withdrawal_id = null
     where settled_withdrawal_id = p_withdrawal_id;

    insert into public.partner_ledger_entries (
      partner_id, withdrawal_request_id, tipo, valor_centavos, saldo_afetado, descricao
    ) values (
      v_w.partner_id, v_w.id, 'liberacao_saque_recusado', v_w.valor_centavos, 'disponivel',
      trim(p_motivo_recusa)
    );

    insert into public.partner_audit_logs (
      entidade, entidade_id, partner_id, actor_type, actor_id, actor_email,
      acao, estado_anterior, estado_novo, motivo
    ) values (
      'withdrawal_request', v_w.id, v_w.partner_id, 'admin', p_admin_user_id, coalesce(p_admin_email, ''),
      'saque_recusado',
      jsonb_build_object('status', v_w.status),
      jsonb_build_object('status', 'recusado', 'motivo_recusa', trim(p_motivo_recusa)),
      trim(p_motivo_recusa)
    );

    select * into v_w from public.withdrawal_requests where id = p_withdrawal_id;
    return jsonb_build_object('ok', true, 'withdrawal', to_jsonb(v_w));
  end if;

  return jsonb_build_object('ok', false, 'code', 'invalid_action', 'error', 'Ação de saque inválida.');
end;
$$;

revoke all on function public.admin_update_withdrawal_status(uuid, text, uuid, text, text, timestamptz, text) from public;
grant execute on function public.admin_update_withdrawal_status(uuid, text, uuid, text, text, timestamptz, text) to service_role;

-- 9) RPC Atómica: Estornar comissão (com compensação automática se já paga)
create or replace function public.reverse_partner_commission(
  p_commission_id uuid,
  p_actor_type text,
  p_actor_email text,
  p_motivo text default 'Reembolso ou chargeback confirmado pela Cakto.'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_comm public.commissions%rowtype;
  v_old_status text;
  v_old_withdrawal_id uuid;
  v_open_withdrawal public.withdrawal_requests%rowtype;
  v_remaining_cents integer := 0;
begin
  select *
    into v_comm
    from public.commissions
   where id = p_commission_id
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Comissão não encontrada.');
  end if;

  if v_comm.status = 'estornada' then
    return jsonb_build_object('ok', true, 'alreadyReversed', true);
  end if;

  v_old_status := v_comm.status;
  v_old_withdrawal_id := v_comm.withdrawal_request_id;

  update public.commissions
     set status = 'estornada',
         estornada_em = now(),
         withdrawal_request_id = null
   where id = p_commission_id;

  if v_old_status = 'paga' then
    -- Já havia sido paga: lança saldo negativo para compensar nos próximos ganhos
    insert into public.partner_ledger_entries (
      partner_id,
      commission_id,
      tipo,
      valor_centavos,
      saldo_afetado,
      settled_withdrawal_id,
      descricao
    ) values (
      v_comm.partner_id,
      v_comm.id,
      'ajuste_estorno_pos_pagamento',
      -abs(v_comm.valor_comissao_centavos),
      'compensacao',
      null,
      'Estorno pós-pagamento: saldo negativo a compensar nos próximos ganhos.'
    );
  else
    insert into public.partner_ledger_entries (
      partner_id,
      commission_id,
      tipo,
      valor_centavos,
      saldo_afetado,
      descricao
    ) values (
      v_comm.partner_id,
      v_comm.id,
      'estorno_comissao',
      -abs(v_comm.valor_comissao_centavos),
      case when v_old_status = 'em_saque' then 'em_saque' else v_old_status end,
      coalesce(p_motivo, 'Comissão estornada antes do pagamento.')
    );

    -- Se estava vinculada a um pedido de saque ainda em aberto, ajusta ou cancela o saque
    if v_old_status = 'em_saque' and v_old_withdrawal_id is not null then
      select *
        into v_open_withdrawal
        from public.withdrawal_requests
       where id = v_old_withdrawal_id
       for update;

      if found and v_open_withdrawal.status in ('solicitado', 'em_analise') then
        v_remaining_cents := v_open_withdrawal.valor_centavos - abs(v_comm.valor_comissao_centavos);
        if v_remaining_cents <= 0 then
          update public.withdrawal_requests
             set status = 'recusado',
                 motivo_recusa = 'Comissão vinculada estornada antes do pagamento.',
                 recusado_em = now(),
                 atualizado_em = now()
           where id = v_open_withdrawal.id;

          update public.commissions
             set status = 'disponivel',
                 withdrawal_request_id = null
           where withdrawal_request_id = v_open_withdrawal.id
             and status = 'em_saque';

          delete from public.partner_ledger_entries
           where withdrawal_request_id = v_open_withdrawal.id
             and tipo = 'credito_troco_saque';

          update public.partner_ledger_entries
             set settled_withdrawal_id = null
           where settled_withdrawal_id = v_open_withdrawal.id;
        else
          update public.withdrawal_requests
             set valor_centavos = v_remaining_cents,
                 atualizado_em = now()
           where id = v_open_withdrawal.id;
        end if;
      end if;
    end if;
  end if;

  insert into public.partner_audit_logs (
    entidade,
    entidade_id,
    partner_id,
    actor_type,
    actor_email,
    acao,
    estado_anterior,
    estado_novo,
    motivo
  ) values (
    'commission',
    v_comm.id,
    v_comm.partner_id,
    coalesce(nullif(p_actor_type, ''), 'webhook'),
    coalesce(p_actor_email, ''),
    'estornada',
    jsonb_build_object('status', v_old_status, 'withdrawal_request_id', v_old_withdrawal_id),
    jsonb_build_object('status', 'estornada', 'compensacao_pendente', v_old_status = 'paga'),
    coalesce(p_motivo, 'Estorno confirmado.')
  );

  return jsonb_build_object(
    'ok', true,
    'oldStatus', v_old_status,
    'negativeOffsetApplied', (v_old_status = 'paga')
  );
end;
$$;

revoke all on function public.reverse_partner_commission(uuid, text, text, text) from public;
grant execute on function public.reverse_partner_commission(uuid, text, text, text) to service_role;
