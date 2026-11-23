-- =============================================================================
-- 10. RPC Atómica: Criar pedido de saque dentro de transação com lock por parceiro
-- Dependências: 08_partners_ledger_and_withdrawals.sql
-- =============================================================================

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
as $fn_create_wd$
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

  update public.partner_ledger_entries
     set settled_withdrawal_id = v_withdrawal.id
   where partner_id = p_partner_id
     and tipo in ('ajuste_estorno_pos_pagamento', 'credito_troco_saque')
     and settled_withdrawal_id is null;

  v_needed_from_comms := v_target_cents - v_open_adjust_cents;

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
$fn_create_wd$;

revoke all on function public.create_partner_withdrawal(uuid, uuid, text, integer, integer, text, text, text) from public;
grant execute on function public.create_partner_withdrawal(uuid, uuid, text, integer, integer, text, text, text) to service_role;
